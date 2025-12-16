import { Command } from "commander";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { EmbeddingModel } from "../core/embedder.js";
import { readIndex } from "../core/storage.js";
import { cosineSimilarity } from "../core/similarity.js";
import type { PersistedIndex, RetrievalResult } from "../core/types.js";

interface CliOptions {
  persistDir: string;
  embeddingModel: string;
  defaultK: number;
}

const QuerySchema = z.object({
  question: z.string().min(1, "'question' must not be empty"),
  k: z.number().int().positive().max(20).optional(),
});
const ChunkSchema = z.object({
  path: z.string(),
  lang: z.string(),
  score: z.number(),
  text: z.string(),
});
const QueryResultSchema = z.object({
  chunks: z.array(ChunkSchema),
});

let cachedIndex: PersistedIndex | null = null;
let embedder: EmbeddingModel | null = null;
let defaultK = 4;
let persistDir: string;

export async function runMcpServer(argv: string[]): Promise<void> {
  const program = new Command();
  program
    .name("mcp-docs-server")
    .option(
      "--persist-dir <dir>",
      "Directory containing the persisted index",
      "storage/llamaindex"
    )
    .option(
      "--embedding-model <name>",
      "HuggingFace model identifier served via @xenova/transformers",
      "Xenova/bge-base-zh-v1.5"
    )
    .option(
      "--default-k <chunks>",
      "Default number of chunks when caller omits k",
      value => parseInt(value, 10),
      4
    )
    .allowExcessArguments(false);

  const options = program.parse(argv).opts<CliOptions>();
  defaultK = Math.max(1, options.defaultK);
  persistDir = options.persistDir;
  embedder = new EmbeddingModel(options.embeddingModel);
  cachedIndex = await readIndex(persistDir);

  const server = new McpServer(
    {
      name: "docs-mcp-server",
      version: "0.2.0",
    },
    {
      capabilities: {
        tools: {},
      },
      instructions: "Retrieves local documentation chunks for CLI agents.",
    }
  );

  server.registerTool(
    "docs_query",
    {
      description: "Retrieve context chunks from the local docs index",
      inputSchema: QuerySchema,
      outputSchema: QueryResultSchema,
    },
    async ({ question, k }) => {
      const normalizedK = typeof k === "number" ? k : defaultK;
      const vector = (await embedder!.embed([question]))[0];
      cachedIndex = cachedIndex ?? (await readIndex(persistDir));
      const index = cachedIndex;
      const results = rank(index, vector, normalizedK);
      const structured = structureChunks(results);
      return {
        structuredContent: structured,
        content: [
          {
            type: "text",
            text: formatChunks(structured.chunks),
          },
        ],
      };
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("docs-mcp server running on stdio");
}

function rank(
  index: PersistedIndex,
  queryVector: number[],
  topK: number
): RetrievalResult[] {
  const cappedK = Math.max(1, Math.min(topK, 20));
  return index.documents
    .map(doc => ({
      ...doc,
      score: cosineSimilarity(queryVector, doc.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, cappedK);
}

function structureChunks(
  results: RetrievalResult[]
): z.infer<typeof QueryResultSchema> {
  const chunks = results.map(node => {
    const meta = node.metadata || ({} as RetrievalResult["metadata"]);
    return {
      path: meta.path ?? "unknown",
      lang: meta.lang ?? "n/a",
      score: Number(node.score.toFixed(6)),
      text: node.text.trim(),
    };
  });
  return { chunks };
}

function formatChunks(
  chunks: z.infer<typeof QueryResultSchema>["chunks"]
): string {
  return chunks
    .map(
      (chunk, idx) =>
        `[${idx + 1}] (path=${chunk.path} lang=${
          chunk.lang
        } score=${chunk.score.toFixed(3)})\n${chunk.text}\n`
    )
    .join("\n");
}
