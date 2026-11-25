import * as assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { test } from 'node:test';
import { compileCpp, createTempWorkDir, findCppCompiler, removeTempWorkDir, runCase } from '../../runner/cppRunner';
import { generateCppHarness } from '../../runner/cppHarness';
import { groupExampleTestcases } from '../../runner/testParser';

test('compiles and runs a two-sum solution against example cases', async (t) => {
	const compiler = await findCppCompiler();
	if (!compiler) {
		t.skip('No C++ compiler available');
		return;
	}
	const signature = {
		name: 'twoSum',
		params: [
			{ name: 'nums', type: 'integer[]' },
			{ name: 'target', type: 'integer' },
		],
		returnType: 'integer[]',
	};
	const testcases = groupExampleTestcases(
		'[2,7,11,15]\n9\n[3,2,4]\n6',
		signature.params.map((param) => param.name)
	);
	const solution = `class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> seen;
        for (int i = 0; i < (int)nums.size(); ++i) {
            auto it = seen.find(target - nums[i]);
            if (it != seen.end()) { return {it->second, i}; }
            seen[nums[i]] = i;
        }
        return {};
    }
};`;
	const harness = generateCppHarness({
		signature,
		cases: testcases.map((testcase) => testcase.args),
		solutionCode: solution,
	});
	const workDir = await createTempWorkDir();
	try {
		const sourcePath = path.join(workDir, 'main.cpp');
		await fs.writeFile(sourcePath, harness, 'utf8');
		const compiled = await compileCpp(sourcePath, workDir, compiler);
		assert.equal(compiled.ok, true, compiled.error);
		assert.ok(compiled.binaryPath);
		const first = await runCase(compiled.binaryPath, 0, 5000, workDir);
		assert.equal(first.code, 0, first.stderr);
		assert.equal(first.stdout.trim(), '[0,1]');
		const second = await runCase(compiled.binaryPath, 1, 5000, workDir);
		assert.equal(second.code, 0, second.stderr);
		assert.equal(second.stdout.trim(), '[1,2]');
	} finally {
		await removeTempWorkDir(workDir);
	}
});

test('builds and serializes tree inputs and outputs', async (t) => {
	const compiler = await findCppCompiler();
	if (!compiler) {
		t.skip('No C++ compiler available');
		return;
	}
	const signature = {
		name: 'invertTree',
		params: [{ name: 'root', type: 'TreeNode' }],
		returnType: 'TreeNode',
	};
	const solution = `class Solution {
public:
    TreeNode* invertTree(TreeNode* root) {
        if (root == nullptr) { return nullptr; }
        TreeNode* left = invertTree(root->left);
        TreeNode* right = invertTree(root->right);
        root->left = right;
        root->right = left;
        return root;
    }
};`;
	const harness = generateCppHarness({
		signature,
		cases: [[[4, 2, 7, 1, 3, 6, 9]]],
		solutionCode: solution,
	});
	const workDir = await createTempWorkDir();
	try {
		const sourcePath = path.join(workDir, 'main.cpp');
		await fs.writeFile(sourcePath, harness, 'utf8');
		const compiled = await compileCpp(sourcePath, workDir, compiler);
		assert.equal(compiled.ok, true, compiled.error);
		assert.ok(compiled.binaryPath);
		const run = await runCase(compiled.binaryPath, 0, 5000, workDir);
		assert.equal(run.code, 0, run.stderr);
		assert.equal(run.stdout.trim(), '[4,7,2,9,6,3,1]');
	} finally {
		await removeTempWorkDir(workDir);
	}
});