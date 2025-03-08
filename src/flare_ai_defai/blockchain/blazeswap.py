import time
from typing import Any

from web3 import Web3


class BlazeSwapHandler:
    def __init__(self, web3_provider_url: str):
        self.w3 = Web3(Web3.HTTPProvider(web3_provider_url))

        # Set addresses based on network
        is_mainnet = "flare-api" in web3_provider_url

        if is_mainnet:
            # Flare mainnet addresses
            self.contracts = {
                "router": "0xe3A1b355ca63abCBC9589334B5e609583C7BAa06",  # BlazeSwap Router on Flare
                "factory": "0x440602f459D7Dd500a74528003e6A20A46d6e2A6"  # BlazeSwap Factory on Flare
            }
            self.tokens = {
                "FLR": "native",
                "WFLR": "0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d",  # Wrapped FLR on mainnet
                "USDC.E": "0x28a92dde19D9989F39A49905d7C9C2FAc7799bDf"  # USDC.e on Flare
            }
        else:
            # Coston2 testnet addresses

            self.tokens = {
                "C2FLR": "native",
                "WC2FLR": "0xC67DCE33D7A8efA5FfEB961899C73fe01bCe9273",  # Wrapped C2FLR
            }

        # ERC20 ABI (for approvals)
        self.erc20_abi = [
            {
                "constant": True,
                "inputs": [
                    {"name": "owner", "type": "address"},
                    {"name": "spender", "type": "address"}
                ],
                "name": "allowance",
                "outputs": [{"name": "", "type": "uint256"}],
                "payable": False,
                "stateMutability": "view",
                "type": "function"
            },
            {
                "constant": False,
                "inputs": [
                    {"name": "spender", "type": "address"},
                    {"name": "amount", "type": "uint256"}
                ],
                "name": "approve",
                "outputs": [{"name": "", "type": "bool"}],
                "payable": False,
                "stateMutability": "nonpayable",
                "type": "function"
            }
        ]

        # BlazeSwap Router ABI
        self.router_abi = [
            {
                "inputs": [
                    {"name": "amountIn", "type": "uint256"},
                    {"name": "path", "type": "address[]"}
                ],
                "name": "getAmountsOut",
                "outputs": [{"name": "amounts", "type": "uint256[]"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [
                    {"name": "amountOutMin", "type": "uint256"},
                    {"name": "path", "type": "address[]"},
                    {"name": "to", "type": "address"},
                    {"name": "deadline", "type": "uint256"}
                ],
                "name": "swapExactFLRForTokens",
                "outputs": [{"name": "amounts", "type": "uint256[]"}],
                "stateMutability": "payable",
                "type": "function"
            },
            {
                "inputs": [
                    {"name": "amountIn", "type": "uint256"},
                    {"name": "amountOutMin", "type": "uint256"},
                    {"name": "path", "type": "address[]"},
                    {"name": "to", "type": "address"},
                    {"name": "deadline", "type": "uint256"}
                ],
                "name": "swapExactTokensForTokens",
                "outputs": [{"name": "amounts", "type": "uint256[]"}],
                "stateMutability": "nonpayable",
                "type": "function"
            }
        ]

        # Add WFLR ABI at the top with other ABIs
        self.wflr_abi = [
            {
                "constant": False,
                "inputs": [],
                "name": "deposit",
                "outputs": [],
                "payable": True,
                "stateMutability": "payable",
                "type": "function"
            },
            {
                "constant": False,
                "inputs": [{"name": "wad", "type": "uint256"}],
                "name": "withdraw",
                "outputs": [],
                "payable": False,
                "stateMutability": "nonpayable",
                "type": "function"
            }
        ]

    async def prepare_swap_transaction(
        self,
        token_in: str,
        token_out: str,
        amount_in: float,
        wallet_address: str,
        router_address: str
    ) -> dict[str, Any]:
        """Prepare a swap transaction"""

        try:
            amount_in_wei = self.w3.to_wei(amount_in, "ether")

            # Special case: FLR to WFLR (wrap)
            if token_in.upper() == "FLR" and token_out.upper() == "WFLR":
                wflr_contract = self.w3.eth.contract(
                    address=self.w3.to_checksum_address(self.tokens["WFLR"]),
                    abi=self.wflr_abi
                )

                # Estimate gas for the deposit
                estimated_gas = wflr_contract.functions.deposit().estimate_gas({
                    "from": wallet_address,
                    "value": amount_in_wei
                })

                # Add 20% buffer to estimated gas
                gas_limit = int(estimated_gas * 1.2)

                tx = wflr_contract.functions.deposit().build_transaction({
                    "from": wallet_address,
                    "value": amount_in_wei,
                    "gas": gas_limit,  # Use estimated gas with buffer
                    "maxFeePerGas": self.w3.eth.gas_price * 2,  # Double the gas price for better chances
                    "maxPriorityFeePerGas": self.w3.eth.max_priority_fee,
                    "nonce": self.w3.eth.get_transaction_count(wallet_address),
                    "chainId": self.w3.eth.chain_id,
                    "type": 2  # EIP-1559 transaction type
                })

                # Convert values to hex strings for proper JSON serialization
                tx["value"] = hex(tx["value"])
                tx["gas"] = hex(tx["gas"])
                tx["maxFeePerGas"] = hex(tx["maxFeePerGas"])
                tx["maxPriorityFeePerGas"] = hex(tx["maxPriorityFeePerGas"])
                tx["nonce"] = hex(tx["nonce"])
                tx["chainId"] = hex(tx["chainId"])

                return {
                    "transaction": tx,
                    "token_in": token_in,
                    "token_out": token_out,
                    "amount_in": amount_in,
                    "min_amount_out": amount_in_wei,  # Same amount for wrapping
                    "needs_approval": False
                }

            # Convert amount to Wei
            amount_in_wei = self.w3.to_wei(amount_in, "ether")
            print(f"Debug - Amount in wei: {amount_in_wei}")

            router = self.w3.eth.contract(
                address=self.w3.to_checksum_address(router_address),
                abi=self.router_abi
            )

            # Get token addresses and handle native token correctly
            if token_in.upper() == "FLR":
                token_in_address = "native"
                print("Debug - Using native token for input")
            else:
                token_in_address = self.tokens[token_in.upper()]
                print(f"Debug - Using token address for input: {token_in_address}")

            token_out_address = self.tokens[token_out.upper()]
            print(f"Debug - Output token address: {token_out_address}")

            # Prepare the path - for FLR to USDC.e, we need to go through WFLR
            if token_in.upper() == "FLR":
                path = [self.tokens["WFLR"], token_out_address]  # FLR -> WFLR -> USDC.e
                print(f"Debug - Swap path for FLR: {path}")

                # Set deadline 20 minutes from now
                deadline = int(time.time()) + 1200

                try:
                    # Get expected output amount
                    amounts = router.functions.getAmountsOut(
                        amount_in_wei,
                        path
                    ).call()
                    print(f"Debug - Expected amounts: {amounts}")
                    min_amount_out = int(amounts[-1] * 0.99)  # 1% slippage

                    # For FLR to token swaps, use swapExactFLRForTokens
                    tx = router.functions.swapExactFLRForTokens(
                        min_amount_out,  # Now we use the calculated minimum amount
                        path,
                        wallet_address,
                        deadline
                    ).build_transaction({
                        "from": wallet_address,
                        "value": amount_in_wei,
                        "gas": 300000,
                        "maxFeePerGas": self.w3.eth.gas_price * 2,
                        "maxPriorityFeePerGas": self.w3.eth.max_priority_fee,
                        "nonce": self.w3.eth.get_transaction_count(wallet_address),
                        "chainId": self.w3.eth.chain_id,
                        "type": 2
                    })
                except Exception as e:
                    print(f"Error getting amounts out: {e!s}")
                    raise Exception("Failed to get amounts out. The pool might not exist or have enough liquidity.")
            else:
                # For all other swaps, use direct path and let BlazeSwap handle routing
                path = [token_in_address, token_out_address]

            print(f"Debug - Swap path: {path}")

            # Get chain ID
            chain_id = self.w3.eth.chain_id
            print(f"Debug - Chain ID: {chain_id}")

            # Check if approval is needed for token_in
            needs_approval = False
            if token_in.upper() != "FLR":  # Native token doesn't need approval
                token_contract = self.w3.eth.contract(
                    address=self.w3.to_checksum_address(self.tokens[token_in.upper()]),
                    abi=self.erc20_abi
                )
                current_allowance = token_contract.functions.allowance(
                    wallet_address,
                    router_address
                ).call()
                if current_allowance < amount_in_wei:
                    needs_approval = True

            if token_in.upper() == "FLR":
                # Native token swap
                tx = router.functions.swapExactFLRForTokens(
                    min_amount_out,  # Minimum amount of tokens to receive
                    path,           # Path of the swap
                    wallet_address, # Recipient address
                    deadline       # Deadline for the transaction
                ).build_transaction({
                    "from": wallet_address,
                    "value": amount_in_wei,  # Amount of native token to swap
                    "gas": 300000,
                    "gasPrice": self.w3.eth.gas_price,
                    "nonce": self.w3.eth.get_transaction_count(wallet_address),
                    "chainId": chain_id
                })
                print("Debug - Built native token swap transaction")
            else:
                # Token to token swap
                tx = router.functions.swapExactTokensForTokens(
                    amount_in_wei,
                    min_amount_out,
                    path,
                    wallet_address,
                    deadline
                ).build_transaction({
                    "from": wallet_address,
                    "value": 0,
                    "gas": 300000,
                    "gasPrice": self.w3.eth.gas_price,
                    "nonce": self.w3.eth.get_transaction_count(wallet_address),
                    "chainId": chain_id
                })
                print("Debug - Built token to token swap transaction")

            # Convert values to hex strings for proper JSON serialization
            tx["value"] = hex(tx["value"])
            tx["gas"] = hex(tx["gas"])
            tx["gasPrice"] = hex(tx["gasPrice"])
            tx["nonce"] = hex(tx["nonce"])
            tx["chainId"] = hex(tx["chainId"])

            return {
                "transaction": tx,
                "token_in": token_in,
                "token_out": token_out,
                "amount_in": amount_in,
                "min_amount_out": min_amount_out,
                "needs_approval": False
            }
        except Exception as e:
            print(f"Error building transaction: {e!s}")
            raise
