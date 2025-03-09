import time
from typing import Any

from web3 import Web3


class BlazeSwapHandler:
    def __init__(self, web3_provider_url: str):
        self.w3 = Web3(Web3.HTTPProvider(web3_provider_url))

        # Check if we're on mainnet or testnet
        chain_id = self.w3.eth.chain_id
        if chain_id == 14:  # Flare mainnet
            # Mainnet addresses
            self.contracts = {
                "router": "0xe3A1b355ca63abCBC9589334B5e609583C7BAa06",  # BlazeSwap Router on Flare
                "factory": "0x440602f459D7Dd500a74528003e6A20A46d6e2A6",  # BlazeSwap Factory on Flare
            }
            self.tokens = {
                "FLR": "native",
                "WFLR": "0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d",  # Wrapped FLR on mainnet
                "USDC.E": "0xFbDa5F676cB37624f28265A144A48B0d6e87d3b6",  # USDC.e on Flare
                "USDT": "0x0B38e83B86d491735fEaa0a791F65c2B99535396",  # USDT on Flare
                "WETH": "0x1502FA4be69d526124D453619276FacCab275d3D",  # WETH on Flare
                "FLX": "0x22757fb83836e3F9F0F353126cACD3B1Dc82a387",  # FlareFox token
            }
            # Token decimals
            self.token_decimals = {
                "FLR": 18,
                "WFLR": 18,
                "USDC.E": 6,
                "USDT": 6,
                "WETH": 18,
                "FLX": 18,
            }
        else:
            # Coston2 testnet addresses
            self.contracts = {
                "router": "0xe3A1b355ca63abCBC9589334B5e609583C7BAa06",  # BlazeSwap Router on Coston2
                "factory": "0x440602f459D7Dd500a74528003e6A20A46d6e2A6",  # BlazeSwap Factory on Coston2
            }
            self.tokens = {
                "C2FLR": "native",
                "WC2FLR": "0xC67DCE33D7A8efA5FfEB961899C73fe01bCe9273",  # Wrapped C2FLR
                "FLX": "0x22757fb83836e3F9F0F353126cACD3B1Dc82a387",  # FlareFox token
            }
            # Token decimals
            self.token_decimals = {"C2FLR": 18, "WC2FLR": 18, "FLX": 18}

        # Convert contract addresses to checksum addresses
        self.contracts["router"] = self.w3.to_checksum_address(self.contracts["router"])
        self.contracts["factory"] = self.w3.to_checksum_address(
            self.contracts["factory"]
        )

        # Convert token addresses to checksum addresses (except "native")
        for token, address in self.tokens.items():
            if address != "native":
                self.tokens[token] = self.w3.to_checksum_address(address)

        print(f"Debug - Router address: {self.contracts['router']}")
        print(f"Debug - Factory address: {self.contracts['factory']}")
        print(f"Debug - Token addresses: {self.tokens}")

        # ERC20 ABI (for approvals)
        self.erc20_abi = [
            {
                "constant": True,
                "inputs": [
                    {"name": "owner", "type": "address"},
                    {"name": "spender", "type": "address"},
                ],
                "name": "allowance",
                "outputs": [{"name": "", "type": "uint256"}],
                "payable": False,
                "stateMutability": "view",
                "type": "function",
            },
            {
                "constant": False,
                "inputs": [
                    {"name": "spender", "type": "address"},
                    {"name": "amount", "type": "uint256"},
                ],
                "name": "approve",
                "outputs": [{"name": "", "type": "bool"}],
                "payable": False,
                "stateMutability": "nonpayable",
                "type": "function",
            },
        ]

        # BlazeSwap Router ABI
        self.router_abi = [
            {
                "inputs": [
                    {"internalType": "address", "name": "_factory", "type": "address"},
                    {"internalType": "address", "name": "_wNat", "type": "address"},
                    {"internalType": "bool", "name": "_splitFee", "type": "bool"},
                ],
                "stateMutability": "nonpayable",
                "type": "constructor",
            },
            {
                "inputs": [
                    {"internalType": "address", "name": "tokenA", "type": "address"},
                    {"internalType": "address", "name": "tokenB", "type": "address"},
                    {
                        "internalType": "uint256",
                        "name": "amountADesired",
                        "type": "uint256",
                    },
                    {
                        "internalType": "uint256",
                        "name": "amountBDesired",
                        "type": "uint256",
                    },
                    {
                        "internalType": "uint256",
                        "name": "amountAMin",
                        "type": "uint256",
                    },
                    {
                        "internalType": "uint256",
                        "name": "amountBMin",
                        "type": "uint256",
                    },
                    {"internalType": "uint256", "name": "feeBipsA", "type": "uint256"},
                    {"internalType": "uint256", "name": "feeBipsB", "type": "uint256"},
                    {"internalType": "address", "name": "to", "type": "address"},
                    {"internalType": "uint256", "name": "deadline", "type": "uint256"},
                ],
                "name": "addLiquidity",
                "outputs": [
                    {"internalType": "uint256", "name": "amountA", "type": "uint256"},
                    {"internalType": "uint256", "name": "amountB", "type": "uint256"},
                    {"internalType": "uint256", "name": "liquidity", "type": "uint256"},
                ],
                "stateMutability": "nonpayable",
                "type": "function",
            },
            {
                "inputs": [
                    {"internalType": "address", "name": "token", "type": "address"},
                    {
                        "internalType": "uint256",
                        "name": "amountTokenDesired",
                        "type": "uint256",
                    },
                    {
                        "internalType": "uint256",
                        "name": "amountTokenMin",
                        "type": "uint256",
                    },
                    {
                        "internalType": "uint256",
                        "name": "amountNATMin",
                        "type": "uint256",
                    },
                    {
                        "internalType": "uint256",
                        "name": "feeBipsToken",
                        "type": "uint256",
                    },
                    {"internalType": "address", "name": "to", "type": "address"},
                    {"internalType": "uint256", "name": "deadline", "type": "uint256"},
                ],
                "name": "addLiquidityNAT",
                "outputs": [
                    {
                        "internalType": "uint256",
                        "name": "amountToken",
                        "type": "uint256",
                    },
                    {"internalType": "uint256", "name": "amountNAT", "type": "uint256"},
                    {"internalType": "uint256", "name": "liquidity", "type": "uint256"},
                ],
                "stateMutability": "payable",
                "type": "function",
            },
            {
                "inputs": [
                    {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
                    {"internalType": "address[]", "name": "path", "type": "address[]"},
                ],
                "name": "getAmountsOut",
                "outputs": [
                    {
                        "internalType": "uint256[]",
                        "name": "amounts",
                        "type": "uint256[]",
                    }
                ],
                "stateMutability": "view",
                "type": "function",
            },
            {
                "inputs": [
                    {
                        "internalType": "uint256",
                        "name": "amountOutMin",
                        "type": "uint256",
                    },
                    {"internalType": "address[]", "name": "path", "type": "address[]"},
                    {"internalType": "address", "name": "to", "type": "address"},
                    {"internalType": "uint256", "name": "deadline", "type": "uint256"},
                ],
                "name": "swapExactNATForTokens",
                "outputs": [
                    {
                        "internalType": "uint256[]",
                        "name": "amountsSent",
                        "type": "uint256[]",
                    },
                    {
                        "internalType": "uint256[]",
                        "name": "amountsRecv",
                        "type": "uint256[]",
                    },
                ],
                "stateMutability": "payable",
                "type": "function",
            },
            {
                "inputs": [
                    {
                        "internalType": "uint256",
                        "name": "amountOutMin",
                        "type": "uint256",
                    },
                    {"internalType": "address[]", "name": "path", "type": "address[]"},
                    {"internalType": "address", "name": "to", "type": "address"},
                    {"internalType": "uint256", "name": "deadline", "type": "uint256"},
                ],
                "name": "swapExactTokensForTokens",
                "outputs": [
                    {
                        "internalType": "uint256[]",
                        "name": "amountsSent",
                        "type": "uint256[]",
                    },
                    {
                        "internalType": "uint256[]",
                        "name": "amountsRecv",
                        "type": "uint256[]",
                    },
                ],
                "stateMutability": "nonpayable",
                "type": "function",
            },
            {
                "inputs": [
                    {
                        "internalType": "uint256",
                        "name": "amountOutMin",
                        "type": "uint256",
                    },
                    {"internalType": "address[]", "name": "path", "type": "address[]"},
                    {"internalType": "address", "name": "to", "type": "address"},
                    {"internalType": "uint256", "name": "deadline", "type": "uint256"},
                ],
                "name": "swapExactTokensForNAT",
                "outputs": [
                    {
                        "internalType": "uint256[]",
                        "name": "amountsSent",
                        "type": "uint256[]",
                    },
                    {
                        "internalType": "uint256[]",
                        "name": "amountsRecv",
                        "type": "uint256[]",
                    },
                ],
                "stateMutability": "nonpayable",
                "type": "function",
            },
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
                "type": "function",
            },
            {
                "constant": False,
                "inputs": [{"name": "wad", "type": "uint256"}],
                "name": "withdraw",
                "outputs": [],
                "payable": False,
                "stateMutability": "nonpayable",
                "type": "function",
            },
        ]

    async def prepare_swap_transaction(
        self,
        token_in: str,
        token_out: str,
        amount_in: float,
        wallet_address: str,
        router_address: str,
    ) -> dict[str, Any]:
        """Prepare a swap transaction"""

        try:
            print(f"Debug - Preparing swap: {amount_in} {token_in} to {token_out}")
            print(f"Debug - Available tokens: {list(self.tokens.keys())}")

            # Special case: FLR to WFLR (wrap)
            if token_in.upper() == "FLR" and token_out.upper() == "WFLR":
                amount_in_wei = self.w3.to_wei(amount_in, "ether")
                wflr_contract = self.w3.eth.contract(
                    address=self.w3.to_checksum_address(self.tokens["WFLR"]),
                    abi=self.wflr_abi,
                )

                # Estimate gas for the deposit
                estimated_gas = wflr_contract.functions.deposit().estimate_gas(
                    {"from": wallet_address, "value": amount_in_wei}
                )

                # Add 20% buffer to estimated gas
                gas_limit = int(estimated_gas * 1.2)

                tx = wflr_contract.functions.deposit().build_transaction(
                    {
                        "from": wallet_address,
                        "value": amount_in_wei,
                        "gas": gas_limit,  # Use estimated gas with buffer
                        "maxFeePerGas": self.w3.eth.gas_price
                        * 2,  # Double the gas price for better chances
                        "maxPriorityFeePerGas": self.w3.eth.max_priority_fee,
                        "nonce": self.w3.eth.get_transaction_count(wallet_address),
                        "chainId": self.w3.eth.chain_id,
                        "type": 2,  # EIP-1559 transaction type
                    }
                )

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
                    "needs_approval": False,
                }

            # Convert amount to Wei
            amount_in_wei = self.w3.to_wei(amount_in, "ether")
            print(f"Debug - Amount in wei: {amount_in_wei}")

            router = self.w3.eth.contract(
                address=self.w3.to_checksum_address(router_address), abi=self.router_abi
            )

            # Get token addresses and handle native token correctly
            if token_in.upper() == "FLR":
                token_in_address = "native"
                print("Debug - Using native token for input")
            else:
                # Make sure the token is in the tokens dictionary
                if token_in.upper() not in self.tokens:
                    raise ValueError(
                        f"Unsupported input token: {token_in}. Supported tokens: {', '.join(self.tokens.keys())}"
                    )
                token_in_address = self.tokens[token_in.upper()]
                print(f"Debug - Using token address for input: {token_in_address}")

            # Make sure the output token is in the tokens dictionary
            if token_out.upper() not in self.tokens:
                raise ValueError(
                    f"Unsupported output token: {token_out}. Supported tokens: {', '.join(self.tokens.keys())}"
                )
            token_out_address = self.tokens[token_out.upper()]
            print(f"Debug - Output token address: {token_out_address}")

            # Set deadline 20 minutes from now
            deadline = int(time.time()) + 1200

            # Prepare the path and transaction based on token types
            if token_in.upper() == "FLR":
                # For FLR to any token, we need to go through WFLR
                path = [self.tokens["WFLR"], token_out_address]  # FLR -> WFLR -> token
                print(f"Debug - Swap path for FLR: {path}")

                try:
                    # Get expected output amount
                    amounts = router.functions.getAmountsOut(amount_in_wei, path).call()
                    print(f"Debug - Expected amounts: {amounts}")
                    min_amount_out = int(amounts[-1] * 0.95)  # 5% slippage
                    print(f"Debug - Min amount out: {min_amount_out}")

                    # For FLR to token swaps, use swapExactNATForTokens
                    tx = router.functions.swapExactNATForTokens(
                        min_amount_out,  # Minimum amount to receive
                        path,
                        wallet_address,
                        deadline,
                    ).build_transaction(
                        {
                            "from": wallet_address,
                            "value": amount_in_wei,
                            "gas": 3000000,
                            "maxFeePerGas": self.w3.eth.gas_price * 2,
                            "maxPriorityFeePerGas": self.w3.eth.max_priority_fee,
                            "nonce": self.w3.eth.get_transaction_count(wallet_address),
                            "chainId": self.w3.eth.chain_id,
                            "type": 2,
                        }
                    )
                    print("Debug - Built native token swap transaction")
                except Exception as e:
                    print(f"Error getting amounts out: {e!s}")
                    raise Exception(
                        f"Failed to get amounts out. The pool might not exist or have enough liquidity. Error: {e!s}"
                    )
            elif token_out.upper() == "FLR":
                # For token to FLR swaps, use swapExactTokensForNAT
                path = [token_in_address, self.tokens["WFLR"]]  # token -> WFLR -> FLR
                print(f"Debug - Swap path for token to FLR: {path}")

                try:
                    # Get expected output amount
                    amounts = router.functions.getAmountsOut(amount_in_wei, path).call()
                    print(f"Debug - Expected amounts: {amounts}")
                    min_amount_out = int(amounts[-1] * 0.95)  # 5% slippage
                    print(f"Debug - Min amount out: {min_amount_out}")

                    # For token to FLR swaps, use swapExactTokensForNAT
                    tx = router.functions.swapExactTokensForNAT(
                        min_amount_out, path, wallet_address, deadline
                    ).build_transaction(
                        {
                            "from": wallet_address,
                            "value": 0,
                            "gas": 300000,
                            "maxFeePerGas": self.w3.eth.gas_price * 2,
                            "maxPriorityFeePerGas": self.w3.eth.max_priority_fee,
                            "nonce": self.w3.eth.get_transaction_count(wallet_address),
                            "chainId": self.w3.eth.chain_id,
                            "type": 2,
                        }
                    )
                    print("Debug - Built token to NAT swap transaction")
                except Exception as e:
                    print(f"Error getting amounts out: {e!s}")
                    raise Exception(
                        f"Failed to get amounts out. The pool might not exist or have enough liquidity. Error: {e!s}"
                    )
            else:
                # For token to token swaps
                path = [token_in_address, token_out_address]
                print(f"Debug - Swap path for token to token: {path}")

                try:
                    # Get expected output amount
                    amounts = router.functions.getAmountsOut(amount_in_wei, path).call()
                    print(f"Debug - Expected amounts: {amounts}")
                    min_amount_out = int(amounts[-1] * 0.95)  # 5% slippage
                    print(f"Debug - Min amount out: {min_amount_out}")

                    # For token to token swaps, use swapExactTokensForTokens
                    tx = router.functions.swapExactTokensForTokens(
                        min_amount_out,  # Use only the minimum amount out parameter
                        path,
                        wallet_address,
                        deadline,
                    ).build_transaction(
                        {
                            "from": wallet_address,
                            "value": 0,
                            "gas": 300000,
                            "maxFeePerGas": self.w3.eth.gas_price * 2,
                            "maxPriorityFeePerGas": self.w3.eth.max_priority_fee,
                            "nonce": self.w3.eth.get_transaction_count(wallet_address),
                            "chainId": self.w3.eth.chain_id,
                            "type": 2,
                        }
                    )
                    print("Debug - Built token to token swap transaction")
                except Exception as e:
                    print(f"Error getting amounts out: {e!s}")
                    raise Exception(
                        f"Failed to get amounts out. The pool might not exist or have enough liquidity. Error: {e!s}"
                    )

            # Convert values to hex strings for proper JSON serialization
            tx["value"] = hex(tx["value"])
            tx["gas"] = hex(tx["gas"])
            tx["maxFeePerGas"] = hex(tx["maxFeePerGas"])
            tx["maxPriorityFeePerGas"] = hex(tx["maxPriorityFeePerGas"])
            tx["nonce"] = hex(tx["nonce"])
            tx["chainId"] = hex(tx["chainId"])
            tx["type"] = "0x2"

            # Check if approval is needed for token_in
            needs_approval = False
            if token_in.upper() != "FLR":  # Native token doesn't need approval
                token_contract = self.w3.eth.contract(
                    address=self.w3.to_checksum_address(token_in_address),
                    abi=self.erc20_abi,
                )
                current_allowance = token_contract.functions.allowance(
                    wallet_address, router_address
                ).call()
                if current_allowance < amount_in_wei:
                    needs_approval = True

            return {
                "transaction": tx,
                "token_in": token_in,
                "token_out": token_out,
                "amount_in": amount_in,
                "min_amount_out": min_amount_out,
                "needs_approval": needs_approval,
            }
        except Exception as e:
            print(f"Error building transaction: {e!s}")
            raise

    async def prepare_add_liquidity_nat_transaction(
        self,
        token: str,
        amount_token: float,
        amount_flr: float,
        wallet_address: str,
        router_address: str,
    ) -> dict[str, Any]:
        """
        Prepare a transaction to add liquidity with native FLR and a token.

        Args:
            token: The token symbol (e.g., 'USDC.E')
            amount_token: Amount of token to add
            amount_flr: Amount of FLR to add
            wallet_address: User's wallet address
            router_address: BlazeSwap router address
        """
        try:
            # 1. Input validation and address formatting
            wallet_address = self.w3.to_checksum_address(wallet_address)
            router_address = self.w3.to_checksum_address(router_address)

            # 2. Get token details
            token_address = self.w3.to_checksum_address(self.tokens[token.upper()])
            token_decimals = self.token_decimals.get(token.upper(), 18)

            # 3. Convert amounts to contract units (wei/smallest unit)
            # For FLR: 1 FLR = 10^18 wei
            amount_flr_wei = self.w3.to_wei(amount_flr, "ether")

            # For tokens: Convert based on decimals
            if token.upper() == "USDC.E":
                # USDC.E uses 6 decimals
                amount_token_wei = int(amount_token * (10**6))
            else:
                amount_token_wei = int(amount_token * (10**token_decimals))

            # 4. Calculate minimum amounts (using 0.5% slippage)
            slippage = 0.005  # 0.5%
            amount_token_min = int(amount_token_wei * (1 - slippage))
            amount_flr_min = int(amount_flr_wei * (1 - slippage))

            # 5. Set deadline (20 minutes from now)
            deadline = int(time.time()) + 1200

            # 6. Check token approval
            token_contract = self.w3.eth.contract(
                address=token_address, abi=self.erc20_abi
            )

            current_allowance = token_contract.functions.allowance(
                wallet_address, router_address
            ).call()

            needs_approval = current_allowance < amount_token_wei

            # 7. Prepare approval transaction if needed
            approval_tx = None
            if needs_approval:
                approval_tx = token_contract.functions.approve(
                    router_address, amount_token_wei
                ).build_transaction(
                    {
                        "from": wallet_address,
                        "gas": 100000,
                        "maxFeePerGas": self.w3.eth.gas_price * 2,
                        "maxPriorityFeePerGas": self.w3.eth.max_priority_fee,
                        "nonce": self.w3.eth.get_transaction_count(wallet_address),
                        "chainId": self.w3.eth.chain_id,
                        "type": 2,
                    }
                )

            # 8. Prepare add liquidity transaction
            router = self.w3.eth.contract(address=router_address, abi=self.router_abi)

            add_liquidity_tx = router.functions.addLiquidityNAT(
                token_address,  # token address
                amount_token_wei,  # amount token desired
                amount_token_min,  # amount token min
                amount_flr_min,  # amount FLR min
                0,  # fee bips token (0 for no fee)
                wallet_address,  # to address
                deadline,  # deadline
            ).build_transaction(
                {
                    "from": wallet_address,
                    "value": amount_flr_wei,  # Native FLR amount
                    "gas": 300000,
                    "maxFeePerGas": self.w3.eth.gas_price * 2,
                    "maxPriorityFeePerGas": self.w3.eth.max_priority_fee,
                    "nonce": self.w3.eth.get_transaction_count(wallet_address)
                    + (1 if needs_approval else 0),
                    "chainId": self.w3.eth.chain_id,
                    "type": 2,
                }
            )

            # Format transactions for return
            formatted_txs = []

            if needs_approval:
                formatted_txs.append(
                    {
                        "tx": self._format_tx_for_json(approval_tx),
                        "description": f"Approve {amount_token} {token}",
                    }
                )

            formatted_txs.append(
                {
                    "tx": self._format_tx_for_json(add_liquidity_tx),
                    "description": f"Add liquidity: {amount_token} {token} + {amount_flr} FLR",
                }
            )

            # Return transaction details
            return {
                "transactions": formatted_txs,
                "token": token,
                "amount_token": amount_token,
                "amount_flr": amount_flr,
                "amount_token_min": amount_token_min
                / (10 ** (6 if token.upper() == "USDC.E" else token_decimals)),
                "amount_flr_min": self.w3.from_wei(amount_flr_min, "ether"),
                "needs_approval": needs_approval,
            }

        except Exception as e:
            print(f"Error preparing add liquidity NAT transaction: {e!s}")
            raise

    async def prepare_add_liquidity_transaction(
        self,
        token_a: str,
        token_b: str,
        amount_a: float,
        amount_b: float,
        wallet_address: str,
        router_address: str,
    ) -> dict[str, Any]:
        """
        Prepare a transaction to add liquidity with two tokens.

        Args:
            token_a: First token symbol
            token_b: Second token symbol
            amount_a: Amount of first token
            amount_b: Amount of second token
            wallet_address: User's wallet address
            router_address: BlazeSwap router address
        """
        try:
            # 1. Input validation and address formatting
            wallet_address = self.w3.to_checksum_address(wallet_address)
            router_address = self.w3.to_checksum_address(router_address)

            # 2. Get token details
            token_a_address = self.w3.to_checksum_address(self.tokens[token_a.upper()])
            token_b_address = self.w3.to_checksum_address(self.tokens[token_b.upper()])

            token_a_decimals = self.token_decimals.get(token_a.upper(), 18)
            token_b_decimals = self.token_decimals.get(token_b.upper(), 18)

            # 3. Convert amounts to contract units (wei/smallest unit)
            # Handle USDC.E special case (6 decimals)
            if token_a.upper() == "USDC.E":
                amount_a_wei = int(amount_a * (10**6))
            else:
                amount_a_wei = int(amount_a * (10**token_a_decimals))

            if token_b.upper() == "USDC.E":
                amount_b_wei = int(amount_b * (10**6))
            else:
                amount_b_wei = int(amount_b * (10**token_b_decimals))

            # 4. Calculate minimum amounts (using 0.5% slippage)
            slippage = 0.005  # 0.5%
            amount_a_min = int(amount_a_wei * (1 - slippage))
            amount_b_min = int(amount_b_wei * (1 - slippage))

            # 5. Set deadline (20 minutes from now)
            deadline = int(time.time()) + 1200

            # 6. Check approvals
            token_a_contract = self.w3.eth.contract(
                address=token_a_address, abi=self.erc20_abi
            )

            token_b_contract = self.w3.eth.contract(
                address=token_b_address, abi=self.erc20_abi
            )

            allowance_a = token_a_contract.functions.allowance(
                wallet_address, router_address
            ).call()

            allowance_b = token_b_contract.functions.allowance(
                wallet_address, router_address
            ).call()

            needs_approval_a = allowance_a < amount_a_wei
            needs_approval_b = allowance_b < amount_b_wei

            # 7. Prepare approval transactions if needed
            formatted_txs = []
            nonce = self.w3.eth.get_transaction_count(wallet_address)

            if needs_approval_a:
                approval_a_tx = token_a_contract.functions.approve(
                    router_address, amount_a_wei
                ).build_transaction(
                    {
                        "from": wallet_address,
                        "gas": 50000,  # Reduced gas for approval
                        "maxFeePerGas": self.w3.eth.gas_price * 2,
                        "maxPriorityFeePerGas": int(self.w3.eth.max_priority_fee * 0.1),
                        "nonce": nonce,
                        "chainId": self.w3.eth.chain_id,
                        "type": 2,
                    }
                )
                formatted_txs.append(
                    {
                        "tx": self._format_tx_for_json(approval_a_tx),
                        "description": f"Approve {amount_a} {token_a}",
                    }
                )
                nonce += 1

            if needs_approval_b:
                approval_b_tx = token_b_contract.functions.approve(
                    router_address, amount_b_wei
                ).build_transaction(
                    {
                        "from": wallet_address,
                        "gas": 50000,  # Reduced gas for approval
                        "maxFeePerGas": self.w3.eth.gas_price * 2,
                        "maxPriorityFeePerGas": int(self.w3.eth.max_priority_fee * 0.1),
                        "nonce": nonce,
                        "chainId": self.w3.eth.chain_id,
                        "type": 2,
                    }
                )
                formatted_txs.append(
                    {
                        "tx": self._format_tx_for_json(approval_b_tx),
                        "description": f"Approve {amount_b} {token_b}",
                    }
                )
                nonce += 1

            # 8. Prepare add liquidity transaction
            router = self.w3.eth.contract(address=router_address, abi=self.router_abi)

            add_liquidity_tx = router.functions.addLiquidity(
                token_a_address,  # tokenA (FLX)
                token_b_address,  # tokenB (USDC.E)
                amount_a_wei,  # amountADesired
                amount_b_wei,  # amountBDesired
                int(amount_a_wei * 0.998),  # amountAMin (0.2% slippage for FLX)
                0,  # amountBMin (0 for USDC.E as per successful tx)
                300,  # feeBipsA (300 for FLX)
                0,  # feeBipsB (0 for USDC.E)
                wallet_address,  # to
                int(time.time() + 86400),  # deadline (24 hours as per successful tx)
            ).build_transaction(
                {
                    "from": wallet_address,
                    "value": 0,
                    "gas": 2891350,  # Exact gas limit from successful transaction
                    "maxFeePerGas": self.w3.eth.gas_price
                    * 2,  # Base * 2 to get 50 max fee
                    "maxPriorityFeePerGas": int(
                        self.w3.eth.max_priority_fee * 0.1
                    ),  # Reduced to get 2.50 max priority
                    "nonce": nonce,
                    "chainId": self.w3.eth.chain_id,
                    "type": 2,
                }
            )

            formatted_txs.append(
                {
                    "tx": self._format_tx_for_json(add_liquidity_tx),
                    "description": f"Add liquidity: {amount_a} {token_a} + {amount_b} {token_b}",
                }
            )

            # Return transaction details
            return {
                "transactions": formatted_txs,
                "token_a": token_a,
                "token_b": token_b,
                "amount_a": amount_a,
                "amount_b": amount_b,
                "amount_a_min": amount_a_min
                / (10 ** (6 if token_a.upper() == "USDC.E" else token_a_decimals)),
                "amount_b_min": amount_b_min
                / (10 ** (6 if token_b.upper() == "USDC.E" else token_b_decimals)),
                "needs_approval_a": needs_approval_a,
                "needs_approval_b": needs_approval_b,
            }

        except Exception as e:
            print(f"Error preparing add liquidity transaction: {e!s}")
            raise

    def _format_tx_for_json(self, tx: dict) -> dict:
        """Helper method to format transaction for JSON serialization"""
        return {
            "from": tx["from"],
            "to": tx["to"],
            "value": hex(tx["value"]),
            "data": tx["data"],
            "gas": hex(tx["gas"]),
            "maxFeePerGas": hex(tx["maxFeePerGas"]),
            "maxPriorityFeePerGas": hex(tx["maxPriorityFeePerGas"]),
            "nonce": hex(tx["nonce"]),
            "chainId": hex(tx["chainId"]),
            "type": "0x2",
        }
