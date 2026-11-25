export interface CompareResult {
	pass: boolean;
	exact: boolean;
	note?: string;
}

type ParsedValue = { ok: true; value: unknown } | { ok: false };

function parseJson(text: string): ParsedValue {
	try {
		return { ok: true, value: JSON.parse(text) };
	} catch {
		return { ok: false };
	}
}

function numbersEqual(left: number, right: number): boolean {
	if (left === right) {
		return true;
	}
	const scale = Math.max(1, Math.abs(left), Math.abs(right));
	return Math.abs(left - right) <= 1e-5 * scale;
}

function deepEqual(left: unknown, right: unknown): boolean {
	if (typeof left === 'number' && typeof right === 'number') {
		return numbersEqual(left, right);
	}
	if (left === right) {
		return true;
	}
	if (Array.isArray(left) && Array.isArray(right)) {
		if (left.length !== right.length) {
			return false;
		}
		return left.every((item, index) => deepEqual(item, right[index]));
	}
	if (
		typeof left === 'object' &&
		left !== null &&
		typeof right === 'object' &&
		right !== null &&
		!Array.isArray(left) &&
		!Array.isArray(right)
	) {
		const leftRecord = left as Record<string, unknown>;
		const rightRecord = right as Record<string, unknown>;
		const leftKeys = Object.keys(leftRecord);
		const rightKeys = Object.keys(rightRecord);
		if (leftKeys.length !== rightKeys.length) {
			return false;
		}
		return leftKeys.every(
			(key) => Object.prototype.hasOwnProperty.call(rightRecord, key) && deepEqual(leftRecord[key], rightRecord[key])
		);
	}
	return false;
}

function deepUnorderedEqual(left: unknown, right: unknown): boolean {
	if (Array.isArray(left) && Array.isArray(right)) {
		if (left.length !== right.length) {
			return false;
		}
		const used = new Array<boolean>(right.length).fill(false);
		return left.every((item) => {
			const index = right.findIndex(
				(candidate, candidateIndex) => !used[candidateIndex] && deepUnorderedEqual(item, candidate)
			);
			if (index < 0) {
				return false;
			}
			used[index] = true;
			return true;
		});
	}
	return deepEqual(left, right);
}

function normalizeWhitespace(text: string): string {
	return text.replace(/\s+/g, ' ').trim();
}

export interface CompareOptions {
	inPlace?: boolean;
	unordered?: boolean;
}

export function compareOutput(expected: string, actual: string, options: CompareOptions = {}): CompareResult {
	const expectedText = expected.trim();
	const actualText = actual.trim();
	if (normalizeWhitespace(expectedText) === normalizeWhitespace(actualText)) {
		return { pass: true, exact: true };
	}
	const parsedExpected = parseJson(expectedText);
	const parsedActual = parseJson(actualText);
	if (parsedExpected.ok && parsedActual.ok) {
		if (deepEqual(parsedExpected.value, parsedActual.value)) {
			return { pass: true, exact: false, note: 'Matched (formatting differs)' };
		}
		if (options.unordered && deepUnorderedEqual(parsedExpected.value, parsedActual.value)) {
			return { pass: true, exact: false, note: 'Matched ignoring element order' };
		}
		if (
			options.inPlace &&
			Array.isArray(parsedExpected.value) &&
			Array.isArray(parsedActual.value) &&
			parsedExpected.value.length <= parsedActual.value.length &&
			deepEqual(parsedExpected.value, parsedActual.value.slice(0, parsedExpected.value.length))
		) {
			return { pass: true, exact: false, note: 'Matched the prefix of the mutated input (in-place result)' };
		}
	}
	return { pass: false, exact: false };
}