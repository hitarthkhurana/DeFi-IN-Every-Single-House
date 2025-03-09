from typing import Any

NETWORK_CONFIGS: dict[str, dict[str, Any]] = {
    "flare": {
        "name": "Flare",
        "chain_id": 14,
        "rpc_url": "https://flare-api.flare.network/ext/C/rpc",
        "explorer_url": "https://flare-explorer.flare.network",
        "native_symbol": "FLR",
    },
    "arbitrum": {
        "name": "Arbitrum One",
        "chain_id": 42161,
        "rpc_url": "https://arb1.arbitrum.io/rpc",
        "explorer_url": "https://arbiscan.io",
        "native_symbol": "ETH",
    },
}
