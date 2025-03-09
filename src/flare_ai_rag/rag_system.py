"""
RAG System that integrates vector store for document retrieval
"""

from pathlib import Path
from typing import Any

from .vector_store import VectorStoreManager
from flare_ai_defai.settings import settings


class RAGSystem:
    """Main RAG system that handles document storage and retrieval"""

    def __init__(self, data_dir: str | None = None):
        """Initialize the RAG system

        Args:
            data_dir: Optional directory containing knowledge base documents
        """
        self.data_dir = Path(data_dir) if data_dir else Path("src/data")
        self.vector_store = VectorStoreManager("flare_docs", api_key=settings.gemini_api_key)

    def initialize_knowledge_base(self) -> int:
        """Initialize the knowledge base by loading all documents

        Returns:
            Number of documents loaded
        """
        # This is called by the RAGProcessor's _load_documents method
        # which handles the actual document loading
        return len(self.vector_store.documents)

    def query(self, question: str, k: int = 4) -> list[dict[str, Any]]:
        """Query the knowledge base

        Args:
            question: The query text
            k: Number of results to return

        Returns:
            List of relevant documents with their metadata and scores
        """
        return self.vector_store.similarity_search(question, k=k)

    def get_formatted_context(self, results: list[dict[str, Any]]) -> str:
        """Format search results into a readable context string

        Args:
            results: List of search results from query()

        Returns:
            Formatted context string
        """
        context_parts = []

        for i, result in enumerate(results, 1):
            context_parts.append(f"[Document {i}] {result['text']}")
            if result["metadata"].get("source_file"):
                context_parts.append(f"Source: {result['metadata']['source_file']}")
            context_parts.append(f"Relevance Score: {result['score']:.2f}")
            context_parts.append("")

        return "\n".join(context_parts)
