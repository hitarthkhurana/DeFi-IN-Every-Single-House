import json
from pathlib import Path
from typing import Any

import numpy as np
from annoy import AnnoyIndex
from sentence_transformers import SentenceTransformer


class VectorStoreManager:
    def __init__(self, collection_name: str = "flare_docs"):
        self.collection_name = collection_name

        # Initialize the sentence transformer model
        self.encoder = SentenceTransformer("all-MiniLM-L6-v2")
        self.dimension = 384  # Dimension of all-MiniLM-L6-v2 embeddings

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

        # Load existing data if available
        self._load_if_exists()

        # Initialize index with data
        self._init_index()

    def _init_index(self):
        """Initialize or reinitialize the Annoy index."""
        # Create a new index
        self.index = AnnoyIndex(self.dimension, "angular")

        # If we have existing embeddings, add them to the new index
        for i, embedding in enumerate(self.embeddings):
            self.index.add_item(i, embedding)

        if self.embeddings:
            self.index.build(10)  # 10 trees - good balance between speed and accuracy

    def _load_if_exists(self):
        """Load existing data if available."""
        try:
            if self.metadata_path.exists():
                with open(self.metadata_path, encoding="utf-8") as f:
                    data = json.load(f)
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

        # Generate embeddings
        new_embeddings = self.encoder.encode(texts)

        # Store documents, metadata, and embeddings
        self.documents.extend(texts)
        self.metadatas.extend(metadatas if metadatas else [{}] * len(texts))
        self.embeddings.extend(new_embeddings)

        # Reinitialize the index with all data
        self._init_index()

        # Save to disk
        self._save_data()

    def similarity_search(self, query: str, k: int = 4) -> list[dict[str, Any]]:
        """Search for similar texts in the vector store."""
        if not self.documents:
            return []

        # Generate query embedding
        query_embedding = self.encoder.encode(query)

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
