import * as vscode from 'vscode';
import { languageByFileName } from '../languages';
import { ensureSignedInClient } from '../leetcode/auth';
import { loadProblem, parseMethodSignature } from '../leetcode/problems';
import { buildTestReport, waitForSubmission } from '../leetcode/submissions';
import { resolveTestInput } from '../leetcode/testInput';
import { Services } from '../services';
import { SubmissionCheckResponse } from '../types/submission';
import { errorMessage } from '../util/errors';
import { logInfo } from '../util/log';
import { siteLabel } from '../util/site';
import {
	getProblemReferenceForFile,
	MISSING_PROBLEM_REFERENCE,
	readSolutionText,
} from '../workspace/problemStore';
import { extractSubmissionCode } from '../workspace/submissionCode';

export async function runTests(services: Services, uriArg?: unknown): Promise<void> {
	const uri = uriArg instanceof vscode.Uri ? uriArg : vscode.window.activeTextEditor?.document.uri;
	if (!uri) {
		throw new Error('Open a LeetCode solution file first.');
	}
	const reference = await getProblemReferenceForFile(uri);
	if (!reference) {
		throw new Error(MISSING_PROBLEM_REFERENCE);
	}
	const language = languageByFileName(uri.fsPath);
	if (!language) {
		throw new Error('This file type is not associated with a supported language.');
	}
	const source = await readSolutionText(uri);
	const submission = extractSubmissionCode(source);
	if (!submission.code.trim()) {
		throw new Error(
			'The marked submission section is empty. Move your solution between the submit markers.'
		);
	}
	if (submission.warning) {
		logInfo(submission.warning);
		void vscode.window.showWarningMessage(submission.warning);
	}

	const client = await ensureSignedInClient(services.store, reference.site);
	if (!client) {
		return;
	}
	const session = await services.store.get(reference.site);
	if (!session?.csrfToken) {
		throw new Error(
			'The csrftoken cookie is missing from the saved session. Sign out, then sign in again with the full cookie header.'
		);
	}
	const detail = await vscode.window.withProgress(
		{ location: vscode.ProgressLocation.Notification, title: 'Loading problem information...' },
		() => loadProblem(client, reference.titleSlug)
	);
	const questionId = Number.parseInt(detail.questionId, 10);
	if (!Number.isInteger(questionId) || questionId <= 0) {
		throw new Error('Could not determine the LeetCode question id for this problem.');
	}
	const paramCount = parseMethodSignature(detail.metaData)?.params.length ?? 1;
	const dataInput = resolveTestInput(detail.sampleTestCase, detail.exampleTestcases, paramCount);
	if (!dataInput.trim()) {
		throw new Error('No sample test case is available for this problem. Use Submit Solution instead.');
	}

	const interpret = await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: `Running tests on ${siteLabel(reference.site)}...`,
		},
		() =>
			client.runSolution(
				questionId,
				language.slug,
				submission.code,
				reference.titleSlug,
				dataInput
			)
	);
	logInfo(`Test run ${interpret.interpretId} created for ${reference.titleSlug}.`);

	const timeoutMs = vscode.workspace.getConfiguration('simple-leet').get<number>('submissionTimeoutMs', 60000);
	let response: SubmissionCheckResponse | undefined;
	try {
		response = await vscode.window.withProgress(
			{ location: vscode.ProgressLocation.Notification, title: `Testing: ${detail.title}`, cancellable: true },
			async (progress, token) => {
				progress.report({ message: `Test run ${interpret.interpretId}` });
				return waitForSubmission(client, interpret.interpretId, {
					timeoutMs,
					shouldCancel: () => token.isCancellationRequested,
					onPoll: (attempt) => progress.report({ message: `Waiting for the judge... (${attempt})` }),
				});
			}
		);
	} catch (error) {
		if (errorMessage(error).startsWith('Stopped waiting')) {
			void vscode.window.showInformationMessage(errorMessage(error));
			return;
		}
		throw error;
	}
	if (!response) {
		return;
	}

	const report = buildTestReport(detail.title, reference.site, reference.titleSlug, response);
	services.results.showTestReport(report);
	logInfo(`Test run ${interpret.interpretId} (${reference.titleSlug}) finished: ${report.statusName}.`);
	if (report.accepted) {
		void vscode.window.showInformationMessage(`Test passed: ${detail.title}.`);
	} else {
		void vscode.window.showWarningMessage(
			`Test result: ${report.statusName}. See the results panel for details.`
		);
	}
}