import * as path from 'node:path';
import * as vscode from 'vscode';
import { createClient } from '../leetcode/auth';
import { loadProblem } from '../leetcode/problems';
import { Services } from '../services';
import { Site } from '../types/problem';
import { logInfo } from '../util/log';
import { isSite, problemUrl, siteLabel } from '../util/site';
import { ensureSolutionFile, getProblemReferenceForFile, MISSING_PROBLEM_REFERENCE } from '../workspace/problemStore';
import { availableLanguages, AvailableLanguage } from '../workspace/templateGenerator';

function activeUri(uriArg?: unknown): vscode.Uri | undefined {
	return uriArg instanceof vscode.Uri ? uriArg : vscode.window.activeTextEditor?.document.uri;
}

function firstLine(code: string): string {
	const line = code.split('\n').map((item) => item.trim()).find((item) => item.length > 0);
	return line ? line.slice(0, 100) : '';
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
	const available = availableLanguages(detail);
	if (available.length === 0) {
		throw new Error('This problem does not provide code snippets for a supported language.');
	}
	const configured = vscode.workspace.getConfiguration('simple-leet').get<string>('defaultLanguage', 'cpp');
	let selected: AvailableLanguage | undefined = available.find((entry) => entry.language.slug === configured);
	if (!selected) {
		selected = available.find((entry) => entry.language.slug === 'cpp') ?? available[0];
		if (configured !== selected.language.slug) {
			void vscode.window.showInformationMessage(
				`${configured} is not available for this problem; opened ${selected.language.name} instead.`
			);
		}
	}
	const solution = await ensureSolutionFile(detail, site, selected.language.slug);
	await vscode.window.showTextDocument(solution.uri, {
		viewColumn: vscode.ViewColumn.One,
		preview: false,
		preserveFocus: false,
	});
	services.description.show(detail, site);
	logInfo(`Opened ${detail.titleSlug} (${selected.language.slug}) from ${site}.`);
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
	const available = availableLanguages(detail);
	if (available.length === 0) {
		throw new Error('This problem does not provide code snippets for a supported language.');
	}
	const picked = await vscode.window.showQuickPick(
		available.map((entry) => ({
			label: entry.language.name,
			description: entry.language.slug,
			detail: firstLine(entry.snippet.code),
			language: entry.language,
		})),
		{ title: 'Change Language', placeHolder: 'Generate or open the solution in another language' }
	);
	if (!picked) {
		return;
	}
	const solution = await ensureSolutionFile(detail, reference.site, picked.language.slug);
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