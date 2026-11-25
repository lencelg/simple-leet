import * as path from 'node:path';
import * as vscode from 'vscode';
import { createClient } from '../leetcode/auth';
import { loadProblem } from '../leetcode/problems';
import { Services } from '../services';
import { Site } from '../types/problem';
import { logInfo } from '../util/log';
import { isSite, problemUrl, siteLabel } from '../util/site';
import { ensureSolutionFile, getProblemReferenceForFile, MISSING_PROBLEM_REFERENCE } from '../workspace/problemStore';
import { pickLanguage } from './languagePicker';

function activeUri(uriArg?: unknown): vscode.Uri | undefined {
	return uriArg instanceof vscode.Uri ? uriArg : vscode.window.activeTextEditor?.document.uri;
}

export async function showProblem(services: Services, slugArg?: unknown, siteArg?: unknown): Promise<void> {
	if (typeof slugArg !== 'string' || !slugArg.trim()) {
		await vscode.commands.executeCommand('simple-leet.searchProblems');
		return;
	}
	const site: Site = isSite(siteArg) ? siteArg : services.store.activeSite;
	const client = await createClient(services.store, site);
	const detail = await vscode.window.withProgress(
		{ location: vscode.ProgressLocation.Notification, title: `Loading problem from ${siteLabel(site)}...` },
		() => loadProblem(client, slugArg)
	);
	const language = await pickLanguage(detail);
	if (!language) {
		return;
	}
	const solution = await ensureSolutionFile(detail, site, language.language.slug);
	await vscode.window.showTextDocument(solution.uri, {
		viewColumn: vscode.ViewColumn.One,
		preview: false,
		preserveFocus: false,
	});
	services.description.show(detail, site);
	logInfo(`Opened ${detail.titleSlug} (${language.language.slug}) from ${site}.`);
}

export async function changeLanguage(services: Services, uriArg?: unknown): Promise<void> {
	const uri = activeUri(uriArg);
	if (!uri) {
		throw new Error('Open a LeetCode solution file first.');
	}
	const reference = await getProblemReferenceForFile(uri);
	if (!reference) {
		throw new Error(MISSING_PROBLEM_REFERENCE);
	}
	const client = await createClient(services.store, reference.site);
	const detail = await vscode.window.withProgress(
		{ location: vscode.ProgressLocation.Notification, title: 'Loading available languages...' },
		() => loadProblem(client, reference.titleSlug)
	);
	const language = await pickLanguage(detail);
	if (!language) {
		return;
	}
	const solution = await ensureSolutionFile(detail, reference.site, language.language.slug);
	await vscode.window.showTextDocument(solution.uri, {
		viewColumn: vscode.ViewColumn.One,
		preview: false,
	});
	if (!solution.created) {
		void vscode.window.showInformationMessage(`Opened existing ${path.basename(solution.uri.fsPath)}.`);
	}
}

export async function openInBrowser(services: Services, uriArg?: unknown): Promise<void> {
	const uri = activeUri(uriArg);
	if (!uri) {
		throw new Error('Open a LeetCode solution file first.');
	}
	const reference = await getProblemReferenceForFile(uri);
	if (!reference) {
		throw new Error(MISSING_PROBLEM_REFERENCE);
	}
	await vscode.env.openExternal(vscode.Uri.parse(problemUrl(reference.site, reference.titleSlug)));
}