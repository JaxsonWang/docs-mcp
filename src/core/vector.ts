export function dotProduct(a: number[], b: number[]): number {
	if (a.length !== b.length) {
		throw new Error("vectors must have the same length");
	}
	let total = 0;
	for (let i = 0; i < a.length; i += 1) {
		total += a[i] * b[i];
	}
	return total;
}
