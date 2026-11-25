import * as path from 'node:path';
import * as vscode from 'vscode';
import { ProblemDetail, ProblemMetaFile, Site } from '../types/problem';
import { allowsAnyOrder, extractExpectedOutputs } from '../runner/testParser';
import { isSite } from '../util/site';
import { buildSolutionTemplate, SolutionTemplate } from './templateGenerator';

const META_FILE = 'meta.json';

export interface ProblemContext {
	folder: vscode.Uri;
	metaUri: vscode.Uri;
	meta: ProblemMetaFile;
}

function encode(text: string): Uint8Array {
	return new TextEncoder().encode(text);
}

function decode(data: Uint8Array): string {
	return new TextDecoder().decode(data);
}

async function pathExists(uri: vscode.Uri): Promise<boolean> {
	try {
		await vscode.workspace.fs.stat(uri);
		return true;
	} catch {
		return false;
	}
}

export async function getProblemRoot(): Promise<vscode.Uri> {
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	if (!workspaceFolder) {
		throw new Error('Open a folder in VS Code before opening a LeetCode problem.');
	}
	const configured = vscode.workspace.getConfiguration('simple-leet').get<string>('workspaceFolder', 'leetcode').trim() || 'leetcode';
	return vscode.Uri.file(
		path.isAbsolute(configured) ? configured : path.join(workspaceFolder.uri.fsPath, configured)
	);
}

function problemFolderName(detail: ProblemDetail): string {
	const slug = /^[a-z0-9-]+$/i.test(detail.titleSlug) ? detail.titleSlug : undefined;
	if (!slug) {
		throw new Error('LeetCode returned an unexpected problem identifier.');
	}
	const frontendId = /^\d+$/.test(detail.questionFrontendId) ? detail.questionFrontendId : '';
	return frontendId ? `${frontendId}-${slug}` : slug;
}

export async function ensureProblemFolder(detail: ProblemDetail, site: Site): Promise<vscode.Uri> {
	const root = await getProblemRoot();
	const folder = vscode.Uri.joinPath(root, problemFolderName(detail));
	await vscode.workspace.fs.createDirectory(folder);
	await writeMetaFile(folder, detail, site);
	return folder;
}

export async function writeMetaFile(folder: vscode.Uri, detail: ProblemDetail, site: Site): Promise<void> {
	const meta: ProblemMetaFile = {
		titleSlug: detail.titleSlug,
		questionId: detail.questionId,
		frontendId: detail.questionFrontendId,
		title: detail.title,
		difficulty: detail.difficulty,
		site,
		exampleTestcases: detail.exampleTestcases,
		metaData: detail.metaData,
		expectedOutputs: extractExpectedOutputs(detail.content),
		anyOrder: allowsAnyOrder(detail.content),
	};
	await vscode.workspace.fs.writeFile(
		vscode.Uri.joinPath(folder, META_FILE),
		encode(JSON.stringify(meta, null, 2))
	);
}

function normalizeMeta(raw: string): ProblemMetaFile | undefined {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return undefined;
	}
	if (typeof parsed !== 'object' || parsed === null) {
		return undefined;
	}
	const record = parsed as Record<string, unknown>;
	if (typeof record.titleSlug !== 'string' || !record.titleSlug || !isSite(record.site)) {
		return undefined;
	}
	const expectedOutputs = Array.isArray(record.expectedOutputs)
		? record.expectedOutputs.filter((item): item is string => typeof item === 'string')
		: undefined;
	return {
		titleSlug: record.titleSlug,
		questionId: typeof record.questionId === 'string' ? record.questionId : String(record.questionId ?? ''),
		frontendId: typeof record.frontendId === 'string' ? record.frontendId : String(record.frontendId ?? ''),
		title: typeof record.title === 'string' ? record.title : record.titleSlug,
		difficulty: typeof record.difficulty === 'string' ? record.difficulty : 'Unknown',
		site: record.site,
		exampleTestcases: typeof record.exampleTestcases === 'string' ? record.exampleTestcases : undefined,
		metaData: record.metaData,
		expectedOutputs,
		anyOrder: record.anyOrder === true,
	};
}

export async function getProblemMetaForFile(fileUri: vscode.Uri): Promise<ProblemContext | undefined> {
	if (fileUri.scheme !== 'file' || path.basename(fileUri.fsPath) === META_FILE) {
		return undefined;
	}
	const folder = vscode.Uri.joinPath(fileUri, '..');
	const metaUri = vscode.Uri.joinPath(folder, META_FILE);
	try {
		const meta = normalizeMeta(decode(await vscode.workspace.fs.readFile(metaUri)));
		if (!meta) {
			return undefined;
		}
		return { folder, metaUri, meta };
	} catch {
		return undefined;
	}
}

export async function readSolutionText(uri: vscode.Uri): Promise<string> {
	const open = vscode.workspace.textDocuments.find((document) => document.uri.toString() === uri.toString());
	if (open) {
		return open.getText();
	}
	return decode(await vscode.workspace.fs.readFile(uri));
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
	const folder = await ensureProblemFolder(detail, site);
	const uri = vscode.Uri.joinPath(folder, template.fileName);
	const created = !(await pathExists(uri));
	if (created) {
		await vscode.workspace.fs.writeFile(uri, encode(template.content));
	}
	return { uri, template, created };
}