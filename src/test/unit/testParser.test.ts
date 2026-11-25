import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	allowsAnyOrder,
	extractExpectedOutputs,
	groupExampleTestcases,
	splitExampleTestcases,
} from '../../runner/testParser';

test('splits example testcases into trimmed non-empty lines', () => {
	const lines = splitExampleTestcases('[2,7,11,15]\n9\n\n[3,2,4]\r\n6\n');
	assert.deepEqual(lines, ['[2,7,11,15]', '9', '[3,2,4]', '6']);
});

test('groups example testcases by parameter name', () => {
	const cases = groupExampleTestcases('[2,7,11,15]\n9\n[3,2,4]\n6', ['nums', 'target']);
	assert.equal(cases.length, 2);
	assert.deepEqual(cases[0].args, [[2, 7, 11, 15], 9]);
	assert.equal(cases[0].input, 'nums = [2,7,11,15], target = 9');
	assert.deepEqual(cases[1].args, [[3, 2, 4], 6]);
});

test('rejects example testcases that do not align with parameters', () => {
	assert.throws(() => groupExampleTestcases('[1]\n2\n3', ['a', 'b']), /align/i);
});

test('extracts English expected outputs from problem HTML', () => {
	const html = `
		<p>Example 1:</p>
		<pre>
		<strong>Input:</strong> nums = [2,7,11,15], target = 9
		<strong>Output:</strong> [0,1]
		<strong>Explanation:</strong> Because nums[0] + nums[1] == 9, we return [0, 1].
		</pre>
		<pre>
		<strong>Input:</strong> nums = [3,2,4], target = 6
		<strong>Output:</strong> [1,2]
		</pre>
		<pre>
		<strong>Constraints:</strong>
		2 &lt;= nums.length &lt;= 10^4
		</pre>`;
	assert.deepEqual(extractExpectedOutputs(html), ['[0,1]', '[1,2]']);
});

test('extracts Chinese expected outputs and decodes entities', () => {
	const html = `
		<pre>
		<strong>输入：</strong>s = &quot;abc&quot;
		<strong>输出：</strong>&quot;abc&quot;
		<strong>解释：</strong>示例说明
		</pre>`;
	assert.deepEqual(extractExpectedOutputs(html), ['"abc"']);
});

test('extracts examples from paragraph-based HTML (leetcode.com)', () => {
	const html = `
		<p><strong>Example 1:</strong></p>
		<p><strong>Input:</strong> <code>nums = [2,7,11,15], target = 9</code></p>
		<p><strong>Output:</strong> <code>[0,1]</code></p>
		<p><strong>Explanation:</strong></p>
		<p>The sum of nums[0] and nums[1] is 9.</p>
		<p><strong>Example 2:</strong></p>
		<p><strong>Input:</strong> <code>nums = [3,2,4], target = 6</code></p>
		<p><strong>Output:</strong> <code>[1,2]</code></p>`;
	assert.deepEqual(extractExpectedOutputs(html), ['[0,1]', '[1,2]']);
});

test('extracts an output that follows an input label', () => {
	const html = '<pre>Input: [1,2,3]</pre><pre>Output: 6</pre>';
	assert.deepEqual(extractExpectedOutputs(html), ['6']);
});

test('ignores output labels without a preceding input', () => {
	const html = '<p><strong>Output:</strong> 42</p>';
	assert.deepEqual(extractExpectedOutputs(html), []);
});

test('detects problems that allow any order', () => {
	assert.equal(allowsAnyOrder('<p>You can return the answer in any order.</p>'), true);
	assert.equal(allowsAnyOrder('<p>请按任意顺序返回答案。</p>'), true);
	assert.equal(allowsAnyOrder('<p>Notice that the order of the output does not matter.</p>'), true);
	assert.equal(allowsAnyOrder('<p>注意，输出的顺序和三元组的顺序并不重要。</p>'), true);
	assert.equal(allowsAnyOrder('<p>Return the sorted array.</p>'), false);
});