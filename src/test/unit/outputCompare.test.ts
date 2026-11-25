import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareOutput } from '../../runner/outputCompare';

test('matches identical output', () => {
	assert.deepEqual(compareOutput('[0,1]', '[0,1]'), { pass: true, exact: true });
});

test('matches numbers with different formatting', () => {
	const result = compareOutput('2.00000', '2.0');
	assert.equal(result.pass, true);
	assert.equal(result.exact, false);
});

test('matches arrays with different whitespace', () => {
	assert.equal(compareOutput('[0, 1]', '[0,1]').pass, true);
});

test('matches arrays ignoring order only when the problem allows it', () => {
	const unordered = compareOutput('[[-1,0,1],[-1,-1,2]]', '[[-1,-1,2],[-1,0,1]]', { unordered: true });
	assert.equal(unordered.pass, true);
	assert.match(unordered.note ?? '', /order/i);
	assert.equal(compareOutput('[1,2,3]', '[3,2,1]').pass, false);
});

test('matches nested arrays ignoring inner order when requested', () => {
	const result = compareOutput(
		'[["bat"],["nat","tan"],["ate","eat","tea"]]',
		'[["bat"],["eat","tea","ate"],["tan","nat"]]',
		{ unordered: true }
	);
	assert.equal(result.pass, true);
	assert.match(result.note ?? '', /order/i);
});

test('rejects different values', () => {
	const result = compareOutput('[0,1]', '[0,2]');
	assert.equal(result.pass, false);
	assert.equal(result.exact, false);
});

test('matches quoted strings', () => {
	assert.equal(compareOutput('"abc"', '"abc"').pass, true);
});

test('matches mutated input prefixes for in-place problems', () => {
	const result = compareOutput('[1,2]', '[1,2,2]', { inPlace: true });
	assert.equal(result.pass, true);
	assert.match(result.note ?? '', /prefix/i);
	assert.equal(compareOutput('[1,2]', '[1,2,2]').pass, false);
});