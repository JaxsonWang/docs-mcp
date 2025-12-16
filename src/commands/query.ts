import { Command } from "commander";
import { EmbeddingModel } from "../core/embedder.js";
import { cosineSimilarity } from "../core/similarity.js";
import { readIndex } from "../core/storage.js";
import type { PersistedIndex, RetrievalResult } from "../core/types.js";

interface CliOptions {
  persistDir: string;
  k: number;
  model: "codex" | "claude" | "gemini" | "raw" | "mcp";
  embeddingModel: string;
  cliPath?: string;
}

const PROMPT_TEMPLATE = `You are assisting with documentation questions. Use ONLY the provided context.

Question: {question}

Context:
{context}

Answer in English.`;

export async function runQuery(argv: string[]): Promise<void> {
  const program = new Command();
  program
    .name("query-docs")
    .argument("<question>", "Question to ask")
    .option(
      "--persist-dir <dir>",
      "Directory containing the persisted index",
      "storage/llamaindex"
    )
    .option(
      "--k <chunks>",
      "Number of top chunks to retrieve",
      value => parseInt(value, 10),
      4
    )
    .option("--model <name>", "Output target", "raw")
    .option(
      "--embedding-model <name>",
      "HuggingFace model identifier served via @xenova/transformers",
      "Xenova/bge-base-zh-v1.5"
    )
    .option("--cli-path <path>", "Override CLI executable when model != raw")
    .allowExcessArguments(false);

  const args = program.parse(argv);
  const question = args.args[0];
  if (!question) {
    program.error("question argument is required");
  }

  const options = args.opts<CliOptions>();
  await query(question, options);
}

async function query(question: string, options: CliOptions): Promise<void> {
  const index = await readIndex(options.persistDir);
  validateIndex(index, options.embeddingModel);

  const embedder = new EmbeddingModel(options.embeddingModel);
  const queryVector = (await embedder.embed([question]))[0];
  if (!queryVector || !queryVector.length) {
    throw new Error("Failed to embed question");
  }

  const results = rank(index, queryVector, options.k);
  const context = buildContext(results);
  const prompt = PROMPT_TEMPLATE.replace("{question}", question).replace(
    "{context}",
    context
  );

  if (options.model === "raw") {
    console.log(prompt);
    return;
  }

  if (options.model === "mcp") {
    console.log(JSON.stringify({ prompt, chunks: results }, null, 2));
    return;
  }

  const cliCmd = resolveCli(options.model, options.cliPath);
  await runCli(cliCmd, prompt);
}

function validateIndex(index: PersistedIndex, embeddingModel: string): void {
  if (!Array.isArray(index.documents) || !index.documents.length) {
    throw new Error("Persisted index has no documents");
  }
  if (index.embeddingModel !== embeddingModel) {
    console.warn(
      `Warning: index was built with ${index.embeddingModel} but CLI embedding model is ${embeddingModel}. ` +
        `You should keep them aligned to avoid cosine mismatch.`
    );
  }
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

function buildContext(results: RetrievalResult[]): string {
  return results
    .map((node, idx) => {
      const meta = node.metadata || ({} as RetrievalResult["metadata"]);
      const metaStr = `path=${meta.path ?? "unknown"} lang=${
        meta.lang ?? "n/a"
      } score=${node.score.toFixed(3)}`;
      return `[${idx + 1}] (${metaStr})\n${node.text.trim()}\n`;
    })
    .join("\n");
}

function resolveCli(model: string, override?: string): string[] {
  if (override) {
    return [override];
  }
  switch (model) {
    case "codex":
      return ["codex", "chat", "--stdin"];
    case "claude":
      return ["claude", "chat", "--stdin"];
    case "gemini":
      return ["gemini", "chat", "--stdin"];
    default:
      throw new Error(`Unsupported model target: ${model}`);
  }
}

async function runCli(command: string[], prompt: string): Promise<void> {
  const { spawn } = await import("node:child_process");
  const child = spawn(command[0], command.slice(1), {
    stdio: ["pipe", "inherit", "inherit"],
  });
  child.stdin?.write(prompt);
  child.stdin?.end();
  await new Promise<void>((resolve, reject) => {
    child.on("exit", code => {
      if (code === 0) resolve();
      else reject(new Error(`CLI process exited with code ${code}`));
    });
    child.on("error", reject);
  });
}
