export interface DocsRoot {
	path: string;
	lang: string;
}

export interface ChunkMetadata {
	path: string;
	lang: string;
	section: string;
}

export interface StoredChunk {
	id: string;
	text: string;
	metadata: ChunkMetadata;
	embedding: number[];
}

export interface PersistedIndex {
	version: number;
	createdAt: string;
	embeddingModel: string;
	embedBackend: string;
	dimensions: number;
	chunkSize: number;
	chunkOverlap: number;
	docsRoots: DocsRoot[];
	documents: StoredChunk[];
}

export interface RetrievalResult extends StoredChunk {
	score: number;
}
