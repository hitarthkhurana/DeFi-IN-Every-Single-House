"""
Chat Router Module

This module implements the main chat routing system for the AI Agent API.
It handles message routing, blockchain interactions, attestations, and AI responses.

The module provides a ChatRouter class that integrates various services:
- AI capabilities through GeminiProvider
- Blockchain operations through FlareProvider
- Attestation services through Vtpm
- Prompt management through PromptService
"""

import json

import structlog
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from fastapi import UploadFile
from web3 import Web3

from flare_ai_defai.ai import GeminiProvider
from flare_ai_defai.attestation import Vtpm
from flare_ai_defai.blockchain import BlazeSwapHandler, FlareProvider, RubicBridge
from flare_ai_defai.prompts import PromptService, SemanticRouterResponse

logger = structlog.get_logger(__name__)
router = APIRouter()

# Constants
HTTP_500_ERROR = "Internal server error occurred"
WALLET_NOT_CONNECTED = "Please connect your wallet first"
BALANCE_CHECK_ERROR = "Error checking balance"
SWAP_ERROR = "Error preparing swap"
CROSS_CHAIN_ERROR = "Error preparing cross-chain swap"
PROCESSING_ERROR = "Sorry, there was an error processing your request. Please try again."
NO_ROUTES_ERROR = "No valid routes found for this swap. This might be due to insufficient liquidity or temporary issues."

class ChatMessage(BaseModel):
    """
    Pydantic model for chat message validation.

    Attributes:
        message (str): The chat message content, must not be empty
        image (UploadFile | None): Optional image file upload
    """
    message: str = Field(..., min_length=1)
    image: UploadFile | None = None

class ChatResponse(BaseModel):
    """Standard chat response model"""
    response: str

class PortfolioAnalysisResponse(BaseModel):
    """Portfolio analysis response model"""
    risk_score: float
    text: str

class ConnectWalletRequest(BaseModel):
    """Request model for wallet connection."""
    address: str


class ChatRouter:
    """
    Main router class handling chat messages and their routing to appropriate handlers.

    This class integrates various services and provides routing logic for different
    types of chat messages including blockchain operations, attestations, and general
    conversation.

    Attributes:
        ai (GeminiProvider): Provider for AI capabilities
        blockchain (FlareProvider): Provider for blockchain operations
        attestation (Vtpm): Provider for attestation services
        prompts (PromptService): Service for managing prompts
        logger (BoundLogger): Structured logger for the chat router
    """

    def __init__(
        self,
        ai: GeminiProvider,
        blockchain: FlareProvider,
        attestation: Vtpm,
        prompts: PromptService,
    ) -> None:
        """
        Initialize the ChatRouter with required service providers.

        Args:
            ai: Provider for AI capabilities
            blockchain: Provider for blockchain operations
            attestation: Provider for attestation services
            prompts: Service for managing prompts
        """
        self._router = APIRouter()
        self.ai = ai
        self.blockchain = blockchain
        self.attestation = attestation
        self.prompts = prompts
        self.logger = logger.bind(router="chat")
        self._setup_routes()

    def _setup_routes(self) -> None:
        """
        Set up FastAPI routes for the chat endpoint.
        Handles message routing, command processing, and transaction confirmations.
        """

        @self._router.post("/")
        async def chat(request: Request) -> ChatResponse | PortfolioAnalysisResponse:
            """
            Handle chat messages.
            """
            try:
                # Use form data to support file uploads
                data = await request.form()
                message_text = data.get("message", "")
                wallet_address = data.get("walletAddress")
                image = data.get("image")  # This will be an UploadFile if provided

                if not message_text:
                    return ChatResponse(response="Message cannot be empty")

                # If an image file is provided, handle it
                if image is not None:
                    image_data = await image.read()
                    mime_type = image.content_type or "image/jpeg"
                    
                    # Special handling for portfolio analysis
                    if message_text == "analyze-portfolio":
                        # Get portfolio analysis prompt
                        prompt, _, schema = self.prompts.get_formatted_prompt(
                            "portfolio_analysis"
                        )
                        
                        # Send message with image using AI - use the image's actual MIME type
                        response = await self.ai.send_message_with_image(
                            prompt,
                            image_data,
                            mime_type  # Use the actual image MIME type
                        )
                        
                        # Parse and validate response
                        try:
                            # Try to extract JSON from the text response
                            # Look for JSON structure in the response text
                            response_text = response.text
                            start_idx = response_text.find("{")
                            end_idx = response_text.rfind("}") + 1
                            
                            if start_idx >= 0 and end_idx > start_idx:
                                json_str = response_text[start_idx:end_idx]
                                analysis = json.loads(json_str)
                            else:
                                raise ValueError("No JSON structure found in response")

                            # Validate required fields
                            if "risk_score" not in analysis or "text" not in analysis:
                                raise ValueError("Missing required fields in analysis response")
                            
                            # Convert and validate risk score
                            risk_score = float(analysis["risk_score"])
                            if not (1 <= risk_score <= 10):
                                raise ValueError("Risk score must be between 1 and 10")
                            
                            return PortfolioAnalysisResponse(
                                risk_score=risk_score,
                                text=analysis["text"]
                            )
                        except (json.JSONDecodeError, ValueError) as e:
                            self.logger.error("portfolio_analysis_failed", error=str(e))
                            return PortfolioAnalysisResponse(
                                risk_score=5.0,  # Default moderate risk
                                text="Sorry, I was unable to properly analyze the portfolio image. Please try again."
                            )
                    
                    # Default image handling
                    response = await self.ai.send_message_with_image(
                        message_text,
                        image_data,
                        mime_type
                    )
                    return ChatResponse(response=response.text)

                # Update the blockchain provider with the wallet address if provided
                if wallet_address:
                    self.blockchain.address = wallet_address

                # Get semantic route
                prompt, mime_type, schema = self.prompts.get_formatted_prompt(
                    "semantic_router", user_input=message_text
                )
                route_response = self.ai.generate(
                    prompt=prompt, response_mime_type=mime_type, response_schema=schema
                )
                route = SemanticRouterResponse(route_response.text)

                # Route to appropriate handler
                handler_response = await self.route_message(route, message_text)
                return ChatResponse(response=handler_response["response"])

            except Exception as e:
                self.logger.error("message_handling_failed", error=str(e))
                return ChatResponse(response=PROCESSING_ERROR)

        @self._router.post("/connect_wallet")
        async def connect_wallet(request: ConnectWalletRequest):
            """Connect wallet endpoint"""
            try:
                # Get network configuration
                network_config = await self.blockchain.get_network_config()

                # Get wallet balance
                balance = await self.blockchain.get_balance(request.address)

                return {
                    "status": "success",
                    "balance": balance,
                    "network": network_config,
                    "message": f"Your wallet ({request.address}) has:\n{balance} {self.blockchain.native_symbol}"
                }
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))

    @property
    def router(self) -> APIRouter:
        """Get the FastAPI router with registered routes."""
        return self._router

    async def handle_command(self, command: str) -> dict[str, str]:
        """
        Handle special command messages starting with '/'.

        Args:
            command: Command string to process

        Returns:
            dict[str, str]: Response containing command result
        """
        if command == "/reset":
            self.blockchain.reset()
            self.ai.reset()
            return {"response": "Reset complete"}
        return {"response": "Unknown command"}

    async def get_semantic_route(self, message: str) -> SemanticRouterResponse:
        """
        Determine the semantic route for a message using AI provider.

        Args:
            message: Message to route

        Returns:
            SemanticRouterResponse: Determined route for the message
        """
        try:
            prompt, mime_type, schema = self.prompts.get_formatted_prompt(
                "semantic_router", user_input=message
            )
            route_response = self.ai.generate(
                prompt=prompt, response_mime_type=mime_type, response_schema=schema
            )
            return SemanticRouterResponse(route_response.text)
        except Exception as e:
            self.logger.exception("routing_failed", error=str(e))
            return SemanticRouterResponse.CONVERSATIONAL

    async def route_message(
        self, route: SemanticRouterResponse, message: str
    ) -> dict[str, str]:
        """
        Route a message to the appropriate handler based on semantic route.
        """
        handlers = {
            SemanticRouterResponse.CHECK_BALANCE: self.handle_balance_check,
            SemanticRouterResponse.SEND_TOKEN: self.handle_send_token,
            SemanticRouterResponse.SWAP_TOKEN: self.handle_swap_token,
            SemanticRouterResponse.CROSS_CHAIN_SWAP: self.handle_cross_chain_swap,
            SemanticRouterResponse.REQUEST_ATTESTATION: self.handle_attestation,
            SemanticRouterResponse.CONVERSATIONAL: self.handle_conversation,
        }

        handler = handlers.get(route)
        if not handler:
            return {"response": "Unsupported route"}

        return await handler(message)

    async def handle_balance_check(self, _: str) -> dict[str, str]:
        """
        Handle balance check requests.
        """
        if not self.blockchain.address:
            return {"response": "Please make sure your wallet is connected to check your balance."}

        try:
            balance = self.blockchain.check_balance()
            return {
                "response": f"Your wallet ({self.blockchain.address[:6]}...{self.blockchain.address[-4:]}) has:\n\n{balance} FLR"
            }
        except Exception as e:
            self.logger.exception(BALANCE_CHECK_ERROR, error=str(e))
            return {"response": f"{BALANCE_CHECK_ERROR}: {e!s}"}

    async def handle_send_token(self, message: str) -> dict[str, str]:
        """
        Handle token sending requests.

        Args:
            message: Message containing token sending details

        Returns:
            dict[str, str]: Response containing transaction preview or follow-up prompt
        """
        if not self.blockchain.address:
            await self.handle_generate_account(message)

        prompt, mime_type, schema = self.prompts.get_formatted_prompt(
            "token_send", user_input=message
        )
        send_token_response = self.ai.generate(
            prompt=prompt, response_mime_type=mime_type, response_schema=schema
        )
        send_token_json = json.loads(send_token_response.text)
        expected_json_len = 2
        if (
            len(send_token_json) != expected_json_len
            or send_token_json.get("amount") == 0.0
        ):
            prompt, _, _ = self.prompts.get_formatted_prompt("follow_up_token_send")
            follow_up_response = self.ai.generate(prompt)
            return {"response": follow_up_response.text}

        tx = self.blockchain.create_send_flr_tx(
            to_address=send_token_json.get("to_address"),
            amount=send_token_json.get("amount"),
        )
        self.logger.debug("send_token_tx", tx=tx)
        self.blockchain.add_tx_to_queue(msg=message, tx=tx)
        formatted_preview = (
            "Transaction Preview: "
            + f"Sending {Web3.from_wei(tx.get('value', 0), 'ether')} "
            + f"FLR to {tx.get('to')}\nType CONFIRM to proceed."
        )
        return {"response": formatted_preview}

    async def handle_swap_token(self, message: str) -> dict[str, str]:
        """Handle token swap requests."""
        if not self.blockchain.address:
            return {"response": WALLET_NOT_CONNECTED}

        try:
            # Parse swap parameters from message
            parts = message.split()
            amount = float(parts[1])
            token_in = parts[2].upper()
            token_out = parts[4].upper()

            # Initialize BlazeSwap handler
            blazeswap = BlazeSwapHandler(self.blockchain.w3.provider.endpoint_uri)

            # Prepare swap transaction
            swap_data = await blazeswap.prepare_swap_transaction(
                token_in=token_in,
                token_out=token_out,
                amount_in=amount,
                wallet_address=self.blockchain.address,
                router_address=blazeswap.contracts["router"]
            )

            # Convert transaction to JSON string
            transaction_json = json.dumps(swap_data["transaction"])

            return {
                "response": f"Ready to swap {amount} {token_in} for {token_out}.\n\n" +
                           "Transaction details:\n" +
                           f"- From: {self.blockchain.address[:6]}...{self.blockchain.address[-4:]}\n" +
                           f"- Amount: {amount} {token_in}\n" +
                           f"- Minimum received: {self.blockchain.w3.from_wei(swap_data['min_amount_out'], 'ether')} {token_out}\n\n" +
                           "Please confirm the transaction in your wallet.",
                "transaction": transaction_json  # Now sending as a JSON string
            }

        except Exception as e:
            self.logger.exception(SWAP_ERROR, error=str(e))
            return {"response": f"{SWAP_ERROR}: {e!s}"}

    async def handle_cross_chain_swap(self, message: str) -> dict[str, str]:
        """Handle cross-chain token swap requests."""
        if not self.blockchain.address:
            return {"response": "Please connect your wallet first to perform cross-chain swaps."}

        try:
            # Parse swap parameters using the template
            prompt, mime_type, schema = self.prompts.get_formatted_prompt(
                "cross_chain_swap", user_input=message
            )
            swap_response = self.ai.generate(
                prompt=prompt, response_mime_type=mime_type, response_schema=schema
            )

            # The schema ensures we get FLR to USDC with just the amount
            swap_json = json.loads(swap_response.text)

            # Validate the parsed data
            if not swap_json or swap_json.get("amount", 0) <= 0:
                return {"response": "Could not understand the swap amount. Please try again with a valid amount."}

            # Initialize Rubic bridge
            rubic = RubicBridge(self.blockchain.address)

            try:
                # Get quote first
                quote = await rubic.calculate_cross_chain_quote(swap_json["amount"])

                # Format the response with the quote details
                response = (
                    f"Ready to swap {swap_json['amount']} {swap_json['from_token']} to {swap_json['to_token']} on Arbitrum\n\n"
                    f"Expected output: {quote['expectedOutput']} USDC\n"
                    f"From: {self.blockchain.address[:6]}...{self.blockchain.address[-4:]}\n\n"
                    "Please confirm the transaction in your wallet."
                )

                # Execute the swap
                result = await rubic.execute_cross_chain_swap(quote)

                # Convert transaction to JSON string for the frontend
                transaction_json = json.dumps(result["transaction"])

                return {
                    "response": response,
                    "transaction": transaction_json
                }
            except Exception as e:
                if "No valid routes found" in str(e):
                    return {"response": NO_ROUTES_ERROR}
                raise

        except Exception as e:
            self.logger.exception(CROSS_CHAIN_ERROR, error=str(e))
            return {"response": f"{CROSS_CHAIN_ERROR}: {e!s}"}

    async def handle_attestation(self, _: str) -> dict[str, str]:
        """
        Handle attestation requests.

        Args:
            _: Unused message parameter

        Returns:
            dict[str, str]: Response containing attestation request
        """
        prompt = self.prompts.get_formatted_prompt("request_attestation")[0]
        request_attestation_response = self.ai.generate(prompt=prompt)
        self.attestation.attestation_requested = True
        return {"response": request_attestation_response.text}

    async def handle_conversation(self, message: str) -> dict[str, str]:
        """
        Handle general conversation messages.

        Args:
            message: Message to process

        Returns:
            dict[str, str]: Response from AI provider
        """
        response = self.ai.send_message(message)
        return {"response": response.text}
