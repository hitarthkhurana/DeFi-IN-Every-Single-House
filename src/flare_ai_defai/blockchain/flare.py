"""
Flare Network Provider Module

This module provides a FlareProvider class for interacting with the Flare Network.
It handles account management, transaction queuing, and blockchain interactions.
"""

from dataclasses import dataclass

import structlog
from eth_account import Account
from eth_typing import ChecksumAddress
from web3 import Web3
from web3.types import TxParams

from .network_config import NETWORK_CONFIGS


@dataclass
class TxQueueElement:
    """
    Represents a transaction in the queue with its associated message.

    Attributes:
        msg (str): Description or context of the transaction
        tx (TxParams): Transaction parameters
    """

    msg: str
    tx: TxParams


logger = structlog.get_logger(__name__)


class FlareProvider:
    """
    Manages interactions with the Flare Network including account
    operations and transactions.

    Attributes:
        address (ChecksumAddress | None): The account's checksum address
        w3 (Web3): Web3 instance for blockchain interactions
        logger (BoundLogger): Structured logger for the provider
    """

    def __init__(self, web3_provider_url: str) -> None:
        """Initialize the FlareProvider.

        Args:
            web3_provider_url: URL of the Web3 provider
        """
        self.w3 = Web3(Web3.HTTPProvider(web3_provider_url))
        self.network = "flare" if "flare-api" in web3_provider_url else "coston2"
        self.address: str | None = None

        # Load network configuration
        self.chain_id = NETWORK_CONFIGS[self.network]["chain_id"]
        self.native_symbol = NETWORK_CONFIGS[self.network]["native_symbol"]
        self.block_explorer = NETWORK_CONFIGS[self.network]["explorer_url"]
        self.logger = logger.bind(router="flare_provider")

    def reset(self) -> None:
        """
        Reset the provider state.
        """
        self.address = None
        self.logger.debug("reset", address=self.address)

    def generate_account(self) -> ChecksumAddress:
        """
        Generate a new Flare account.

        Returns:
            ChecksumAddress: The checksum address of the generated account
        """
        account = Account.create()
        self.private_key = account.key.hex()
        self.address = self.w3.to_checksum_address(account.address)
        self.logger.debug(
            "generate_account", address=self.address, private_key=self.private_key
        )
        return self.address

    def sign_and_send_transaction(self, tx: TxParams) -> str:
        """
        Sign and send a transaction to the network.

        Args:
            tx (TxParams): Transaction parameters to be sent

        Returns:
            str: Transaction hash of the sent transaction

        Raises:
            ValueError: If account is not initialized
        """
        if not self.private_key or not self.address:
            msg = "Account not initialized"
            raise ValueError(msg)
        signed_tx = self.w3.eth.account.sign_transaction(
            tx, private_key=self.private_key
        )
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        self.w3.eth.wait_for_transaction_receipt(tx_hash)
        self.logger.debug("sign_and_send_transaction", tx=tx)
        return "0x" + tx_hash.hex()

    def check_balance(self) -> float:
        """
        Check the balance of the current account.

        Returns:
            float: Account balance in FLR

        Raises:
            ValueError: If account does not exist
        """
        if not self.address:
            msg = "No wallet connected"
            raise ValueError(msg)
        balance_wei = self.w3.eth.get_balance(self.address)
        self.logger.debug("check_balance", balance_wei=balance_wei)
        return float(self.w3.from_wei(balance_wei, "ether"))

    def create_send_flr_tx(self, to_address: str, amount: float) -> TxParams:
        """
        Create a transaction to send FLR tokens.

        Args:
            to_address (str): Recipient address
            amount (float): Amount of FLR to send

        Returns:
            TxParams: Transaction parameters for sending FLR

        Raises:
            ValueError: If account does not exist
        """
        if not self.address:
            msg = "Account does not exist"
            raise ValueError(msg)
        tx: TxParams = {
            "from": self.address,
            "nonce": self.w3.eth.get_transaction_count(self.address),
            "to": self.w3.to_checksum_address(to_address),
            "value": self.w3.to_wei(amount, unit="ether"),
            "gas": 21000,
            "maxFeePerGas": self.w3.eth.gas_price,
            "maxPriorityFeePerGas": self.w3.eth.max_priority_fee,
            "chainId": self.w3.eth.chain_id,
            "type": 2,
        }
        return tx

    async def get_network_config(self) -> dict:
        """Get network configuration for wallet"""
        return NETWORK_CONFIGS[self.network]

    async def get_balance(self, wallet_address: str) -> float:
        """Get the native token balance for a wallet address.

        Args:
            wallet_address: The wallet address to check

        Returns:
            The balance in native token units (e.g., FLR)
        """
        try:
            balance_wei = self.w3.eth.get_balance(wallet_address)
            balance_eth = self.w3.from_wei(balance_wei, "ether")
            return float(balance_eth)
        except Exception as e:
            self.logger.exception("Error getting balance", error=str(e))
            return 0.0

    def set_address(self, address: str) -> None:
        """Set the connected wallet address.

        Args:
            address: The wallet address to set
        """
        self.address = self.w3.to_checksum_address(address)

    @staticmethod
    async def test_balance(wallet_address: str) -> float:
        """Test getting balance from a wallet address.

        Args:
            wallet_address: The wallet address to test

        Returns:
            The balance in native token units
        """
        provider = FlareProvider("https://flare-api.flare.network/ext/C/rpc")
        balance = await provider.get_balance(wallet_address)
        print(f"Balance: {balance} FLR")
        return balance
