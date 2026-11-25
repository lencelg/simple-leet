import { htmlToText } from '../util/html';

export interface ParsedTestcase {
	args: unknown[];
	input: string;
}

export function splitExampleTestcases(raw: string): string[] {
	return raw
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}

function parseValue(line: string): unknown {
	try {
		return JSON.parse(line);
	} catch {
		return line;
	}
}

export function groupExampleTestcases(raw: string, paramNames: string[]): ParsedTestcase[] {
	if (paramNames.length === 0) {
		throw new Error('This problem has no method parameters.');
	}
	const lines = splitExampleTestcases(raw);
	if (lines.length === 0) {
		throw new Error('No example test cases were found for this problem.');
	}
	if (lines.length % paramNames.length !== 0) {
		throw new Error(`Could not align the example test cases with the ${paramNames.length} parameter(s) of the solution.`);
	}
	const cases: ParsedTestcase[] = [];
	for (let index = 0; index < lines.length; index += paramNames.length) {
		const slice = lines.slice(index, index + paramNames.length);
		cases.push({
			args: slice.map(parseValue),
			input: slice.map((line, paramIndex) => `${paramNames[paramIndex]} = ${line}`).join(', '),
		});
	}
	return cases;
}

export function allowsAnyOrder(contentHtml: string): boolean {
	const text = htmlToText(contentHtml);
	return (
		/any order|order[^.]{0,80}(?:does not|doesn't|doesnt) matter|order[^.]{0,40}not matter|不重要|无关紧要|任意顺序|任意次序/i.test(
			text
		)
	);
}

const OUTPUT_LABEL = /(?:Output|输出)\s*[：:]/gi;
const INPUT_LABEL = /(?:Input|输入)\s*[：:]/gi;
const STOP_LABEL =
	/(?:Explanation|Note|Clarification|Follow-up|Constraints|Example|解释|说明|提示|注意|进阶|约束|示例)\s*\d*\s*[：:]|(?:Input|输入)\s*[：:]/i;

export function extractExpectedOutputs(contentHtml: string): string[] {
	// leetcode.cn wraps examples in <pre>, leetcode.com uses <p> lines, so parse the whole text.
	const text = htmlToText(contentHtml);
	const outputs: string[] = [];
	for (const match of text.matchAll(OUTPUT_LABEL)) {
		const index = match.index ?? 0;
		const before = text.slice(0, index);
		const inputs = [...before.matchAll(INPUT_LABEL)];
		if (inputs.length === 0) {
			continue;
		}
		let rest = text.slice(index + match[0].length);
		const stop = STOP_LABEL.exec(rest);
		if (stop) {
			rest = rest.slice(0, stop.index);
		}
		const output = rest.trim();
		if (output) {
			outputs.push(output);
		}
	}
	return outputs;
}