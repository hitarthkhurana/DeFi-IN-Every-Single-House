import json
from pathlib import Path
from typing import Any
import os
import textwrap

import numpy as np
from annoy import AnnoyIndex
from flare_ai_rag.ai import EmbeddingTaskType, GeminiEmbedding


class VectorStoreManager:
    def __init__(self, collection_name: str = "flare_docs", api_key: str = None):
        if not api_key:
            raise ValueError("API key is required for Gemini embeddings")
            
        self.collection_name = collection_name

        # Initialize the Gemini embedding model
        self.encoder = GeminiEmbedding(api_key=api_key)
        self.embedding_model = "models/embedding-001"  # Gemini's embedding model with correct prefix
        self.dimension = 768  # Dimension of Gemini embeddings
        self.max_chunk_size = 8000  # Maximum size in bytes for each chunk (leaving buffer)

        # Create storage directory if it doesn't exist
        self.storage_dir = Path("vector_store")
        self.storage_dir.mkdir(exist_ok=True)

        # Paths for storing index and metadata
        self.index_path = self.storage_dir / f"{collection_name}.ann"
        self.metadata_path = self.storage_dir / f"{collection_name}_metadata.json"

        # Initialize storage for documents and embeddings
        self.documents = []
        self.metadatas = []
        self.embeddings = []
        self.index = None  # Will be initialized after loading data

        # Load existing data if available and dimensions match
        self._load_if_exists()

        # Initialize index with data
        self._init_index()

    def _chunk_text(self, text: str) -> list[str]:
        """Split text into chunks that fit within the size limit.
        
        Args:
            text: Text to split into chunks
            
        Returns:
            List of text chunks
        """
        # Convert to bytes to check actual size
        text_bytes = text.encode('utf-8')
        if len(text_bytes) <= self.max_chunk_size:
            return [text]

        # Split into paragraphs first
        paragraphs = text.split('\n\n')
        chunks = []
        current_chunk = []
        current_size = 0

        for paragraph in paragraphs:
            paragraph_size = len(paragraph.encode('utf-8'))
            
            # If single paragraph is too large, split by sentences
            if paragraph_size > self.max_chunk_size:
                sentences = paragraph.split('. ')
                for sentence in sentences:
                    sentence_size = len(sentence.encode('utf-8'))
                    if sentence_size > self.max_chunk_size:
                        # If sentence is still too large, split by character count
                        sentence_chunks = textwrap.wrap(
                            sentence,
                            width=self.max_chunk_size // 2,  # Conservative split
                            break_long_words=True,
                            replace_whitespace=False
                        )
                        for chunk in sentence_chunks:
                            chunks.append(chunk)
                    else:
                        if current_size + sentence_size > self.max_chunk_size:
                            chunks.append('\n\n'.join(current_chunk))
                            current_chunk = [sentence]
                            current_size = sentence_size
                        else:
                            current_chunk.append(sentence)
                            current_size += sentence_size
            else:
                if current_size + paragraph_size > self.max_chunk_size:
                    chunks.append('\n\n'.join(current_chunk))
                    current_chunk = [paragraph]
                    current_size = paragraph_size
                else:
                    current_chunk.append(paragraph)
                    current_size += paragraph_size

        if current_chunk:
            chunks.append('\n\n'.join(current_chunk))

        return chunks

    def _init_index(self):
        """Initialize or reinitialize the Annoy index."""
        # Create a new index
        self.index = AnnoyIndex(self.dimension, "angular")

        # If we have existing embeddings, add them to the new index
        for i, embedding in enumerate(self.embeddings):
            if len(embedding) != self.dimension:
                # Clear all data if dimensions don't match
                self.documents = []
                self.metadatas = []
                self.embeddings = []
                # Delete existing files
                if self.index_path.exists():
                    os.remove(self.index_path)
                if self.metadata_path.exists():
                    os.remove(self.metadata_path)
                break
            self.index.add_item(i, embedding)

        if self.embeddings:
            self.index.build(10)  # 10 trees - good balance between speed and accuracy

    def _load_if_exists(self):
        """Load existing data if available."""
        try:
            if self.metadata_path.exists():
                with open(self.metadata_path, encoding="utf-8") as f:
                    data = json.load(f)
                    # Check if any embeddings exist and verify their dimension
                    if data.get("embeddings") and data["embeddings"]:
                        first_embedding = np.array(data["embeddings"][0])
                        if len(first_embedding) != self.dimension:
                            # Skip loading if dimensions don't match
                            return
                    self.documents = data["documents"]
                    self.metadatas = data["metadatas"]
                    self.embeddings = [np.array(emb) for emb in data["embeddings"]]
        except Exception as e:
            print(f"Error loading existing data: {e}")
            self.documents = []
            self.metadatas = []
            self.embeddings = []

    def _save_data(self):
        """Save all data to disk."""
        try:
            # Save documents, metadata, and embeddings
            with open(self.metadata_path, "w", encoding="utf-8") as f:
                json.dump(
                    {
                        "documents": self.documents,
                        "metadatas": self.metadatas,
                        "embeddings": [emb.tolist() for emb in self.embeddings],
                    },
                    f,
                    ensure_ascii=False,
                    indent=2,
                )

            # Save Annoy index
            self.index.save(str(self.index_path))
        except Exception as e:
            print(f"Error saving data: {e}")

    def add_texts(
        self, texts: list[str], metadatas: list[dict[str, Any]] | None = None
    ):
        """Add texts to the vector store."""
        if not texts:
            return

        # Generate embeddings using Gemini
        new_embeddings = []
        new_documents = []
        new_metadatas = []

        for idx, text in enumerate(texts):
            # Split text into chunks if needed
            chunks = self._chunk_text(text)
            metadata = metadatas[idx] if metadatas else {}

            for chunk_idx, chunk in enumerate(chunks):
                try:
                    embedding = self.encoder.embed_content(
                        embedding_model=self.embedding_model,
                        contents=chunk,
                        task_type=EmbeddingTaskType.RETRIEVAL_DOCUMENT
                    )
                    new_embeddings.append(np.array(embedding))
                    new_documents.append(chunk)
                    
                    # Add chunk information to metadata
                    chunk_metadata = metadata.copy()
                    if len(chunks) > 1:
                        chunk_metadata['chunk_info'] = f'Part {chunk_idx + 1} of {len(chunks)}'
                    new_metadatas.append(chunk_metadata)
                except Exception as e:
                    print(f"Error embedding chunk {chunk_idx} of document {idx}: {e}")
                    continue

        # Store documents, metadata, and embeddings
        self.documents.extend(new_documents)
        self.metadatas.extend(new_metadatas)
        self.embeddings.extend(new_embeddings)

        # Reinitialize the index with all data
        self._init_index()

        # Save to disk
        self._save_data()

    def similarity_search(self, query: str, k: int = 4) -> list[dict[str, Any]]:
        """Search for similar texts in the vector store."""
        if not self.documents:
            return []

        # Generate query embedding using Gemini
        query_embedding = self.encoder.embed_content(
            embedding_model=self.embedding_model,
            contents=query,
            task_type=EmbeddingTaskType.RETRIEVAL_QUERY
        )

        # Search
        indices, distances = self.index.get_nns_by_vector(
            query_embedding, min(k, len(self.documents)), include_distances=True
        )

        # Format results
        results = []
        for idx, distance in zip(indices, distances, strict=False):
            # Convert distance to similarity score (angular distance to cosine similarity)
            similarity = 1 - (distance**2) / 2

            results.append(
                {
                    "text": self.documents[idx],
                    "metadata": self.metadatas[idx],
                    "score": float(similarity),
                }
            )

        return results
