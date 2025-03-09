"""Prompt handling module."""

from enum import Enum

from .library import PromptLibrary
from .service import PromptService


class SemanticRouterResponse(str, Enum):
    """Enum for semantic router response categories."""

    CHECK_BALANCE = "CHECK_BALANCE"
    SEND_TOKEN = "SEND_TOKEN"
    SWAP_TOKEN = "SWAP_TOKEN"
    CROSS_CHAIN_SWAP = "CROSS_CHAIN_SWAP"
    STAKE_FLR = "STAKE_FLR"
    REQUEST_ATTESTATION = "REQUEST_ATTESTATION"
    CONVERSATIONAL = "CONVERSATIONAL"


__all__ = [
    "PromptLibrary",
    "PromptService",
    "SemanticRouterResponse",
]
