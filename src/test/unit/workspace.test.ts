import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseMethodSignature } from '../../leetcode/problems';
import { ProblemDetail } from '../../types/problem';
import {
	parseProblemReference,
	sanitizeProblemFileName,
} from '../../workspace/problemReference';
import { availableLanguages, buildSolutionTemplate } from '../../workspace/templateGenerator';

const detail: ProblemDetail = {
	questionId: '1',
	questionFrontendId: '1',
	title: 'Two Sum',
	titleSlug: 'two-sum',
	difficulty: 'Easy',
	paidOnly: false,
	acRate: 55.3,
	status: null,
	topicTags: [],
	content: '',
	exampleTestcases: '[2,7,11,15]\n9',
	metaData: {
		name: 'twoSum',
		params: [
			{ name: 'nums', type: 'integer[]' },
			{ name: 'target', type: 'integer' },
		],
		return: { type: 'integer[]' },
	},
	codeSnippets: [
		{ lang: 'C++', langSlug: 'cpp', code: 'class Solution {};' },
		{ lang: 'Python3', langSlug: 'python3', code: 'class Solution:\n    pass' },
		{ lang: 'Dart', langSlug: 'dart', code: 'class Solution {}' },
	],
	hints: [],
};

test('builds a C++ solution template with submit markers and a comment header', () => {
	const template = buildSolutionTemplate(detail, 'leetcode.cn', 'cpp');
	assert.ok(template);
	assert.equal(template.language.extension, '.cpp');
	assert.match(template.content, /^\/\/ 1\. Two Sum \(Easy\)/);
	assert.match(template.content, /https:\/\/leetcode\.cn\/problems\/two-sum\//);
	assert.match(template.content, /Only the code between the submit markers is sent to LeetCode\./);
	const start = template.content.indexOf('// @simple-leet:submit-start');
	const end = template.content.indexOf('// @simple-leet:submit-end');
	const snippet = template.content.indexOf('class Solution {};');
	assert.ok(start >= 0 && start < snippet && snippet < end);
});

test('uses language-specific comment prefixes and extensions', () => {
	const template = buildSolutionTemplate(detail, 'leetcode.com', 'python3');
	assert.ok(template);
	assert.equal(template.language.extension, '.py');
	assert.match(template.content, /^# 1\. Two Sum \(Easy\)/);
	const start = template.content.indexOf('# @simple-leet:submit-start');
	const end = template.content.indexOf('# @simple-leet:submit-end');
	const snippet = template.content.indexOf('class Solution:');
	assert.ok(start >= 0 && start < snippet && snippet < end);
});

test('returns undefined for languages without a snippet', () => {
	assert.equal(buildSolutionTemplate(detail, 'leetcode.com', 'java'), undefined);
});

test('lists only languages known to the extension', () => {
	const available = availableLanguages(detail);
	assert.deepEqual(
		available.map((entry) => entry.language.slug),
		['cpp', 'python3']
	);
});

test('parses method signatures including the manual judge flag', () => {
	assert.deepEqual(
		parseMethodSignature(
			JSON.stringify({ name: 'foo', params: [{ name: 'a', type: 'integer' }], return: { type: 'boolean' }, manual: true })
		),
		{
			name: 'foo',
			params: [{ name: 'a', type: 'integer' }],
			returnType: 'boolean',
			manual: true,
		}
	);
	assert.equal(parseMethodSignature({ classname: 'MyLinkedList' }), undefined);
});

test('parses the problem URL from a generated header', () => {
	assert.deepEqual(parseProblemReference('// https://leetcode.cn/problems/two-sum/'), {
		site: 'leetcode.cn',
		titleSlug: 'two-sum',
	});
	assert.deepEqual(parseProblemReference('See https://leetcode.com/problems/add-two-numbers/description/'), {
		site: 'leetcode.com',
		titleSlug: 'add-two-numbers',
	});
	assert.deepEqual(parseProblemReference('https://leetcode.cn/problems/two-sum'), {
		site: 'leetcode.cn',
		titleSlug: 'two-sum',
	});
	assert.equal(parseProblemReference('class Solution {};'), undefined);
});

test('sanitizes problem titles into file names', () => {
	assert.equal(sanitizeProblemFileName('两数之和', 'two-sum'), '两数之和');
	assert.equal(sanitizeProblemFileName('A/B:C?D*E', 'fallback'), 'A-B-C-D-E');
	assert.equal(sanitizeProblemFileName('   ', 'two-sum'), 'two-sum');
	assert.equal(sanitizeProblemFileName('CON', 'fallback'), '_CON');
});