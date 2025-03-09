"""
RAG (Retrieval Augmented Generation) Module

This module implements document retrieval and augmentation capabilities
for enhancing AI responses with relevant context from a knowledge base.
"""

import csv
import glob
import os
from dataclasses import dataclass
from typing import Any

import pandas as pd
import structlog

from flare_ai_rag import RAGSystem

logger = structlog.get_logger(__name__)


@dataclass
class Document:
    """Represents a document in the knowledge base"""

    content: str
    metadata: dict[str, Any]
    source: str  # Source file name


@dataclass
class RetrievalResult:
    """Result from document retrieval"""

    documents: list[Document]
    scores: list[float]


class RAGProcessor:
    """Handles document retrieval and prompt augmentation"""

    def __init__(self, knowledge_base_path: str | None = None):
        """Initialize the RAG processor

        Args:
            knowledge_base_path: Optional path to knowledge base documents
        """
        self.logger = logger.bind(processor="rag")

        # Initialize RAG system
        self.rag_system = RAGSystem(
            knowledge_base_path if knowledge_base_path else "src/data"
        )

        # Load documents if path provided
        if knowledge_base_path:
            self._load_documents(knowledge_base_path)

    def _load_documents(self, path: str) -> None:
        """Load documents from CSV files in the specified directory

        Args:
            path: Directory containing CSV files
        """
        csv_files = glob.glob(os.path.join(path, "*.csv"))

        for file_path in csv_files:
            try:
                # Read CSV file with meta_data as string and handle multi-line fields
                df = pd.read_csv(
                    file_path,
                    dtype={"meta_data": str},
                    quoting=csv.QUOTE_MINIMAL,
                    quotechar='"',
                    escapechar="\\",
                    on_bad_lines="warn",
                )

                # Process each row
                texts = []
                metadatas = []

                for _, row in df.iterrows():
                    try:
                        if pd.notna(
                            row.get("content", None)
                        ):  # Check if content exists and is not NA
                            texts.append(
                                str(row["content"])
                            )  # Ensure content is string

                            metadata = {
                                "source_file": os.path.basename(file_path),
                                "last_updated": row.get("last_updated", None),
                                "file_name": row.get(
                                    "file_name", None
                                ),  # Include file_name in metadata
                            }

                            # Add any additional metadata
                            if pd.notna(row.get("meta_data", None)):
                                try:
                                    # Store raw meta_data string, preserving newlines
                                    metadata["meta_data"] = str(
                                        row["meta_data"]
                                    ).strip()
                                except Exception as e:
                                    self.logger.warning(
                                        "meta_data_parse_error",
                                        error=str(e),
                                        file=os.path.basename(file_path),
                                        row_number=_,
                                    )

                            metadatas.append(metadata)
                    except Exception as e:
                        self.logger.warning(
                            "row_processing_error",
                            error=str(e),
                            file=os.path.basename(file_path),
                            row_number=_,
                        )
                        continue

                # Add documents to vector store
                if texts:
                    # Log before adding to verify data
                    self.logger.info(
                        "processing_documents",
                        file=os.path.basename(file_path),
                        count=len(texts),
                        first_doc_preview=texts[0][:100] if texts else None,
                    )

                    # Add to vector store in smaller batches to prevent memory issues
                    batch_size = 1000
                    for i in range(0, len(texts), batch_size):
                        batch_texts = texts[i : i + batch_size]
                        batch_metadatas = metadatas[i : i + batch_size]
                        self.rag_system.vector_store.add_texts(
                            batch_texts, batch_metadatas
                        )

                        self.logger.info(
                            "loaded_document_batch",
                            file=os.path.basename(file_path),
                            batch_start=i,
                            batch_size=len(batch_texts),
                        )

                    self.logger.info(
                        "loaded_documents",
                        file=os.path.basename(file_path),
                        total_count=len(texts),
                    )

            except Exception as e:
                self.logger.error(
                    "document_load_error",
                    error=str(e),
                    error_type=type(e).__name__,
                    file=os.path.basename(file_path),
                )

    async def retrieve_relevant_docs(
        self, query: str, image_description: str | None = None, k: int = 3
    ) -> RetrievalResult:
        """Retrieve relevant documents for a query

        Args:
            query: User query
            image_description: Optional description of an image to consider
            k: Number of documents to retrieve

        Returns:
            RetrievalResult containing relevant documents and their scores
        """
        # Combine query with image description if available
        search_query = query
        if image_description:
            search_query = f"{query} {image_description}"

        # Search vector store
        results = self.rag_system.vector_store.similarity_search(search_query, k=k)

        # Convert to Document objects
        documents = []
        scores = []

        for result in results:
            doc = Document(
                content=result["text"],
                metadata=result["metadata"],
                source=result["metadata"].get("source_file", "unknown"),
            )
            documents.append(doc)
            scores.append(result["score"])

        return RetrievalResult(documents=documents, scores=scores)

    def augment_prompt(
        self,
        query: str,
        retrieved_docs: RetrievalResult,
        image_description: str | None = None,
    ) -> str:
        """Augment the user query with retrieved context

        Args:
            query: Original user query
            retrieved_docs: Retrieved relevant documents
            image_description: Optional description of an image

        Returns:
            Augmented prompt for the AI model
        """
        prompt_parts = [
            "You are a helpful AI assistant with access to Flare Network documentation. "
            "When answering questions, you should:"
            "\n1. Use the provided context to inform your answers"
            "\n2. ALWAYS cite your sources using [doc_name] format when referencing information"
            "\n3. If you're not sure about something, say so rather than making assumptions"
            "\n4. Keep responses clear and well-structured"
            "\n\nHere is the relevant context for your response:\n"
        ]

        # Add retrieved documents as context
        for i, (doc, score) in enumerate(
            zip(retrieved_docs.documents, retrieved_docs.scores, strict=False), 1
        ):
            # Create a reference ID for this document that's easy to cite
            doc_ref = f"[{doc.source}]"

            prompt_parts.extend(
                [
                    f"Document {i} {doc_ref}:",
                    f"{doc.content}",
                    f"Relevance Score: {score:.2f}",
                    "",
                ]
            )

        prompt_parts.append(
            "\nBased on the above context, please provide a detailed answer to the following question."
        )
        prompt_parts.append(
            "Remember to cite specific documents using their [doc_name] format when referencing information.\n"
        )

        if image_description:
            prompt_parts.append(
                f"Additionally, consider this image context: {image_description}\n"
            )

        prompt_parts.append(f"Question: {query}")

        return "\n".join(prompt_parts)
