"""
sFLR Staking Module

This module provides functions to stake FLR tokens to sFLR on Flare Network.
"""

import logging
from typing import Any

from web3 import Web3

from flare_ai_defai.blockchain.abis.sflr import SFLR_ABI

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# sFLR contract address on Flare Network
SFLR_CONTRACT_ADDRESS = "0x12e605bc104e93B45e1aD99F9e555f659051c2BB"


def stake_flr_to_sflr(
    web3_provider_url: str,
    wallet_address: str,
    amount: float,
    deadline_minutes: int = 20,
) -> dict[str, Any]:
    """
    Stake FLR tokens to sFLR using the submit function.

    Args:
        web3_provider_url: URL of the Web3 provider
        wallet_address: Address of the wallet to stake from
        amount: Amount of FLR to stake
        deadline_minutes: Transaction deadline in minutes

    Returns:
        Dict containing transaction details
    """
    try:
        # Initialize Web3
        w3 = Web3(Web3.HTTPProvider(web3_provider_url))

        # Convert wallet address to checksum address
        wallet_address = w3.to_checksum_address(wallet_address)
        contract_address = w3.to_checksum_address(SFLR_CONTRACT_ADDRESS)

        # Initialize the contract
        contract = w3.eth.contract(address=contract_address, abi=SFLR_ABI)

        # Convert amount to Wei
        amount_wei = w3.to_wei(amount, "ether")

        # Get the nonce
        nonce = w3.eth.get_transaction_count(wallet_address)

        # Build the transaction using contract function
        transaction = contract.functions.submit().build_transaction({
            "from": wallet_address,
            "value": amount_wei,  # Amount of FLR to stake
            "gas": 300000,  # Higher gas limit for safety
            "maxFeePerGas": w3.eth.gas_price * 2,  # Double gas price for better chances
            "maxPriorityFeePerGas": w3.eth.max_priority_fee,
            "nonce": nonce,
            "chainId": w3.eth.chain_id,
            "type": 2,  # EIP-1559 transaction type
        })

        # Convert numeric values to hex strings for JSON serialization
        transaction["value"] = hex(transaction["value"])
        transaction["gas"] = hex(transaction["gas"])
        transaction["maxFeePerGas"] = hex(transaction["maxFeePerGas"])
        transaction["maxPriorityFeePerGas"] = hex(transaction["maxPriorityFeePerGas"])
        transaction["nonce"] = hex(transaction["nonce"])
        transaction["chainId"] = hex(transaction["chainId"])
        transaction["type"] = "0x2"

        return {
            "status": "success",
            "transaction": transaction,
            "message": f"Transaction prepared to stake {amount} FLR to sFLR",
        }
    except Exception as e:
        logger.error(f"Error staking FLR to sFLR: {e!s}")
        return {"status": "error", "message": f"Failed to stake FLR to sFLR: {e!s}"}


async def get_sflr_balance(
    web3_provider_url: str, wallet_address: str
) -> dict[str, Any]:
    """
    Get the sFLR balance of a wallet.

    Args:
        web3_provider_url: URL of the Web3 provider
        wallet_address: Address of the wallet to check

    Returns:
        Dict containing balance details
    """
    try:
        # Initialize Web3
        w3 = Web3(Web3.HTTPProvider(web3_provider_url))

        # Convert wallet address to checksum address
        wallet_address = w3.to_checksum_address(wallet_address)

        # Initialize sFLR contract
        sflr_contract = w3.eth.contract(
            address=w3.to_checksum_address(SFLR_CONTRACT_ADDRESS), abi=SFLR_ABI
        )

        # Get sFLR balance
        balance_wei = sflr_contract.functions.balanceOf(wallet_address).call()
        balance = w3.from_wei(balance_wei, "ether")

        return {
            "status": "success",
            "balance": float(balance),
            "message": f"sFLR Balance: {float(balance)} sFLR",
        }
    except Exception as e:
        logger.error(f"Error getting sFLR balance: {e!s}")
        return {"status": "error", "message": f"Failed to get sFLR balance: {e!s}"}


async def parse_stake_command(command: str) -> dict[str, Any]:
    """
    Parse a staking command from natural language.

    Args:
        command: Natural language command for staking

    Returns:
        Dict containing parsed staking parameters
    """
    try:
        # Split the command into words
        words = command.lower().split()

        # Look for patterns like "stake 1 flr" or "stake 2.5 flr to sflr"
        amount = None
        for i, word in enumerate(words):
            if word == "stake" and i + 2 < len(words):
                try:
                    amount = float(words[i + 1])
                    # Verify the token is FLR
                    if words[i + 2].lower() in ["flr", "flare"]:
                        return {
                            "status": "success",
                            "amount": amount,
                            "token": "FLR",
                            "action": "stake",
                        }
                except ValueError:
                    continue

        if amount is None:
            return {
                "status": "error",
                "message": "Could not parse staking amount from command",
            }

        return {"status": "error", "message": "Invalid staking command format"}
    except Exception as e:
        logger.error(f"Error parsing stake command: {e!s}")
        return {"status": "error", "message": f"Failed to parse stake command: {e!s}"}
