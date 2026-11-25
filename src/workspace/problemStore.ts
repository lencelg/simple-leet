import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { ProblemDetail, Site } from '../types/problem';
import {
	parseProblemReference,
	ProblemReference,
	sameProblem,
	sanitizeProblemFileName,
} from './problemReference';
import { buildSolutionTemplate, SolutionTemplate } from './templateGenerator';

export { MISSING_PROBLEM_REFERENCE } from './problemReference';

const HEADER_LINE_COUNT = 15;

function encode(text: string): Uint8Array {
	return new TextEncoder().encode(text);
}

function decode(data: Uint8Array): string {
	return new TextDecoder().decode(data);
}

function headerText(text: string): string {
	return text.split(/\r?\n/, HEADER_LINE_COUNT).join('\n');
}

async function pathExists(uri: vscode.Uri): Promise<boolean> {
	try {
		await vscode.workspace.fs.stat(uri);
		return true;
	} catch {
		return false;
	}
}

function expandHome(value: string): string {
	if (value === '~') {
		return os.homedir();
	}
	if (value.startsWith('~/') || value.startsWith('~\\')) {
		return path.join(os.homedir(), value.slice(2));
	}
	return value;
}

export async function getProblemRoot(): Promise<vscode.Uri> {
	const configured =
		vscode.workspace.getConfiguration('simple-leet').get<string>('solutionFolder', '~/.leetcode').trim() ||
		'~/.leetcode';
	const expanded = expandHome(configured);
	if (path.isAbsolute(expanded)) {
		return vscode.Uri.file(expanded);
	}
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	if (!workspaceFolder) {
		throw new Error(
			'Set an absolute "simple-leet.solutionFolder" (for example ~/.leetcode) or open a folder.'
		);
	}
	return vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, expanded));
}

export async function readSolutionText(uri: vscode.Uri): Promise<string> {
	const open = vscode.workspace.textDocuments.find((document) => document.uri.toString() === uri.toString());
	if (open) {
		return open.getText();
	}
	return decode(await vscode.workspace.fs.readFile(uri));
}

export async function getProblemReferenceForFile(fileUri: vscode.Uri): Promise<ProblemReference | undefined> {
	if (fileUri.scheme !== 'file' || path.basename(fileUri.fsPath) === 'meta.json') {
		return undefined;
	}
	try {
		return parseProblemReference(headerText(await readSolutionText(fileUri)));
	} catch {
		return undefined;
	}
}

type ExistingFile =
	| { exists: false }
	| { exists: true; reference?: ProblemReference };

async function existingFile(uri: vscode.Uri): Promise<ExistingFile> {
	if (!(await pathExists(uri))) {
		return { exists: false };
	}
	try {
		const text = decode(await vscode.workspace.fs.readFile(uri));
		return { exists: true, reference: parseProblemReference(headerText(text)) };
	} catch {
		return { exists: true };
	}
}

async function chooseSolutionFile(
	folder: vscode.Uri,
	baseName: string,
	extension: string,
	site: Site,
	titleSlug: string,
	frontendId: string
): Promise<vscode.Uri> {
	const primary = vscode.Uri.joinPath(folder, `${baseName}${extension}`);
	const primaryState = await existingFile(primary);
	if (
		!primaryState.exists ||
		!primaryState.reference ||
		sameProblem(primaryState.reference, site, titleSlug)
	) {
		return primary;
	}
	const suffix = sanitizeProblemFileName(frontendId || titleSlug, titleSlug);
	for (let attempt = 1; attempt <= 50; attempt += 1) {
		const name =
			attempt === 1
				? `${baseName}-${suffix}${extension}`
				: `${baseName}-${suffix}-${attempt}${extension}`;
		const candidate = vscode.Uri.joinPath(folder, name);
		const state = await existingFile(candidate);
		if (!state.exists || !state.reference || sameProblem(state.reference, site, titleSlug)) {
			return candidate;
		}
	}
	throw new Error('Could not find an available file name in the solution folder.');
}

export async function ensureSolutionFile(
	detail: ProblemDetail,
	site: Site,
	langSlug: string
): Promise<{ uri: vscode.Uri; template: SolutionTemplate; created: boolean }> {
	const template = buildSolutionTemplate(detail, site, langSlug);
	if (!template) {
		throw new Error(`Language "${langSlug}" is not available for this problem.`);
	}
	const folder = await getProblemRoot();
	await vscode.workspace.fs.createDirectory(folder);
	const fallback = detail.titleSlug || detail.questionFrontendId || 'solution';
	const baseName = sanitizeProblemFileName(detail.title, fallback);
	const uri = await chooseSolutionFile(
		folder,
		baseName,
		template.language.extension,
		site,
		detail.titleSlug,
		detail.questionFrontendId
	);
	const created = !(await pathExists(uri));
	if (created) {
		await vscode.workspace.fs.writeFile(uri, encode(template.content));
	}
	return { uri, template, created };
}