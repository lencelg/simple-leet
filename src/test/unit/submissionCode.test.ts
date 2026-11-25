import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { languageBySlug } from '../../languages';
import {
	extractSubmissionCode,
	SUBMIT_END_MARKER,
	SUBMIT_START_MARKER,
	submissionMarkers,
} from '../../workspace/submissionCode';

const fullText = `// 1. Two Sum
// @simple-leet:submit-start
class Solution {
public:
    int f() { return 1; }
};
// @simple-leet:submit-end

int main() { return 0; }
`;

test('extracts only the marked submission section', () => {
	const result = extractSubmissionCode(fullText);
	assert.equal(result.marked, true);
	assert.equal(result.warning, undefined);
	assert.equal(result.code, 'class Solution {\npublic:\n    int f() { return 1; }\n};');
});

test('falls back to the whole file when no markers exist', () => {
	const text = 'class Solution {};';
	assert.deepEqual(extractSubmissionCode(text), { code: text, marked: false });
});

test('falls back with a warning when markers are incomplete', () => {
	const text = '// @simple-leet:submit-start\nclass Solution {};';
	const result = extractSubmissionCode(text);
	assert.equal(result.marked, false);
	assert.match(result.warning ?? '', /incomplete/i);
	assert.equal(result.code, text);
});

test('falls back when the end marker precedes the start marker', () => {
	const text = '// @simple-leet:submit-end\nclass Solution {};\n// @simple-leet:submit-start';
	const result = extractSubmissionCode(text);
	assert.equal(result.marked, false);
	assert.match(result.warning ?? '', /incomplete/i);
});

test('reports an empty marked section', () => {
	const text = '// @simple-leet:submit-start\n// @simple-leet:submit-end';
	const result = extractSubmissionCode(text);
	assert.equal(result.marked, true);
	assert.equal(result.code, '');
	assert.match(result.warning ?? '', /empty/i);
});

test('uses language-specific marker comments', () => {
	const python = languageBySlug('python3');
	assert.ok(python);
	const markers = submissionMarkers(python);
	assert.equal(markers.start, `# ${SUBMIT_START_MARKER}`);
	assert.equal(markers.end, `# ${SUBMIT_END_MARKER}`);
});