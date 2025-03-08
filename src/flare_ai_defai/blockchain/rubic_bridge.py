"""Rubic bridge integration for cross-chain swaps."""

from typing import Any

import aiohttp
from web3 import Web3

from .network_config import NETWORK_CONFIGS

# Constants
HTTP_OK = 200
QUOTE_ERROR_MSG = "Failed to get quote"
NO_ROUTES_MSG = "No valid routes found"


class QuoteError(Exception):
    """Raised when there is an error getting a quote."""
    def __init__(self, error_msg: str) -> None:
        self.error_msg = error_msg
        super().__init__(self.error_msg)


class NoRoutesError(Exception):
    """Raised when no valid routes are found."""
    def __init__(self, error_msg: str) -> None:
        self.error_msg = error_msg
        super().__init__(self.error_msg)


class SwapError(Exception):
    """Raised when there is an error executing a swap."""
    def __init__(self, error_msg: str) -> None:
        self.error_msg = error_msg
        super().__init__(self.error_msg)


class RubicBridge:
    """Handler for cross-chain swaps using Rubic protocol."""

    def __init__(self, wallet_address: str) -> None:
        """Initialize the RubicBridge.

        Args:
            wallet_address: The wallet address to execute swaps from
        """
        self.wallet_address = wallet_address
        self.flare_rpc = NETWORK_CONFIGS["flare"]["rpc_url"]
        self.arbitrum_rpc = NETWORK_CONFIGS["arbitrum"]["rpc_url"]

        # Token addresses
        self.flr_address = "0x0000000000000000000000000000000000000000"
        self.usdc_arbitrum = "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8"

    async def calculate_cross_chain_quote(self, amount: float) -> dict[str, Any]:
        """Calculate cross-chain quote for FLR to USDC swap.

        Args:
            amount: Amount of FLR to swap

        Returns:
            Dict containing quote information

        Raises:
            QuoteError: If quote calculation fails
            NoRoutesError: If no valid routes are found
        """
        try:
            # Convert amount to Wei
            amount_wei = Web3.to_wei(amount, "ether")

            # Prepare request data
            request_data = {
                "fromTokenAddress": self.flr_address,
                "toTokenAddress": self.usdc_arbitrum,
                "fromAmount": str(amount_wei),
                "fromAddress": self.wallet_address,
                "fromChainId": NETWORK_CONFIGS["flare"]["chain_id"],
                "toChainId": NETWORK_CONFIGS["arbitrum"]["chain_id"],
            }

            # Get quote from Rubic API
            async with aiohttp.ClientSession() as session, \
                     session.post(
                         "https://api.rubic.exchange/api/v1/cross-chain/trades",
                         json=request_data
                     ) as response:

                if response.status != HTTP_OK:
                    error_msg = await response.text()
                    error = f"{QUOTE_ERROR_MSG}: {error_msg}"
                    raise QuoteError(error)

                data = await response.json()
                trades = data.get("result", [])

                if not trades or not trades[0] or trades[0].error:
                    error_msg = trades[0].error if trades and trades[0] else "No routes"
                    error = f"{NO_ROUTES_MSG}: {error_msg}"
                    raise NoRoutesError(error)

                best_trade = trades[0].trade

                return {
                    "trade": best_trade,
                    "transaction": best_trade["transactionRequest"],
                    "fromAmount": amount,
                    "expectedOutput": best_trade["toTokenAmount"],
                    "fromChain": "Flare",
                    "toChain": "Arbitrum",
                }

        except (QuoteError, NoRoutesError):
            raise
        except Exception as e:
            raise QuoteError(f"{QUOTE_ERROR_MSG}: {e}") from e

    async def execute_cross_chain_swap(self, quote: dict[str, Any]) -> dict[str, Any]:
        """Execute the cross-chain swap using the provided quote.

        Args:
            quote: Quote object from calculate_cross_chain_quote

        Returns:
            Dict containing transaction information

        Raises:
            SwapError: If swap execution fails
        """
        try:
            return {
                "status": "success",
                "transaction": quote["transaction"],
                "fromAmount": quote["fromAmount"],
                "expectedOutput": quote["expectedOutput"],
                "fromChain": quote["fromChain"],
                "toChain": quote["toChain"],
            }

        except Exception as e:
            raise SwapError(f"Error executing cross-chain swap: {e}") from e

    @staticmethod
    def get_supported_networks() -> dict[str, dict[str, str]]:
        """Get supported networks for cross-chain swaps.

        Returns:
            Dictionary containing network configurations
        """
        return {
            "source": {
                "name": NETWORK_CONFIGS["flare"]["name"],
                "chainId": str(NETWORK_CONFIGS["flare"]["chain_id"]),
                "token": NETWORK_CONFIGS["flare"]["native_symbol"],
            },
            "destination": {
                "name": NETWORK_CONFIGS["arbitrum"]["name"],
                "chainId": str(NETWORK_CONFIGS["arbitrum"]["chain_id"]),
                "token": "USDC",
            },
        }
