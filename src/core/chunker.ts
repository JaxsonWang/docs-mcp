const DEFAULT_SEPARATOR = /\s+/g;

export function chunkText(
	text: string,
	chunkSize: number,
	chunkOverlap: number,
): string[] {
	if (chunkSize <= 0) {
		throw new Error("chunkSize must be positive");
	}
	const normalized = text.replace(/\r\n/g, "\n").trim();
	if (!normalized) {
		return [];
	}
	const tokens = normalized.split(DEFAULT_SEPARATOR).filter(Boolean);
	if (!tokens.length) {
		return [];
	}
	const maxTokens = Math.max(chunkSize, 32);
	const overlap = Math.max(0, Math.min(chunkOverlap, maxTokens - 1));
	const step = Math.max(1, maxTokens - overlap);

	const chunks: string[] = [];
	for (let start = 0; start < tokens.length; start += step) {
		const slice = tokens.slice(start, start + maxTokens);
		const chunk = slice.join(" ").trim();
		if (chunk) {
			chunks.push(chunk);
		}
		if (slice.length < maxTokens) {
			break;
		}
	}
	return chunks;
}
