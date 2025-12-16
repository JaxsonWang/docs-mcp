import { promises as fs } from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import { chunkText } from "./chunker.js";
import type { ChunkMetadata, DocsRoot } from "./types.js";

export interface RawChunk {
	text: string;
	metadata: ChunkMetadata;
}

export interface CollectedChunks {
	chunks: RawChunk[];
	files: number;
}

function buildGlob(extensions: string[]): string | string[] {
	const cleanExts = extensions.map((ext) =>
		ext.startsWith(".") ? ext.slice(1) : ext,
	);
	if (cleanExts.length === 1) {
		return `**/*.${cleanExts[0]}`;
	}
	return `**/*.{${cleanExts.join(",")}}`;
}

export async function collectChunks(
	root: DocsRoot,
	extensions: string[],
	chunkSize: number,
	chunkOverlap: number,
): Promise<CollectedChunks> {
	const stats = await fs.stat(root.path).catch(() => null);
	if (!stats || !stats.isDirectory()) {
		throw new Error(
			`Docs root does not exist or is not a directory: ${root.path}`,
		);
	}
	const pattern = buildGlob(extensions);
	const files = await fg(pattern, {
		cwd: root.path,
		onlyFiles: true,
		caseSensitiveMatch: false,
	});
	if (!files.length) {
		throw new Error(`No markdown files found under ${root.path}`);
	}

	const chunks: RawChunk[] = [];
	for (const rel of files) {
		const fullPath = path.join(root.path, rel);
		const fileText = await fs.readFile(fullPath, "utf-8");
		const chunkTexts = chunkText(fileText, chunkSize, chunkOverlap);
		const normalizedRel = rel.split(path.sep).join("/");
		const section = normalizedRel.includes("/")
			? normalizedRel.split("/")[0]
			: "root";
		for (const chunk of chunkTexts) {
			chunks.push({
				text: chunk,
				metadata: {
					path: normalizedRel,
					lang: root.lang,
					section,
				},
			});
		}
	}
	return { chunks, files: files.length };
}
