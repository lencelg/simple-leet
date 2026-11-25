import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveTestInput } from '../../leetcode/testInput';

test('prefers the sample test case', () => {
	assert.equal(resolveTestInput('[2,7,11,15]\n9', '[3,2,4]\n6', 2), '[2,7,11,15]\n9');
});

test('falls back to the first example input using the parameter count', () => {
	assert.equal(resolveTestInput('', '[2,7,11,15]\n9\n[3,2,4]\n6', 2), '[2,7,11,15]\n9');
});

test('returns an empty string when no test input exists', () => {
	assert.equal(resolveTestInput('  ', '  ', 2), '');
});