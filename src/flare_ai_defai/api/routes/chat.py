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
import os
import re

import structlog
from fastapi import APIRouter, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field
from web3 import Web3

from flare_ai_defai.ai import GeminiProvider
from flare_ai_defai.attestation import Vtpm
from flare_ai_defai.blockchain.blazeswap import BlazeSwapHandler
from flare_ai_defai.blockchain.flare import FlareProvider
from flare_ai_defai.blockchain.sflr_staking import (
    SFLR_CONTRACT_ADDRESS,
    parse_stake_command,
    stake_flr_to_sflr,
)
from flare_ai_defai.prompts import PromptService, SemanticRouterResponse

logger = structlog.get_logger(__name__)
router = APIRouter()

# Constants
HTTP_500_ERROR = "Internal server error occurred"
WALLET_NOT_CONNECTED = "Please connect your wallet first"
BALANCE_CHECK_ERROR = "Error checking balance"
SWAP_ERROR = "Error preparing swap"
CROSS_CHAIN_ERROR = "Error preparing cross-chain swap"
PROCESSING_ERROR = (
    "Sorry, there was an error processing your request. Please try again."
)
NO_ROUTES_ERROR = "No valid routes found for this swap. This might be due to insufficient liquidity or temporary issues."
STAKING_ERROR = "Error preparing staking transaction"


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
    """Dynamic chat response model that can accept any JSON format"""

    class Config:
        arbitrary_types_allowed = True
        extra = "allow"


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

        # Get Web3 provider URL from environment
        web3_provider_url = os.getenv(
            "WEB3_PROVIDER_URL", "https://flare-api.flare.network/ext/C/rpc"
        )

        # Initialize BlazeSwap handler with provider URL from environment
        self.blazeswap = BlazeSwapHandler(web3_provider_url)
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
                    return {"response": "Message cannot be empty"}

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
                            mime_type,  # Use the actual image MIME type
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
                                raise ValueError(
                                    "Missing required fields in analysis response"
                                )

                            # Convert and validate risk score
                            risk_score = float(analysis["risk_score"])
                            if not (1 <= risk_score <= 10):
                                raise ValueError("Risk score must be between 1 and 10")

                            return PortfolioAnalysisResponse(
                                risk_score=risk_score, text=analysis["text"]
                            )
                        except (json.JSONDecodeError, ValueError) as e:
                            self.logger.error("portfolio_analysis_failed", error=str(e))
                            return PortfolioAnalysisResponse(
                                risk_score=5.0,  # Default moderate risk
                                text="Sorry, I was unable to properly analyze the portfolio image. Please try again.",
                            )

                    # Default image handling
                    response = await self.ai.send_message_with_image(
                        message_text, image_data, mime_type
                    )
                    return {"response": response.text}

                # Update the blockchain provider with the wallet address if provided
                if wallet_address:
                    self.blockchain.address = wallet_address

                # Check for direct commands first
                words = message_text.lower().split()
                if words:
                    command = words[0]
                    # Direct command routing
                    if command == "perp":
                        return {
                            "response": "Perpetuals trading is not supported. Please use BlazeSwap for token swaps."
                        }
                    if command == "swap":
                        return await self.handle_swap_token(message_text)
                    if command == "universal":
                        return {
                            "response": "Universal router swaps have been removed. Please use 'swap' command for BlazeSwap trading."
                        }
                    if command == "balance" or command == "check":
                        return await self.handle_balance_check(message_text)
                    if command == "send":
                        return await self.handle_send_token(message_text)
                    if command == "stake":
                        # Directly handle stake command without semantic routing
                        return await self.handle_stake_command(message_text)
                    if command == "pool":
                        return await self.handle_add_liquidity(message_text)
                    if command == "risk":
                        return await self.handle_risk_assessment(message_text)
                    if command == "attest":
                        return await self.handle_attestation(message_text)
                    if command == "help":
                        return await self.handle_help_command()

                # If no direct command match, use semantic routing
                prompt, mime_type, schema = self.prompts.get_formatted_prompt(
                    "semantic_router", user_input=message_text
                )
                route_response = self.ai.generate(
                    prompt=prompt, response_mime_type=mime_type, response_schema=schema
                )
                route = SemanticRouterResponse(route_response.text)

                # Route to appropriate handler
                handler_response = await self.route_message(route, message_text)
                return handler_response  # Return the handler response directly

            except Exception as e:
                self.logger.error("message_handling_failed", error=str(e))
                return {"response": PROCESSING_ERROR}

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
                    "message": f"Your wallet ({request.address}) has:\n{balance} {self.blockchain.native_symbol}",
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
        Route a message to the appropriate handler based on the semantic route.

        Args:
            route: Semantic route determined by the AI
            message: Message to process

        Returns:
            dict[str, str]: Response from the appropriate handler
        """
        # Map routes to handlers
        handlers = {
            SemanticRouterResponse.CHECK_BALANCE: self.handle_balance_check,
            SemanticRouterResponse.SEND_TOKEN: self.handle_send_token,
            SemanticRouterResponse.SWAP_TOKEN: self.handle_swap_token,
            SemanticRouterResponse.CROSS_CHAIN_SWAP: self.handle_cross_chain_swap,
            SemanticRouterResponse.STAKE_FLR: self.handle_stake_command,
            SemanticRouterResponse.REQUEST_ATTESTATION: self.handle_attestation,
            SemanticRouterResponse.CONVERSATIONAL: self.handle_conversation,
        }

        # Check for direct command patterns before semantic routing
        message_lower = message.lower()

        # Handle universal router commands
        if message_lower.startswith("universal"):
            # Extract the parameters from the universal command
            parts = message_lower.split()
            if len(parts) >= 4:
                amount = parts[1]
                token_in = parts[2]
                token_out = parts[3]
                # Convert to swap format
                swap_command = f"swap {amount} {token_in} to {token_out}"
                return await self.handle_swap_token(swap_command)
            return {
                "response": "Invalid swap format. Please use: swap <amount> <token_in> to <token_out>"
            }

        # Convert regular swap commands to the right format if they match the pattern
        # Example: "swap 1 wflr to usdc.e"
        swap_pattern = re.compile(
            r"swap\s+(\d+\.?\d*)\s+(\w+\.?\w*)\s+to\s+(\w+\.?\w*)", re.IGNORECASE
        )
        match = swap_pattern.match(message_lower)
        if match:
            return await self.handle_swap_token(message)

        handler = handlers.get(route)
        if not handler:
            return {"response": "Unsupported route"}

        return await handler(message)

    async def handle_balance_check(self, _: str) -> dict[str, str]:
        """
        Handle balance check requests.
        """
        if not self.blockchain.address:
            return {
                "response": "Please make sure your wallet is connected to check your balance."
            }

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
            if len(parts) < 5:
                return {
                    "response": """Usage: swap <amount> <token_in> to <token_out>
Example: swap 0.1 FLR to USDC.E
Example: swap 0.1 FLR to FLX

Supported tokens: FLR, WFLR, USDC.E, USDT, WETH, FLX"""
                }

            amount = float(parts[1])
            token_in = parts[2].upper()
            token_out = parts[4].upper()

            # Initialize BlazeSwap handler
            blazeswap = BlazeSwapHandler(self.blockchain.w3.provider.endpoint_uri)

            # Validate tokens
            supported_tokens = list(blazeswap.tokens.keys())
            if token_in != "FLR" and token_in not in supported_tokens:
                return {
                    "response": f"Unsupported input token: {token_in}. Supported tokens: FLR, {', '.join(supported_tokens)}"
                }

            if token_out not in supported_tokens:
                return {
                    "response": f"Unsupported output token: {token_out}. Supported tokens: {', '.join(supported_tokens)}"
                }

            # Prepare swap transaction
            swap_data = await blazeswap.prepare_swap_transaction(
                token_in=token_in,
                token_out=token_out,
                amount_in=amount,
                wallet_address=self.blockchain.address,
                router_address=blazeswap.contracts["router"],
            )

            # Convert transaction to JSON string
            transaction_json = json.dumps(swap_data["transaction"])

            # Format the response based on the tokens involved
            min_amount = self.blockchain.w3.from_wei(
                swap_data["min_amount_out"], "ether"
            )

            # For USDC.E which has 6 decimals, we need to adjust the display
            if token_out.upper() == "USDC.E":
                min_amount = swap_data["min_amount_out"] / 10**6

            return {
                "response": f"Ready to swap {amount} {token_in} for {token_out}.\n\n"
                + "Transaction details:\n"
                + f"- From: {self.blockchain.address[:6]}...{self.blockchain.address[-4:]}\n"
                + f"- Amount: {amount} {token_in}\n"
                + f"- Minimum received: {min_amount} {token_out}\n\n"
                + "Please confirm the transaction in your wallet.",
                "transaction": transaction_json,  # Now sending as a JSON string
            }

        except Exception as e:
            self.logger.exception(SWAP_ERROR, error=str(e))
            return {"response": f"{SWAP_ERROR}: {e!s}"}

    async def handle_cross_chain_swap(self, message: str) -> dict[str, str]:
        """Handle cross-chain token swap requests."""
        if not self.blockchain.address:
            return {
                "response": "Please connect your wallet first to perform cross-chain swaps."
            }

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
                return {
                    "response": "Could not understand the swap amount. Please try again with a valid amount."
                }

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

    async def handle_message(self, message: str) -> dict[str, str]:
        """Handle incoming chat message."""

        # Extract command if present
        words = message.lower().split()
        if not words:
            return {"response": "Please enter a message."}

        command = words[0]

        # Handle direct commands first
        try:
            # Direct command routing
            if command == "perp":
                return {
                    "response": "Perpetuals trading is not supported. Please use BlazeSwap for token swaps."
                }
            if command == "swap":
                return await self.handle_swap_token(message)
            if command == "universal":
                return {
                    "response": "Universal router swaps have been removed. Please use 'swap' command for BlazeSwap trading."
                }
            if command == "balance" or command == "check":
                return await self.handle_balance_check(message)
            if command == "send":
                return await self.handle_send_token(message)
            if command == "stake":
                # Directly handle stake command without semantic routing
                return await self.handle_stake_command(message)
            if command == "pool":
                # Check if it's a pool command with native FLR
                if (
                    len(words) >= 5
                    and words[1].lower() == "add"
                    and words[3].lower() == "flr"
                ) or (
                    len(words) >= 5
                    and words[1].lower() == "add"
                    and (words[3].lower() == "wflr" or words[4].lower() == "wflr")
                ):
                    return await self.handle_add_liquidity(message)
                # Otherwise, it's a regular pool command with two tokens
                if len(words) >= 5 and words[1].lower() == "add":
                    return await self.handle_add_liquidity(message)
                return {
                    "response": """Usage: pool add <amount> <token_a> <token_b>
Example: pool add 1 WFLR USDC.E
Example: pool add 100 FLX USDC.E

Or for native FLR:
pool add <amount_flr> FLR <token>
Example: pool add 1 FLR USDC.E

Supported tokens: FLR, WFLR, USDC.E, USDT, WETH, FLX"""
                }
            if command == "risk":
                return await self.handle_risk_assessment(message)
            if command == "attest":
                return await self.handle_attestation(message)
            if command == "help":
                return await self.handle_help_command()
            # If no specific command, treat as conversation
            return await self.handle_conversation(message)
        except Exception as e:
            self.logger.exception(PROCESSING_ERROR, error=str(e))
            return {"response": f"{PROCESSING_ERROR}: {e!s}"}

    async def handle_stake_command(self, message: str) -> dict[str, str]:
        """Handle FLR staking to sFLR requests."""
        if not self.blockchain.address:
            return {"response": WALLET_NOT_CONNECTED}

        try:
            # Parse stake parameters from message
            parsed_command = await parse_stake_command(message)

            if parsed_command["status"] == "error":
                return {"response": f"{STAKING_ERROR}: {parsed_command['message']}"}

            amount = parsed_command["amount"]

            # Prepare staking transaction
            stake_data = stake_flr_to_sflr(
                web3_provider_url=self.blockchain.w3.provider.endpoint_uri,
                wallet_address=self.blockchain.address,
                amount=amount,
            )

            if stake_data["status"] == "error":
                return {"response": f"{STAKING_ERROR}: {stake_data['message']}"}

            # Convert transaction to JSON string
            transaction_json = json.dumps(stake_data["transaction"])

            return {
                "response": f"Ready to stake {amount} FLR to sFLR.\n\n"
                + "Transaction details:\n"
                + f"- From: {self.blockchain.address[:6]}...{self.blockchain.address[-4:]}\n"
                + f"- Amount: {amount} FLR\n"
                + f"- Contract: {SFLR_CONTRACT_ADDRESS[:6]}...{SFLR_CONTRACT_ADDRESS[-4:]}\n\n"
                + "Please confirm the transaction in your wallet.",
                "transaction": transaction_json,
            }

        except Exception as e:
            self.logger.exception(STAKING_ERROR, error=str(e))
            return {"response": f"{STAKING_ERROR}: {e!s}"}

    async def handle_help_command(self) -> dict[str, str]:
        """Handle help command."""
        help_text = """
🤖 **DeFi AI Assistant Commands**

**Wallet Operations:**
- `balance` - Check your wallet balance
- `send <amount> <address>` - Send FLR to an address

**Trading Operations:**
- `swap <amount> <token_in> to <token_out>` - Swap tokens on BlazeSwap
  Example: swap 0.1 WFLR to USDC.E
  Example: swap 0.1 FLR to FLX
  Example: swap 0.5 FLX to FLR

**Liquidity Operations:**
- `pool add <amount> <token_a> <token_b>` - Add liquidity with two tokens
  Example: pool add 1 WFLR USDC.E
  Example: pool add 100 FLX USDC.E
- `pool add <amount_flr> FLR <token>` - Add liquidity with native FLR
  Example: pool add 1 FLR USDC.E
  Example: pool add 0.5 FLR FLX

**Staking Operations:**
- `stake <amount> FLR` - Stake FLR to get sFLR
  Example: stake 10 FLR

**Risk Assessment:**
- `risk <score>` - Get personalized DeFi strategy based on risk tolerance (1-10)
  Example: risk 5

**Other Commands:**
- `help` - Show this help message
- `attest` - Generate an attestation of the AI's response

You can also ask me general questions about DeFi on Flare Network!
"""
        return {"response": help_text}

    async def handle_add_liquidity_nat(self, message: str) -> dict[str, str]:
        """Handle adding liquidity with native FLR and a token."""
        if not self.blockchain.address:
            return {"response": WALLET_NOT_CONNECTED}

        try:
            # Parse parameters from message
            # New format: pool add <amount_flr> FLR <token>
            # Example: pool add 1 FLR USDC.E
            parts = message.split()
            if len(parts) < 5:
                return {
                    "response": """Usage: pool add <amount_flr> FLR <token>
Example: pool add 0.1 FLR USDC.E
Example: pool add 0.5 FLR FLX

Supported tokens: USDC.E, USDT, WETH, FLX"""
                }

            amount_flr = float(parts[2])
            token = parts[4].upper()

            # Initialize BlazeSwap handler
            blazeswap = BlazeSwapHandler(self.blockchain.w3.provider.endpoint_uri)

            # Validate token
            supported_tokens = list(blazeswap.tokens.keys())
            if token not in supported_tokens or token == "FLR" or token == "WFLR":
                return {
                    "response": f"Unsupported token: {token}. Supported tokens: {', '.join([t for t in supported_tokens if t not in ['FLR', 'WFLR']])}"
                }

            # Get token pair price to calculate the equivalent amount of token
            # This is a simplified approach - in a real implementation, you would query the pool for the current ratio
            # For now, we'll use a hardcoded ratio for FLR/USDC.E and default to 1:1 for other pairs
            token_ratios = {
                "FLR_USDC.E": 0.06,  # 1 FLR = 0.06 USDC.E (adjusted to realistic value)
                "USDC.E_FLR": 16.67,  # 1 USDC.E = 16.67 FLR
                "FLR_FLX": 0.135,  # Approximate ratio (adjusted)
                "FLX_FLR": 7.4,  # Approximate ratio (adjusted)
            }

            # Determine the pair key
            pair_key = f"FLR_{token}"
            reverse_pair_key = f"{token}_FLR"

            # Calculate amount_token based on the ratio
            amount_token = 0
            if pair_key in token_ratios:
                amount_token = amount_flr * token_ratios[pair_key]
                print(f"Debug - Using ratio {token_ratios[pair_key]} for {pair_key}")
            elif reverse_pair_key in token_ratios:
                amount_token = amount_flr / token_ratios[reverse_pair_key]
                print(
                    f"Debug - Using inverse ratio 1/{token_ratios[reverse_pair_key]} for {reverse_pair_key}"
                )
            else:
                # Default to 1:1 ratio if we don't have a specific ratio
                amount_token = amount_flr
                print(f"Debug - Using default 1:1 ratio for {pair_key}")

            # Round to appropriate decimal places based on token
            if token.upper() == "USDC.E":
                amount_token = round(amount_token, 6)  # USDC.E has 6 decimals
            else:
                amount_token = round(
                    amount_token, 8
                )  # Other tokens use 8 decimal places for display

            print(f"Debug - Calculated {amount_token} {token} for {amount_flr} FLR")

            # Prepare add liquidity transaction
            liquidity_data = await blazeswap.prepare_add_liquidity_transaction(
                token=token,
                amount_token=amount_token,
                amount_flr=amount_flr,
                wallet_address=self.blockchain.address,
                router_address=blazeswap.contracts["router"],
            )

            # Print debug information about the transaction
            print(
                f"Debug - Liquidity data: token={token}, amount_token={amount_token}, amount_flr={amount_flr}"
            )
            print(
                f"Debug - Min amounts: token_min={liquidity_data.get('amount_token_min', 'N/A')}, flr_min={liquidity_data.get('amount_flr_min', 'N/A')}"
            )

            # Check if approval is needed
            needs_approval = liquidity_data.get("needs_approval", False)

            # Prepare transactions array
            transactions = []

            # Add approval transaction if needed
            if needs_approval and "approval_transaction" in liquidity_data:
                approval_tx = liquidity_data["approval_transaction"]
                print(f"Debug - Approval transaction to: {approval_tx['to']}")
                transactions.append(
                    {
                        "tx": approval_tx,
                        "description": f"1. Approve {amount_token:.6f} {token} for adding liquidity",
                    }
                )

            # Add liquidity transaction
            add_liquidity_tx = liquidity_data["transaction"]
            print(f"Debug - Add liquidity transaction to: {add_liquidity_tx['to']}")
            transactions.append(
                {
                    "tx": add_liquidity_tx,
                    "description": f"{'2' if needs_approval else '1'}. Add liquidity with {amount_flr} FLR and {amount_token:.6f} {token}",
                }
            )

            # Convert transactions to JSON string
            transactions_json = json.dumps(transactions)
            print(f"Debug - Transactions JSON: {transactions_json[:100]}...")

            # Build response message
            response_message = f"Ready to add liquidity with {amount_flr} FLR and {amount_token:.6f} {token}.\n\n"

            if needs_approval:
                response_message += "This operation requires two transactions:\n"
                response_message += f"1. Approve {token} for trading\n"
                response_message += f"2. Add liquidity with FLR and {token}\n\n"

            response_message += "Transaction details:\n"
            response_message += f"- From: {self.blockchain.address[:6]}...{self.blockchain.address[-4:]}\n"
            response_message += f"- FLR amount: {amount_flr} (min: {liquidity_data['amount_flr_min']})\n"
            response_message += f"- {token} amount: {amount_token:.6f} (min: {liquidity_data['amount_token_min']})\n\n"
            response_message += f"Please confirm {'each transaction' if needs_approval else 'the transaction'} in your wallet."

            return {"response": response_message, "transactions": transactions_json}

        except Exception as e:
            self.logger.exception(
                "Error adding liquidity with native FLR", error=str(e)
            )
            return {"response": f"Error adding liquidity: {e!s}"}

    async def handle_add_liquidity(self, message: str) -> dict[str, str]:
        """Handle adding liquidity with two tokens."""
        if not self.blockchain.address:
            return {"response": WALLET_NOT_CONNECTED}

        try:
            # Parse parameters from message
            # New format: pool add <amount> <token_a> <token_b>
            # Example: pool add 1 WFLR USDC.E
            parts = message.split()
            if len(parts) < 5:
                return {
                    "response": """Usage: pool add <amount> <token_a> <token_b>
Example: pool add 1 WFLR USDC.E
Example: pool add 100 FLX USDC.E

Supported tokens: WFLR, USDC.E, USDT, WETH, FLX"""
                }

            amount_a = float(parts[2])
            token_a = parts[3].upper()
            token_b = parts[4].upper()

            # Initialize BlazeSwap handler
            blazeswap = BlazeSwapHandler(self.blockchain.w3.provider.endpoint_uri)

            # Validate tokens
            supported_tokens = list(blazeswap.tokens.keys())

            # Special case: if either token is FLR, redirect to handle_add_liquidity_nat
            if token_a == "FLR":
                return await self.handle_add_liquidity_nat(
                    f"pool add {amount_a} FLR {token_b}"
                )

            if token_b == "FLR":
                return await self.handle_add_liquidity_nat(
                    f"pool add {amount_a} FLR {token_a}"
                )

            # Make sure both tokens are supported and neither is FLR
            if token_a not in supported_tokens or token_a == "FLR":
                return {
                    "response": f"Unsupported token A: {token_a}. Supported tokens: {', '.join([t for t in supported_tokens if t != 'FLR'])}"
                }

            if token_b not in supported_tokens or token_b == "FLR":
                return {
                    "response": f"Unsupported token B: {token_b}. Supported tokens: {', '.join([t for t in supported_tokens if t != 'FLR'])}"
                }

            # Special case for WFLR - make sure we're using the correct token address
            if token_a == "WFLR":
                print(f"Debug - Using WFLR as token A: {blazeswap.tokens['WFLR']}")

            if token_b == "WFLR":
                print(f"Debug - Using WFLR as token B: {blazeswap.tokens['WFLR']}")

            # Get token pair price to calculate the equivalent amount of token B
            # This is a simplified approach - in a real implementation, you would query the pool for the current ratio
            # For now, we'll use a hardcoded ratio for WFLR/USDC.E and default to 1:1 for other pairs
            token_ratios = {
                "WFLR_USDC.E": 0.06,  # 1 WFLR = 0.06 USDC.E (adjusted to realistic value)
                "USDC.E_WFLR": 16.67,  # 1 USDC.E = 16.67 WFLR
                "WFLR_FLX": 0.135,  # Approximate ratio (adjusted)
                "FLX_WFLR": 7.4,  # Approximate ratio (adjusted)
            }

            # Determine the pair key
            pair_key = f"{token_a}_{token_b}"
            reverse_pair_key = f"{token_b}_{token_a}"

            # Calculate amount_b based on the ratio
            amount_b = 0
            if pair_key in token_ratios:
                amount_b = amount_a * token_ratios[pair_key]
                print(f"Debug - Using ratio {token_ratios[pair_key]} for {pair_key}")
            elif reverse_pair_key in token_ratios:
                amount_b = amount_a / token_ratios[reverse_pair_key]
                print(
                    f"Debug - Using inverse ratio 1/{token_ratios[reverse_pair_key]} for {reverse_pair_key}"
                )
            else:
                # Default to 1:1 ratio if we don't have a specific ratio
                amount_b = amount_a
                print(f"Debug - Using default 1:1 ratio for {pair_key}")

            # Round to appropriate decimal places based on token
            if token_b.upper() == "USDC.E":
                amount_b = round(amount_b, 6)  # USDC.E has 6 decimals
            else:
                amount_b = round(
                    amount_b, 8
                )  # Other tokens use 8 decimal places for display

            print(f"Debug - Calculated {amount_b} {token_b} for {amount_a} {token_a}")

            # Prepare add liquidity transaction
            liquidity_data = await blazeswap.prepare_add_liquidity_transaction(
                token_a=token_a,
                token_b=token_b,
                amount_a=amount_a,
                amount_b=amount_b,
                wallet_address=self.blockchain.address,
                router_address=blazeswap.contracts["router"],
            )

            # Print debug information about the transaction
            print(
                f"Debug - Liquidity data: token_a={token_a}, amount_a={amount_a}, token_b={token_b}, amount_b={amount_b}"
            )
            print(
                f"Debug - Min amounts: token_a_min={liquidity_data.get('amount_a_min', 'N/A')}, token_b_min={liquidity_data.get('amount_b_min', 'N/A')}"
            )

            # Convert transactions array to JSON string
            transactions_json = json.dumps(liquidity_data["transactions"])
            print(f"Debug - Transactions JSON: {transactions_json[:100]}...")

            # Build response message
            response_message = f"Ready to add liquidity with {amount_a} {token_a} and {amount_b:.6f} {token_b}.\n\n"

            num_approvals = 0
            if liquidity_data.get("needs_approval_a", False):
                num_approvals += 1
            if liquidity_data.get("needs_approval_b", False):
                num_approvals += 1

            if num_approvals > 0:
                response_message += (
                    f"This operation requires {num_approvals + 1} transactions:\n"
                )
                if liquidity_data.get("needs_approval_a", False):
                    response_message += f"- Approve {token_a} for trading\n"
                if liquidity_data.get("needs_approval_b", False):
                    response_message += f"- Approve {token_b} for trading\n"
                response_message += f"- Add liquidity with {token_a} and {token_b}\n\n"

            response_message += "Transaction details:\n"
            response_message += f"- From: {self.blockchain.address[:6]}...{self.blockchain.address[-4:]}\n"
            response_message += f"- {token_a} amount: {amount_a} (min: {liquidity_data['amount_a_min']})\n"
            response_message += f"- {token_b} amount: {amount_b:.6f} (min: {liquidity_data['amount_b_min']})\n\n"
            response_message += f"Please confirm {'each transaction' if num_approvals > 0 else 'the transaction'} in your wallet."

            return {"response": response_message, "transactions": transactions_json}

        except Exception as e:
            self.logger.exception("Error adding liquidity", error=str(e))
            return {"response": f"Error adding liquidity: {e!s}"}
