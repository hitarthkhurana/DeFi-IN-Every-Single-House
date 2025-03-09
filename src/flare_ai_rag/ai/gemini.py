"""
Gemini AI Provider Module for embeddings.

This module implements the Gemini AI provider for embeddings, integrating
with Google's Generative AI service.
"""

import structlog
from google.generativeai.client import configure
from google.generativeai.embedding import (
    EmbeddingTaskType as GeminiEmbeddingTaskType,
)
from google.generativeai.embedding import (
    embed_content as _embed_content,
)

from flare_ai_rag.ai import EmbeddingTaskType

logger = structlog.get_logger(__name__)

# Mapping our task types to Gemini's task types
TASK_TYPE_MAPPING = {
    EmbeddingTaskType.RETRIEVAL_QUERY: GeminiEmbeddingTaskType.RETRIEVAL_QUERY,
    EmbeddingTaskType.RETRIEVAL_DOCUMENT: GeminiEmbeddingTaskType.RETRIEVAL_DOCUMENT,
}


class GeminiEmbedding:
    """Provider class for Google's Gemini AI embeddings service."""

    def __init__(self, api_key: str) -> None:
        """
        Initialize the Gemini embedding provider with API credentials.

        Args:
            api_key (str): Google API key for authentication
        """
        configure(api_key=api_key)
        self.logger = logger.bind(service="gemini_embedding")

    def embed_content(
        self,
        embedding_model: str,
        contents: str,
        task_type: EmbeddingTaskType,
        title: str | None = None,
    ) -> list[float]:
        """
        Generate text embeddings using Gemini.

        Args:
            embedding_model (str): The embedding model to use (e.g., "embedding-001")
            contents (str): The text to be embedded
            task_type (EmbeddingTaskType): Type of embedding task
            title (str | None): Optional title for the content

        Returns:
            list[float]: The generated embedding vector

        Raises:
            ValueError: If embedding extraction fails
        """
        gemini_task_type = TASK_TYPE_MAPPING[task_type]
        
        response = _embed_content(
            model=embedding_model,
            content=contents,
            task_type=gemini_task_type,
            title=title,
        )

        try:
            embedding = response["embedding"]
            self.logger.debug(
                "generated_embedding",
                model=embedding_model,
                task_type=task_type,
                embedding_size=len(embedding),
            )
            return embedding
        except (KeyError, IndexError) as e:
            msg = "Failed to extract embedding from response."
            self.logger.error(
                msg,
                error=str(e),
                model=embedding_model,
                task_type=task_type,
            )
            raise ValueError(msg) from e 