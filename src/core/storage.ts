import { promises as fs } from "node:fs";
import path from "node:path";
import type { PersistedIndex } from "./types.js";

const INDEX_FILE = "index.json";

export async function writeIndex(
	persistDir: string,
	data: PersistedIndex,
): Promise<void> {
	await fs.mkdir(persistDir, { recursive: true });
	const filePath = path.join(persistDir, INDEX_FILE);
	const payload = JSON.stringify(data, null, 2);
	await fs.writeFile(filePath, payload, "utf-8");
}

export async function readIndex(persistDir: string): Promise<PersistedIndex> {
	const filePath = path.join(persistDir, INDEX_FILE);
	const buffer = await fs.readFile(filePath, "utf-8");
	const parsed = JSON.parse(buffer) as PersistedIndex;
	if (!Array.isArray(parsed.documents) || !parsed.documents.length) {
		throw new Error(`index at ${filePath} is empty or malformed`);
	}
	return parsed;
}

export async function ensureEmptyDir(targetDir: string): Promise<void> {
	await fs.rm(targetDir, { recursive: true, force: true });
	await fs.mkdir(targetDir, { recursive: true });
}

export function indexFilePath(persistDir: string): string {
	return path.join(persistDir, INDEX_FILE);
}
