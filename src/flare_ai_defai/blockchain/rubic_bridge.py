from typing import Dict, Any, Optional
from web3 import Web3
from .network_config import NETWORK_CONFIGS

class RubicBridge:
    def __init__(self, wallet_address: str):
        self.wallet_address = wallet_address
        self.flare_rpc = NETWORK_CONFIGS['flare']['rpc_url']
        self.arbitrum_rpc = NETWORK_CONFIGS['arbitrum']['rpc_url']
        
        # Token addresses
        self.flr_address = '0x0000000000000000000000000000000000000000'  # Native FLR
        self.usdc_arbitrum = '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8'  # USDC on Arbitrum
    
    async def calculate_cross_chain_quote(self, amount: float) -> Dict[str, Any]:
        """
        Calculate cross-chain quote for FLR to USDC swap
        
        Args:
            amount: Amount of FLR to swap
            
        Returns:
            Dict containing quote information
        """
        try:
            from rubic_sdk import SDK, Configuration, BLOCKCHAIN_NAME, CHAIN_TYPE
            
            config = Configuration({
                'rpcProviders': {
                    BLOCKCHAIN_NAME.FLARE: {
                        'rpcList': [self.flare_rpc]
                    },
                    BLOCKCHAIN_NAME.ARBITRUM: {
                        'rpcList': [self.arbitrum_rpc]
                    }
                },
                'walletProvider': {
                    CHAIN_TYPE.EVM: {
                        'address': self.wallet_address,
                        'core': None  # Will be set by frontend
                    }
                }
            })
            
            sdk = await SDK.createSDK(config)
            
            # Convert amount to Wei for the SDK
            amount_wei = Web3.to_wei(amount, 'ether')
            
            trades = await sdk.crossChainManager.calculateTrade(
                {
                    'blockchain': BLOCKCHAIN_NAME.FLARE,
                    'address': self.flr_address,
                    'decimals': 18
                },
                amount_wei,
                {
                    'blockchain': BLOCKCHAIN_NAME.ARBITRUM,
                    'address': self.usdc_arbitrum,
                    'decimals': 6  # USDC has 6 decimals
                }
            )
            
            if not trades or not trades[0] or trades[0].error:
                error_msg = trades[0].error if trades and trades[0] else 'No routes available'
                raise Exception(f"No valid routes found: {error_msg}")
                
            best_trade = trades[0].trade
            
            return {
                'fromToken': 'FLR',
                'toToken': 'USDC',
                'fromAmount': amount,
                'expectedOutput': float(best_trade.to.tokenAmount.toFormat(6)),
                'trade': best_trade,
                'fromChain': NETWORK_CONFIGS['flare']['name'],
                'toChain': NETWORK_CONFIGS['arbitrum']['name'],
                'transaction': best_trade.transaction  # Include transaction data
            }
            
        except Exception as e:
            raise Exception(f"Error calculating cross-chain quote: {str(e)}")
    
    async def execute_cross_chain_swap(self, quote: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute the cross-chain swap using the provided quote
        
        Args:
            quote: Quote object from calculate_cross_chain_quote
            
        Returns:
            Dict containing transaction information
        """
        try:
            trade = quote['trade']
            
            # The transaction data is already prepared in the quote
            return {
                'status': 'success',
                'transaction': quote['transaction'],
                'fromAmount': quote['fromAmount'],
                'expectedOutput': quote['expectedOutput'],
                'fromChain': quote['fromChain'],
                'toChain': quote['toChain']
            }
            
        except Exception as e:
            raise Exception(f"Error executing cross-chain swap: {str(e)}")

    @staticmethod
    def get_supported_networks() -> Dict[str, Dict[str, str]]:
        """Get supported networks for cross-chain swaps"""
        return {
            'source': {
                'name': NETWORK_CONFIGS['flare']['name'],
                'chainId': str(NETWORK_CONFIGS['flare']['chain_id']),
                'token': NETWORK_CONFIGS['flare']['native_symbol']
            },
            'destination': {
                'name': NETWORK_CONFIGS['arbitrum']['name'],
                'chainId': str(NETWORK_CONFIGS['arbitrum']['chain_id']),
                'token': 'USDC'
            }
        } 