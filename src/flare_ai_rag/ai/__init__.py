"""AI module for Flare AI RAG system."""

from enum import Enum

class EmbeddingTaskType(str, Enum):
    """Task types for embeddings."""
    RETRIEVAL_QUERY = "retrieval_query"
    RETRIEVAL_DOCUMENT = "retrieval_document"

from .gemini import GeminiEmbedding  # noqa: E402

__all__ = ["EmbeddingTaskType", "GeminiEmbedding"] 