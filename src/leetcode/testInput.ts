export function resolveTestInput(
	sampleTestCase: string,
	exampleTestcases: string,
	paramCount: number
): string {
	const sample = sampleTestCase.trim();
	if (sample) {
		return sample;
	}
	const lines = exampleTestcases
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
	if (lines.length === 0) {
		return '';
	}
	return lines.slice(0, Math.max(1, paramCount)).join('\n');
}