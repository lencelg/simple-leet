import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { languageByFileName } from '../languages';
import { createClient } from '../leetcode/auth';
import { loadProblem, parseMethodSignature } from '../leetcode/problems';
import {
	compileCpp,
	CompileResult,
	createTempWorkDir,
	findCppCompiler,
	removeTempWorkDir,
	runCase,
} from '../runner/cppRunner';
import { generateCppHarness } from '../runner/cppHarness';
import { compareOutput } from '../runner/outputCompare';
import { groupExampleTestcases } from '../runner/testParser';
import { Services } from '../services';
import { LocalTestCase, TestRunReport } from '../types/test';
import { errorMessage } from '../util/errors';
import { logInfo } from '../util/log';
import { readSolutionText, getProblemMetaForFile, writeMetaFile } from '../workspace/problemStore';
import { extractSubmissionCode } from '../workspace/submissionCode';

export async function runTests(services: Services, uriArg?: unknown): Promise<void> {
	const uri = uriArg instanceof vscode.Uri ? uriArg : vscode.window.activeTextEditor?.document.uri;
	if (!uri) {
		throw new Error('Open a C++ solution file first.');
	}
	const problem = await getProblemMetaForFile(uri);
	if (!problem) {
		throw new Error('This file is not inside a Simple Leet problem folder. Open a problem from the sidebar first.');
	}
	const language = languageByFileName(uri.fsPath);
	if (!language) {
		throw new Error('This file type is not associated with a supported language.');
	}
	if (language.slug !== 'cpp') {
		void vscode.window.showInformationMessage(
			`Local tests currently support C++ only. Use "LeetCode: Submit Solution" to judge ${language.name} online.`
		);
		return;
	}

	let meta = problem.meta;
	const missingCore = !meta.exampleTestcases || !meta.metaData;
	if (missingCore || meta.expectedOutputs === undefined) {
		try {
			const client = await createClient(services.store, meta.site);
			const detail = await vscode.window.withProgress(
				{ location: vscode.ProgressLocation.Notification, title: 'Loading problem test data...' },
				() => loadProblem(client, meta.titleSlug, true)
			);
			await writeMetaFile(problem.folder, detail, meta.site);
			const refreshed = await getProblemMetaForFile(uri);
			if (refreshed) {
				meta = refreshed.meta;
			}
		} catch (error) {
			if (missingCore) {
				throw error;
			}
			logInfo(`Could not refresh expected outputs for ${meta.titleSlug}: ${errorMessage(error)}`);
		}
	}
	if (!meta.exampleTestcases || !meta.metaData) {
		throw new Error('Could not load example test data for this problem. Submit online instead.');
	}

	const signature = parseMethodSignature(meta.metaData);
	if (!signature) {
		throw new Error(
			'Local testing does not support this problem type (missing method signature). Use Submit Solution to judge online.'
		);
	}
	if (signature.manual) {
		throw new Error(
			'This problem uses a custom judge or special data types, so it cannot be tested locally. Use Submit Solution instead.'
		);
	}
	const testcases = groupExampleTestcases(
		meta.exampleTestcases,
		signature.params.map((param) => param.name)
	);
	const expectedOutputs = Array.isArray(meta.expectedOutputs) ? meta.expectedOutputs : [];
	const source = await readSolutionText(uri);
	const submission = extractSubmissionCode(source);
	if (submission.warning) {
		logInfo(`Local tests: ${submission.warning}`);
	}
	if (!submission.code.trim()) {
		throw new Error(
			'The marked submission section is empty. Move your solution between the submit markers.'
		);
	}
	const harness = generateCppHarness({
		signature,
		cases: testcases.map((testcase) => testcase.args),
		solutionCode: submission.code,
	});

	const config = vscode.workspace.getConfiguration('simple-leet');
	const compilerPreference = config.get<string>('compilerPath', '');
	const compiler = await findCppCompiler(compilerPreference);
	if (!compiler) {
		throw new Error('No C++ compiler was found. Install g++ or clang++, or set "simple-leet.compilerPath".');
	}
	const timeoutMs = config.get<number>('testTimeoutMs', 10000);

	const workDir = await createTempWorkDir();
	try {
		const sourcePath = path.join(workDir, 'main.cpp');
		await fs.writeFile(sourcePath, harness, 'utf8');

		let compileResult: CompileResult | undefined;
		let binaryPath: string | undefined;
		const cases: LocalTestCase[] = [];
		let passed = 0;

		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: `Running local tests: ${meta.title}`,
				cancellable: false,
			},
			async (progress) => {
				progress.report({ message: `Compiling with ${compiler}` });
				compileResult = await compileCpp(sourcePath, workDir, compiler);
				if (!compileResult.ok || !compileResult.binaryPath) {
					return;
				}
				binaryPath = compileResult.binaryPath;
				for (let index = 0; index < testcases.length; index += 1) {
					progress.report({
						message: `Case ${index + 1}/${testcases.length}`,
						increment: 100 / testcases.length,
					});
					const execution = await runCase(binaryPath, index, timeoutMs, workDir);
					const stdoutLines = execution.stdout
						.split(/\r?\n/)
						.filter((line) => line.trim().length > 0);
					const actual = stdoutLines.length > 0 ? stdoutLines[stdoutLines.length - 1].trim() : '';
					const expected = expectedOutputs[index];
					const processOk = !execution.timedOut && execution.code === 0;
					// Display formats such as "2, nums = [1,2,_]" come from special in-place judges.
					const specialJudge =
						expected !== undefined &&
						/^(?:-?\d+(?:\.\d+)?|true|false)\s*,\s*[A-Za-z_][A-Za-z0-9_]*\s*=/.test(expected);
					const comparison =
						expected !== undefined && !specialJudge
							? compareOutput(expected, actual, {
									inPlace: signature.returnType === 'void',
									unordered: meta.anyOrder === true,
								})
							: undefined;
					const casePassed =
						expected === undefined
							? undefined
							: specialJudge
								? processOk
									? undefined
									: false
								: processOk && Boolean(comparison?.pass);
					if (casePassed) {
						passed += 1;
					}
					const stderrParts: string[] = [];
					if (execution.stderr.trim()) {
						stderrParts.push(execution.stderr.trim());
					}
					if (execution.timedOut) {
						stderrParts.push(`Time limit exceeded (${timeoutMs} ms).`);
					} else if (execution.code !== null && execution.code !== 0) {
						stderrParts.push(`Process exited with code ${execution.code}.`);
					}
					cases.push({
						index,
						input: testcases[index].input,
						expected,
						actual,
						stderr: stderrParts.join('\n') || undefined,
						passed: casePassed,
						exact: comparison?.exact,
						note: specialJudge
							? 'Special judge: the expected output includes a mutated array. Compare manually or submit to LeetCode.'
							: comparison?.note ??
								(expected === undefined ? 'No expected output was available for this case.' : undefined),
						timedOut: execution.timedOut,
						durationMs: execution.durationMs,
					});
				}
			}
		);

		const expectedAvailable = expectedOutputs.length > 0;
		if (!compileResult || !compileResult.ok || !binaryPath) {
			const compileError = !compileResult
				? 'The compiler did not run.'
				: compileResult.ok
					? 'The compiler did not produce an executable.'
					: compileResult.error ?? 'Compilation failed.';
			const report: TestRunReport = {
				problemTitle: meta.title,
				compiler,
				compileError,
				cases: [],
				passed: 0,
				total: testcases.length,
				skipped: 0,
				expectedAvailable,
			};
			services.results.showTestReport(report);
			logInfo(`Local tests for ${meta.titleSlug} failed to compile.`);
			void vscode.window.showWarningMessage('Local tests: compilation failed. See the result panel for details.');
			return;
		}

		const skipped = cases.filter(
			(testCase) => typeof testCase.expected === 'string' && testCase.passed === undefined
		).length;
		const judgedTotal = testcases.length - skipped;
		const report: TestRunReport = {
			problemTitle: meta.title,
			compiler,
			cases,
			passed,
			total: testcases.length,
			skipped,
			expectedAvailable,
		};
		services.results.showTestReport(report);
		logInfo(
			`Local tests for ${meta.titleSlug}: ${passed}/${judgedTotal} comparable case(s) passed, ${skipped} skipped.`
		);
		const suffix = skipped > 0 ? ` ${skipped} case(s) were skipped by a special judge.` : '';
		if (!expectedAvailable) {
			void vscode.window.showInformationMessage(
				`Ran ${testcases.length} example case(s). No expected outputs were available for comparison.`
			);
		} else if (judgedTotal === 0) {
			void vscode.window.showInformationMessage(
				`Ran ${testcases.length} example case(s). These use a special judge, so outputs were not compared.`
			);
		} else if (passed === judgedTotal) {
			void vscode.window.showInformationMessage(
				`All ${judgedTotal} comparable example case(s) passed.${suffix}`
			);
		} else {
			void vscode.window.showWarningMessage(
				`${passed}/${judgedTotal} comparable example case(s) matched the expected output.${suffix} See the result panel.`
			);
		}
	} finally {
		await removeTempWorkDir(workDir);
	}
}