import * as vscode from 'vscode';
import { languageByFileName } from '../languages';
import { createClient, ensureSignedInClient } from '../leetcode/auth';
import { loadProblem } from '../leetcode/problems';
import { buildSubmissionReport, waitForSubmission } from '../leetcode/submissions';
import { Services } from '../services';
import { SubmissionCheckResponse } from '../types/submission';
import { errorMessage } from '../util/errors';
import { logInfo } from '../util/log';
import { siteLabel } from '../util/site';
import { getProblemMetaForFile, readSolutionText, writeMetaFile } from '../workspace/problemStore';
import { extractSubmissionCode } from '../workspace/submissionCode';

export async function submitSolution(services: Services, uriArg?: unknown): Promise<void> {
	const uri = uriArg instanceof vscode.Uri ? uriArg : vscode.window.activeTextEditor?.document.uri;
	if (!uri) {
		throw new Error('Open a LeetCode solution file first.');
	}
	const problem = await getProblemMetaForFile(uri);
	if (!problem) {
		throw new Error('This file is not inside a Simple Leet problem folder.');
	}
	const language = languageByFileName(uri.fsPath);
	if (!language) {
		throw new Error('This file type is not associated with a supported submission language.');
	}
	const meta = problem.meta;
	let questionId = Number.parseInt(meta.questionId, 10);
	if (!Number.isInteger(questionId) || questionId <= 0) {
		const client = await createClient(services.store, meta.site);
		const detail = await vscode.window.withProgress(
			{ location: vscode.ProgressLocation.Notification, title: 'Loading problem information...' },
			() => loadProblem(client, meta.titleSlug, true)
		);
		await writeMetaFile(problem.folder, detail, meta.site);
		meta.questionId = detail.questionId;
		meta.title = detail.title;
		questionId = Number.parseInt(detail.questionId, 10);
		if (!Number.isInteger(questionId) || questionId <= 0) {
			throw new Error('Could not determine the LeetCode question id for this problem.');
		}
	}

	const client = await ensureSignedInClient(services.store, meta.site);
	if (!client) {
		return;
	}
	const session = await services.store.get(meta.site);
	if (!session?.csrfToken) {
		throw new Error(
			'The csrftoken cookie is missing from the saved session. Sign out, then sign in again with the full cookie header.'
		);
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
	const code = submission.code;

	logInfo(
		`Submitting ${meta.titleSlug} (${language.slug})${submission.marked ? ' using the marked section' : ''} to ${meta.site}...`
	);
	const submissionId = await vscode.window.withProgress(
		{ location: vscode.ProgressLocation.Notification, title: `Submitting to ${siteLabel(meta.site)}...` },
		() => client.submitSolution(questionId, language.slug, code, meta.titleSlug)
	);
	logInfo(`Submission #${submissionId} created for ${meta.titleSlug}.`);

	const timeoutMs = vscode.workspace.getConfiguration('simple-leet').get<number>('submissionTimeoutMs', 60000);
	let response: SubmissionCheckResponse | undefined;
	try {
		response = await vscode.window.withProgress(
			{ location: vscode.ProgressLocation.Notification, title: `Judging: ${meta.title}`, cancellable: true },
			async (progress, token) => {
				progress.report({ message: `Submission #${submissionId}` });
				return waitForSubmission(client, submissionId, {
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

	const report = buildSubmissionReport(meta.title, meta.site, submissionId, response);
	services.results.showSubmissionReport(report);
	logInfo(`Submission #${submissionId} (${meta.titleSlug}) finished: ${report.statusName}.`);
	if (report.accepted) {
		void vscode.window.showInformationMessage(
			`Accepted: ${meta.title}${report.runtime ? ` (${report.runtime})` : ''}.`
		);
	} else {
		void vscode.window.showWarningMessage(
			`Submission result: ${report.statusName}. See the result panel for details.`
		);
	}
}