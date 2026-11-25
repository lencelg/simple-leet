import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateCppHarness, UnsupportedProblemError } from '../../runner/cppHarness';

const twoSumSolution = `class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        return {0, 1};
    }
};`;

test('generates a harness for primitive and vector parameters', () => {
	const harness = generateCppHarness({
		signature: {
			name: 'twoSum',
			params: [
				{ name: 'nums', type: 'integer[]' },
				{ name: 'target', type: 'integer' },
			],
			returnType: 'integer[]',
		},
		cases: [[[2, 7, 11, 15], 9]],
		solutionCode: twoSumSolution,
	});
	assert.match(harness, /#include <bits\/stdc\+\+\.h>/);
	assert.match(harness, /vector<int> __slArg0 = vector<int>\{2, 7, 11, 15\};/);
	assert.match(harness, /int __slArg1 = 9;/);
	assert.match(harness, /auto __slResult = __slSolution\.twoSum\(__slArg0, __slArg1\);/);
	assert.match(harness, /case 0:/);
	assert.match(harness, /class Solution/);
});

test('generates tree literals with null placeholders', () => {
	const harness = generateCppHarness({
		signature: {
			name: 'levelOrder',
			params: [{ name: 'root', type: 'TreeNode' }],
			returnType: 'integer[][]',
		},
		cases: [[[3, 9, 20, null, null, 15, 7]]],
		solutionCode: 'class Solution { public: vector<vector<int>> levelOrder(TreeNode* root) { return {}; } };',
	});
	assert.match(harness, /TreeNode\* __slArg0 = __slBuildTree\(\{3, 9, 20, std::nullopt, std::nullopt, 15, 7\}\);/);
	assert.match(harness, /vector<vector<int>>/);
});

test('prints the first argument for void methods', () => {
	const harness = generateCppHarness({
		signature: {
			name: 'sortColors',
			params: [{ name: 'nums', type: 'integer[]' }],
			returnType: 'void',
		},
		cases: [[[2, 0, 2, 1, 1, 0]]],
		solutionCode: 'class Solution { public: void sortColors(vector<int>& nums) {} };',
	});
	assert.match(harness, /__slSolution\.sortColors\(__slArg0\);/);
	assert.match(harness, /cout << __slJson\(__slArg0\) << endl;/);
});

test('supports list<...> generic types', () => {
	const harness = generateCppHarness({
		signature: {
			name: 'groupAnagrams',
			params: [{ name: 'strs', type: 'list<string>' }],
			returnType: 'list<list<string>>',
		},
		cases: [[['eat', 'tea', 'tan', 'ate', 'nat', 'bat']]],
		solutionCode:
			'class Solution { public: vector<vector<string>> groupAnagrams(vector<string>& strs) { return {}; } };',
	});
	assert.match(harness, /vector<string> __slArg0 = vector<string>\{string\("eat"\), string\("tea"\)/);
	assert.match(harness, /vector<vector<string>>/);
});

test('supports arrays of linked lists', () => {
	const harness = generateCppHarness({
		signature: {
			name: 'mergeKLists',
			params: [{ name: 'lists', type: 'ListNode[]' }],
			returnType: 'ListNode',
		},
		cases: [[[[1, 4, 5], [1, 3, 4], [2, 6]]]],
		solutionCode: 'class Solution { public: ListNode* mergeKLists(vector<ListNode*>& lists) { return nullptr; } };',
	});
	assert.match(harness, /vector<ListNode\*> __slArg0 = vector<ListNode\*>\{__slBuildList\(vector<int>\{1, 4, 5\}\), __slBuildList\(vector<int>\{1, 3, 4\}\)/);
});

test('rejects manual judge problems', () => {
	assert.throws(
		() =>
			generateCppHarness({
				signature: {
					name: 'copyRandomList',
					params: [{ name: 'head', type: 'ListNode' }],
					returnType: 'ListNode',
					manual: true,
				},
				cases: [[[1, 2, 3]]],
				solutionCode: 'class Solution { public: ListNode* copyRandomList(ListNode* head) { return head; } };',
			}),
		/custom judge/i
	);
});

test('rejects unsupported parameter types', () => {
	assert.throws(
		() =>
			generateCppHarness({
				signature: {
					name: 'copyRandomList',
					params: [{ name: 'head', type: 'Node' }],
					returnType: 'Node',
				},
				cases: [[[]]],
				solutionCode: 'class Solution {};',
			}),
		UnsupportedProblemError
	);
});

test('rejects solutions that define main', () => {
	assert.throws(
		() =>
			generateCppHarness({
				signature: {
					name: 'twoSum',
					params: [{ name: 'nums', type: 'integer[]' }],
					returnType: 'integer[]',
				},
				cases: [[[[1]]]],
				solutionCode: 'int main() { return 0; }',
			}),
		/main/
	);
});