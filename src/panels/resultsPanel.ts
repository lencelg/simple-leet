import * as vscode from 'vscode';
import { SubmissionReport } from '../types/submission';
import { TestReport } from '../types/test';
import { escapeHtml } from '../util/html';
import { handlePanelMessage, makeNonce, pageHtml } from './webview';

function section(label: string, value: string, kind = ''): string {
	return `<div class="label">${escapeHtml(label)}</div><pre class="${kind}">${escapeHtml(value || '(empty)')}</pre>`;
}

export function renderTestReport(report: TestReport): string {
	const chips = [
		report.runtime ? `Runtime: ${escapeHtml(report.runtime)}` : '',
		report.memory ? `Memory: ${escapeHtml(report.memory)}` : '',
		typeof report.passedTests === 'number' && typeof report.totalTests === 'number'
			? `Tests: ${report.passedTests} / ${report.totalTests}`
			: '',
	]
		.filter(Boolean)
		.map((chip) => `<span class="tag">${chip}</span>`)
		.join(' ');
	const parts: string[] = [
		`<h1>Test Results</h1>`,
		`<div class="muted">${escapeHtml(report.problemTitle)}</div>`,
		`<div class="summary"><span class="badge ${report.accepted ? 'accepted' : 'error'}">${escapeHtml(report.statusName)}</span></div>`,
		chips ? `<div class="row">${chips}</div>` : '',
		`<div class="row"><a href="${escapeHtml(report.problemUrl)}">Open problem on LeetCode</a></div>`,
	];
	if (report.compileError) {
		parts.push(`<h2>Compile error</h2><pre class="error">${escapeHtml(report.compileError)}</pre>`);
	}
	if (report.runtimeError) {
		parts.push(`<h2>Runtime error</h2><pre class="error">${escapeHtml(report.runtimeError)}</pre>`);
	}
	if (report.input) {
		parts.push(section('Test input', report.input));
	}
	if (report.expectedOutput) {
		parts.push(section('Expected output', report.expectedOutput));
	}
	if (report.actualOutput) {
		parts.push(section('Your output', report.actualOutput));
	}
	if (report.stdOutput) {
		parts.push(section('Stdout', report.stdOutput));
	}
	parts.push(
		'<p class="muted">This result comes from the LeetCode judge. Test runs use the sample test case; Submit Solution runs the full test set.</p>'
	);
	return parts.join('\n');
}

export function renderSubmissionReport(report: SubmissionReport): string {
	const chips = [
		report.runtime ? `Runtime: ${escapeHtml(report.runtime)}` : '',
		report.memory ? `Memory: ${escapeHtml(report.memory)}` : '',
		typeof report.passedTests === 'number' && typeof report.totalTests === 'number'
			? `Tests: ${report.passedTests} / ${report.totalTests}`
			: '',
	]
		.filter(Boolean)
		.map((chip) => `<span class="tag">${chip}</span>`)
		.join(' ');
	const parts: string[] = [
		`<h1>Submission Result</h1>`,
		`<div class="muted">${escapeHtml(report.problemTitle)}</div>`,
		`<div class="summary"><span class="badge ${report.accepted ? 'accepted' : 'error'}">${escapeHtml(report.statusName)}</span></div>`,
		chips ? `<div class="row">${chips}</div>` : '',
		`<div class="row"><a href="${escapeHtml(report.url)}">Open submission on LeetCode</a><span class="muted">Submission #${escapeHtml(report.submissionId)}</span></div>`,
	];
	if (report.compileError) {
		parts.push(`<h2>Compile error</h2><pre class="error">${escapeHtml(report.compileError)}</pre>`);
	}
	if (report.runtimeError) {
		parts.push(`<h2>Runtime error</h2><pre class="error">${escapeHtml(report.runtimeError)}</pre>`);
	}
	if (report.lastTestcase) {
		parts.push(section('Last test case', report.lastTestcase));
	}
	if (report.expectedOutput) {
		parts.push(section('Expected output', report.expectedOutput));
	}
	if (report.actualOutput) {
		parts.push(section('Your output', report.actualOutput));
	}
	if (report.stdOutput) {
		parts.push(section('Stdout', report.stdOutput));
	}
	parts.push('<p class="muted">This result comes from the LeetCode judge.</p>');
	return parts.join('\n');
}

export class ResultsPanel implements vscode.Disposable {
	private panel?: vscode.WebviewPanel;

	constructor(private readonly extensionUri: vscode.Uri) {}

	showTestReport(report: TestReport): void {
		this.show(`Test Results: ${report.problemTitle}`, renderTestReport(report));
	}

	showSubmissionReport(report: SubmissionReport): void {
		this.show(`Submission: ${report.statusName}`, renderSubmissionReport(report));
	}

	private show(title: string, body: string): void {
		const nonce = makeNonce();
		const html = pageHtml({
			title,
			nonce,
			csp: `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';`,
			body,
		});
		if (this.panel) {
			this.panel.title = title;
			this.panel.webview.html = html;
			this.panel.reveal(undefined, true);
			return;
		}
		const panel = vscode.window.createWebviewPanel(
			'simple-leet.results',
			title,
			{ viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
			{ enableScripts: true, retainContextWhenHidden: true }
		);
		panel.iconPath = vscode.Uri.joinPath(this.extensionUri, 'resources', 'leetcode.svg');
		panel.webview.html = html;
		panel.webview.onDidReceiveMessage(handlePanelMessage);
		panel.onDidDispose(() => {
			this.panel = undefined;
		});
		this.panel = panel;
	}

	dispose(): void {
		this.panel?.dispose();
	}
}