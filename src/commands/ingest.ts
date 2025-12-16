import path from "node:path";
import { Command } from "commander";
import { collectChunks } from "../core/collector.js";
import { parseDocsRoots } from "../core/docs-roots.js";
import { EmbeddingModel } from "../core/embedder.js";
import { ensureEmptyDir, writeIndex } from "../core/storage.js";
import type { DocsRoot, PersistedIndex, StoredChunk } from "../core/types.js";

interface CliOptions {
  docsRoot?: string[];
  persistDir: string;
  chunkSize: number;
  chunkOverlap: number;
  extensions: string[];
  embeddingModel: string;
  clean: boolean;
}

const DEFAULT_EXTENSIONS = [".md", ".mdx"];
const EMBED_BACKEND = "xenova-transformers";
const BATCH_SIZE = 8;

export async function runIngest(argv: string[]): Promise<void> {
  const program = new Command();
  program
    .name("ingest-docs")
    .description("Build a local vector store for ScriptingApp docs")
    .option(
      "--docs-root <path:lang>",
      "Docs root plus optional language tag",
      collectValues,
      []
    )
    .option(
      "--persist-dir <dir>",
      "Directory for the persisted index",
      "storage/llamaindex"
    )
    .option(
      "--chunk-size <tokens>",
      "Approximate tokens per chunk",
      value => parseInt(value, 10),
      750
    )
    .option(
      "--chunk-overlap <tokens>",
      "Token overlap between chunks",
      value => parseInt(value, 10),
      120
    )
    .option(
      "--extensions <ext...>",
      "File extensions to ingest",
      DEFAULT_EXTENSIONS
    )
    .option(
      "--embedding-model <name>",
      "HuggingFace model identifier served via @xenova/transformers",
      "Xenova/bge-base-zh-v1.5"
    )
    .option("--clean", "Remove existing index before rebuilding", false)
    .allowExcessArguments(false);

  const options = program.parse(argv).opts<CliOptions>();
  await ingest(options);
}

function collectValues(value: string, previous: string[]): string[] {
  return [...previous, value];
}

async function ingest(options: CliOptions): Promise<void> {
  const docsRoots = parseDocsRoots(options.docsRoot);
  const persistDir = path.resolve(options.persistDir);
  if (options.clean) {
    await ensureEmptyDir(persistDir);
  }

  const normalizedExtensions = options.extensions?.length
    ? options.extensions
    : DEFAULT_EXTENSIONS;
  const embedder = new EmbeddingModel(options.embeddingModel);
  const chunks: StoredChunk[] = [];
  let totalFiles = 0;

  for (const root of docsRoots) {
    const result = await collectChunks(
      root,
      normalizedExtensions,
      options.chunkSize,
      options.chunkOverlap
    );
    totalFiles += result.files;
    const startingIndex = chunks.length;
    result.chunks.forEach((chunk, idx) => {
      chunks.push({
        id: `${root.lang}-${startingIndex + idx}`,
        text: chunk.text,
        metadata: chunk.metadata,
        embedding: [],
      });
    });
  }

  if (!chunks.length) {
    throw new Error(
      "No chunks collected; ensure docs roots contain markdown files"
    );
  }

  const ephemeralBatch: string[] = [];
  const pendingIndices: number[] = [];

  for (let i = 0; i < chunks.length; i += 1) {
    ephemeralBatch.push(chunks[i].text);
    pendingIndices.push(i);
    if (ephemeralBatch.length === BATCH_SIZE || i === chunks.length - 1) {
      const batchVectors = await embedder.embed(ephemeralBatch);
      batchVectors.forEach((vector, idx) => {
        chunks[pendingIndices[idx]].embedding = vector;
      });
      ephemeralBatch.length = 0;
      pendingIndices.length = 0;
    }
  }

  const dimensions = chunks[0].embedding.length;
  if (!dimensions) {
    throw new Error("Failed to compute embeddings; vector dimension is zero");
  }

  const indexData: PersistedIndex = {
    version: 1,
    createdAt: new Date().toISOString(),
    embeddingModel: options.embeddingModel,
    embedBackend: EMBED_BACKEND,
    dimensions,
    chunkSize: options.chunkSize,
    chunkOverlap: options.chunkOverlap,
    docsRoots: docsRoots.map(root => ({ path: root.path, lang: root.lang })),
    documents: chunks,
  };

  await writeIndex(persistDir, indexData);

  const uniqueLangs = Array.from(
    new Set<DocsRoot["lang"]>(docsRoots.map(root => root.lang))
  ).join(", ");
  console.log(
    `Indexed ${chunks.length} chunks from ${totalFiles} files across ${docsRoots.length} root(s) (${uniqueLangs}) into ${persistDir}`
  );
}
