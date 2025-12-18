import { spawnSync } from "node:child_process";

type TransformersModule = typeof import("@xenova/transformers");

let transformersPromise: Promise<TransformersModule> | undefined;
let sharpCheckPromise: Promise<void> | undefined;

export async function loadTransformersModule(): Promise<TransformersModule> {
  if (!transformersPromise) {
    transformersPromise = ensureSharpReady().then(async () => {
      const module = await import("@xenova/transformers");
      module.env.allowLocalModels = true;
      return module;
    });
  }
  return transformersPromise;
}

async function ensureSharpReady(): Promise<void> {
  if (!sharpCheckPromise) {
    sharpCheckPromise = (async () => {
      if (await canLoadSharp()) {
        return;
      }
      attemptSharpRebuild();
      if (!(await canLoadSharp())) {
        throw new Error(
          "sharp native bindings missing. Re-run with `pnpx --allow-build=sharp @jaxsonwang/docs-mcp …` or install docs-mcp locally with build scripts enabled."
        );
      }
    })();
  }
  return sharpCheckPromise;
}

async function canLoadSharp(): Promise<boolean> {
  try {
    await import("sharp");
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes("sharp")) {
      return false;
    }
    throw error;
  }
}

function attemptSharpRebuild(): void {
  const commands: Array<{ command: string; args: string[] }> = [
    { command: "pnpm", args: ["rebuild", "sharp"] },
    { command: "npm", args: ["rebuild", "sharp"] },
  ];

  for (const { command, args } of commands) {
    if (runCommand(command, args)) {
      return;
    }
  }
}

function runCommand(command: string, args: string[]): boolean {
  try {
    const result = spawnSync(command, args, { stdio: "inherit" });
    return result.status === 0;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}
