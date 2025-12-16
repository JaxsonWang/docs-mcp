import { dotProduct } from "./vector.js";

export function cosineSimilarity(a: number[], b: number[]): number {
	return dotProduct(a, b);
}
