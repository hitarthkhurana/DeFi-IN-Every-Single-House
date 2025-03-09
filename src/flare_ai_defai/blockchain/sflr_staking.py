"""
sFLR Staking Module

This module provides functions to stake FLR tokens to sFLR on Flare Network.
"""

from typing import Dict, Any, Optional
import logging
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
    deadline_minutes: int = 20
) -> Dict[str, Any]:
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
        
        # Convert amount to Wei
        amount_wei = w3.to_wei(amount, 'ether')
        
        # Create a minimal transaction - just sending FLR to the contract with the submit function selector
        # The function selector for submit() is 0x5bcb2fc6
        transaction = {
            "from": wallet_address,
            "to": SFLR_CONTRACT_ADDRESS,
            "value": str(amount_wei),
            "data": "0x5bcb2fc6",  # Function selector for submit()
            "gas": str(200000),  # Estimated gas limit
            "chainId": w3.eth.chain_id
        }
        
        return {
            "status": "success",
            "transaction": transaction,
            "message": f"Transaction prepared to stake {amount} FLR to sFLR"
        }
    except Exception as e:
        logger.error(f"Error staking FLR to sFLR: {str(e)}")
        return {
            "status": "error",
            "message": f"Failed to stake FLR to sFLR: {str(e)}"
        }

async def get_sflr_balance(
    web3_provider_url: str,
    wallet_address: str
) -> Dict[str, Any]:
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
            address=w3.to_checksum_address(SFLR_CONTRACT_ADDRESS),
            abi=SFLR_ABI
        )
        
        # Get sFLR balance
        balance_wei = sflr_contract.functions.balanceOf(wallet_address).call()
        balance = w3.from_wei(balance_wei, 'ether')
        
        return {
            "status": "success",
            "balance": float(balance),
            "message": f"sFLR Balance: {float(balance)} sFLR"
        }
    except Exception as e:
        logger.error(f"Error getting sFLR balance: {str(e)}")
        return {
            "status": "error",
            "message": f"Failed to get sFLR balance: {str(e)}"
        }

async def parse_stake_command(command: str) -> Dict[str, Any]:
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
                            "action": "stake"
                        }
                except ValueError:
                    continue
        
        if amount is None:
            return {
                "status": "error",
                "message": "Could not parse staking amount from command"
            }
            
        return {
            "status": "error",
            "message": "Invalid staking command format"
        }
    except Exception as e:
        logger.error(f"Error parsing stake command: {str(e)}")
        return {
            "status": "error",
            "message": f"Failed to parse stake command: {str(e)}"
        } 