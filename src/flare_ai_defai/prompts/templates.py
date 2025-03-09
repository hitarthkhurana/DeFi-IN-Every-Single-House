"""Templates for various prompt types used in the application."""

from typing import Final

SEMANTIC_ROUTER: Final = """
Classify the following user input into EXACTLY ONE category. Analyze carefully and choose the most specific matching category.

Categories (in order of precedence):
1. STAKE_FLR
   • Keywords: stake, staking, deposit to sFLR, earn rewards
   • Must involve staking FLR tokens to get sFLR
   • Examples: "stake 10 FLR", "I want to stake my FLR tokens"
   • Should match any message starting with "stake" followed by a number and FLR/FLARE

2. CHECK_BALANCE
   • Keywords: balance, check balance, show balance
   • Must express intent to check account/token balance
   • Includes commands like /balance, balance, check balance

3. SEND_TOKEN
   • Keywords: send, transfer, pay, give tokens
   • Must include intent to transfer tokens to another address
   • Should involve one-way token movement

4. CROSS_CHAIN_SWAP
   • Keywords: cross-chain, bridge, swap to arbitrum, convert to another chain
   • Must involve exchanging tokens across different blockchains
   • Should mention source chain (Flare) and destination chain (Arbitrum)
   • Examples: "swap FLR to USDC on ARB", "bridge FLR to Arbitrum"

5. SWAP_TOKEN
   • Keywords: swap, exchange, trade, convert tokens
   • Must involve exchanging one token type for another on the same chain
   • Should mention both source and target tokens
   • Must NOT mention different chains or bridges

6. ADD_LIQUIDITY_NAT
   • Keywords: add liquidity, provide liquidity, LP, pool
   • Must involve adding native FLR and a token to a liquidity pool
   • Examples: "add liquidity with 1 FLR and 100 USDC", "provide liquidity to FLR/USDC pool"

7. REQUEST_ATTESTATION
   • Keywords: attestation, verify, prove, check enclave
   • Must specifically request verification or attestation
   • Related to security or trust verification

8. CONVERSATIONAL (default)
   • Use when input doesn't clearly match above categories
   • General questions, greetings, or unclear requests
   • Any ambiguous or multi-category inputs

Input: ${user_input}

Instructions:
- Choose ONE category only
- Select most specific matching category
- Default to CONVERSATIONAL if unclear
- Ignore politeness phrases or extra context
- Focus on core intent of request
- For swaps, check if it mentions different chains
"""

GENERATE_ACCOUNT: Final = """
Generate a welcoming message that includes ALL of these elements in order:

1. Welcome message that conveys enthusiasm for the user joining
2. Security explanation:
   - Account is secured in a Trusted Execution Environment (TEE)
   - Private keys never leave the secure enclave
   - Hardware-level protection against tampering
3. Account address display:
   - EXACTLY as provided: ${address}
   - Format with clear visual separation
4. Funding account instructions:
   - Tell the user to fund the new account: [Add funds to account](${faucet_url})

Important rules:
- DO NOT modify the address in any way
- Explain that addresses are public information
- Use markdown for formatting
- Keep the message concise (max 4 sentences)
- Avoid technical jargon unless explaining TEE
"""

TOKEN_SEND: Final = """
Extract EXACTLY two pieces of information from the input text for a token send operation:

1. DESTINATION ADDRESS
   Required format:
   • Must start with "0x"
   • Exactly 42 characters long
   • Hexadecimal characters only (0-9, a-f, A-F)
   • Extract COMPLETE address only
   • DO NOT modify or truncate
   • FAIL if no valid address found

2. TOKEN AMOUNT
   Number extraction rules:
   • Convert written numbers to digits (e.g., "five" → 5)
   • Handle decimals and integers
   • Convert ALL integers to float (e.g., 100 → 100.0)
   • Recognize common amount formats:
     - Decimal: "1.5", "0.5"
     - Integer: "1", "100"
     - With words: "5 tokens", "10 FLR"
   • Extract first valid number only
   • FAIL if no valid amount found

Input: ${user_input}

Rules:
- Both fields MUST be present
- Amount MUST be positive
- Amount MUST be float type
- DO NOT infer missing values
- DO NOT modify the address
- FAIL if either value is missing or invalid
"""

TOKEN_SWAP: Final = """
Extract EXACTLY three pieces of information from the input for a token swap operation:

1. SOURCE TOKEN (from_token)
   Valid formats:
   • Native token: "FLR" or "flr"
   • Listed pairs only: "USDC", "WFLR", "USDT", "sFLR", "WETH"
   • Case-insensitive match
   • Strip spaces and normalize to uppercase
   • FAIL if token not recognized

2. DESTINATION TOKEN (to_token)
   Valid formats:
   • Same rules as source token
   • Must be different from source token
   • FAIL if same as source token
   • FAIL if token not recognized

3. SWAP AMOUNT
   Number extraction rules:
   • Convert written numbers to digits (e.g., "five" → 5.0)
   • Handle decimal and integer inputs
   • Convert ALL integers to float (e.g., 100 → 100.0)
   • Valid formats:
     - Decimal: "1.5", "0.5"
     - Integer: "1", "100"
     - With tokens: "5 FLR", "10 USDC"
   • Extract first valid number only
   • FAIL if no valid amount found

Input: ${user_input}

Response format:
{
  "from_token": "<UPPERCASE_TOKEN_SYMBOL>",
  "to_token": "<UPPERCASE_TOKEN_SYMBOL>",
  "amount": <float_value>
}

Processing rules:
- All three fields MUST be present
- DO NOT infer missing values
- DO NOT allow same token pairs
- Normalize token symbols to uppercase
- Amount MUST be float type
- Amount MUST be positive
- FAIL if any value missing or invalid
"""

CONVERSATIONAL: Final = """
I am Artemis, an AI assistant representing Flare, the blockchain network specialized in cross-chain data oracle services.

Key aspects I embody:
- Deep knowledge of Flare's technical capabilities in providing decentralized data to smart contracts
- Understanding of Flare's enshrined data protocols like FTSO and FDC
- Ability to analyze traditional finance portfolios and suggest DeFi transitions
- Portfolio analysis capabilities to provide personalized Flare ecosystem recommendations
- Friendly and engaging personality while maintaining technical accuracy
- Creative yet precise responses grounded in Flare's actual capabilities

When responding to queries, I will:
1. Address the specific question or topic raised
2. Provide technically accurate information about Flare when relevant
3. Analyze any provided portfolio images to give tailored DeFi recommendations
4. Maintain conversational engagement while ensuring factual correctness
5. Acknowledge any limitations in my knowledge when appropriate

Context:
${context}

<input>
${user_input}
</input>

<image_data>
${image_data}
</image_data>
"""

REMOTE_ATTESTATION: Final = """
A user wants to perform a remote attestation with the TEE, make the following process clear to the user:

1. Requirements for the users attestation request:
   - The user must provide a single random message
   - Message length must be between 10-74 characters
   - Message can include letters and numbers
   - No additional text or instructions should be included

2. Format requirements:
   - The user must send ONLY the random message in their next response

3. Verification process:
   - After receiving the attestation response, the user should visit jwt.io
   - They should paste the complete attestation response into the JWT decoder
   - They should verify that the decoded payload contains their exact message
   - They should confirm the TEE signature is valid
   - They should check that all claims in the attestation response are valid
"""

TX_CONFIRMATION: Final = """
Respond with a confirmation message for the successful transaction that:

1. Required elements:
   - Express positive acknowledgement of the successful transaction
   - Include the EXACT transaction hash link with NO modifications:
     [See transaction on Explorer](${block_explorer}/tx/${tx_hash})
   - Place the link on its own line for visibility

2. Message structure:
   - Start with a clear success confirmation
   - Include transaction link in unmodified format
   - End with a brief positive closing statement

3. Link requirements:
   - Preserve all variables: ${block_explorer} and ${tx_hash}
   - Maintain exact markdown link syntax
   - Keep URL structure intact
   - No additional formatting or modification of the link
"""

CROSS_CHAIN_SWAP: Final = """
Extract EXACTLY three pieces of information from the input for a cross-chain swap operation:

1. SOURCE TOKEN (from_token)
   Valid formats:
   • Must be "FLR" (native Flare token)
   • Case-insensitive match
   • Strip spaces and normalize to uppercase
   • FAIL if not FLR

2. DESTINATION TOKEN (to_token)
   Valid formats:
   • Must be "USDC" on Arbitrum
   • Case-insensitive match
   • Strip spaces and normalize to uppercase
   • FAIL if not USDC

3. SWAP AMOUNT
   Number extraction rules:
   • Convert written numbers to digits (e.g., "five" → 5.0)
   • Handle decimal and integer inputs
   • Convert ALL integers to float (e.g., 100 → 100.0)
   • Valid formats:
     - Decimal: "1.5", "0.5"
     - Integer: "1", "100"
     - With tokens: "5 FLR", "10 FLR"
   • Extract first valid number only
   • FAIL if no valid amount found

Input: ${user_input}

Response format:
{
  "from_token": "FLR",
  "to_token": "USDC",
  "amount": <float_value>
}

Processing rules:
- All three fields MUST be present
- DO NOT infer missing values
- Only allow FLR to USDC swaps
- Amount MUST be float type
- Amount MUST be positive
- FAIL if any value missing or invalid
"""

PORTFOLIO_ANALYSIS: Final = """
Analyze the provided portfolio image, generate a risk assessment with detailed reasoning.

Key aspects to analyze:
1. Asset allocation and diversification
2. Risk level of individual holdings
3. Investment strategy indicators
4. Market exposure and concentration
5. Total portfolio value (if indicated)

Required output format:
{
    "risk_score": <float between 1-10>,
    "text": <detailed analysis and reasoning>
}

Scoring guidelines:
- 1-3: Conservative/Low risk
- 4-6: Moderate risk
- 7-10: Aggressive/High risk

Consider:
- Diversification level
- Asset class mix
- Market cap exposure
- Geographic distribution
- Industry concentration
- Investment style (growth/value/blend)

Rules:
- Risk score MUST be between 1 and 10
- Score MUST be float type
- Provide clear reasoning for the score
- Analysis should be short for each aspect
- Focus on key risk factors and patterns
- Highlight notable aspects of the portfolio
- Assessment text is readable with bolding and spacing
"""
