import path from "node:path";
import type { DocsRoot } from "./types.js";

export function parseDocsRoots(raw: string[] | undefined): DocsRoot[] {
	const inputs = raw && raw.length ? raw : ["docs/en:en"];
	const resolved: DocsRoot[] = [];
	for (const entry of inputs) {
		const [pathPart, langPart] = entry.split(":");
		const fullPath = path.resolve(pathPart);
		const lang = (langPart || path.basename(fullPath) || "en").toLowerCase();
		resolved.push({ path: fullPath, lang });
	}
	return resolved;
}
