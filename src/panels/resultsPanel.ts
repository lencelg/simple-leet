import * as vscode from 'vscode';
import { SubmissionReport } from '../types/submission';
import { TestReport } from '../types/test';
import { escapeHtml } from '../util/html';
import { handlePanelMessage, makeNonce, pageHtml } from './webview';

function section(label: string, value: string, kind = ''): string {
	return `<div class="label">${escapeHtml(label)}</div><pre class="${kind}">${escapeHtml(value || '(empty)')}</pre>`;
}

function statusTone(
	accepted: boolean,
	statusCode: number,
	statusName: string
): 'accepted' | 'warning' | 'error' {
	if (accepted) {
		return 'accepted';
	}
	const name = statusName.toLowerCase();
	if (
		[12, 13, 14, 30].includes(statusCode) ||
		/time limit|timeout|memory limit|output limit/.test(name)
	) {
		return 'warning';
	}
	return 'error';
}

export function renderTestReport(report: TestReport): string {
	const tone = statusTone(report.accepted, report.statusCode, report.statusName);
	const parts: string[] = [
		`<h1 class="result-title">Test Results</h1>`,
		`<div class="summary status-text ${tone}">${escapeHtml(report.statusName)}</div>`,
	];
	if (report.compileError) {
		parts.push(`<h2>Compile error</h2><pre class="error">${escapeHtml(report.compileError)}</pre>`);
	}
	if (report.runtimeError) {
		parts.push(`<h2>Runtime error</h2><pre class="error">${escapeHtml(report.runtimeError)}</pre>`);
	}
	if (report.expectedOutput) {
		parts.push(section('Expected output', report.expectedOutput));
	}
	if (report.actualOutput) {
		parts.push(section('Your output', report.actualOutput));
	}
	return parts.join('\n');
}

export function renderSubmissionReport(report: SubmissionReport): string {
	const tone = statusTone(report.accepted, report.statusCode, report.statusName);
	const stats: string[] = [];
	if (report.runtime) {
		const percentile =
			typeof report.runtimePercentile === 'number' ? ` (${Math.round(report.runtimePercentile)}%)` : '';
		stats.push(`Runtime: ${escapeHtml(report.runtime)}${percentile}`);
	}
	if (report.memory) {
		const percentile =
			typeof report.memoryPercentile === 'number' ? ` (${Math.round(report.memoryPercentile)}%)` : '';
		stats.push(`Memory: ${escapeHtml(report.memory)}${percentile}`);
	}
	if (typeof report.passedTests === 'number' && typeof report.totalTests === 'number') {
		stats.push(`Tests: ${report.passedTests}/${report.totalTests}`);
	}
	const parts: string[] = [
		`<h1 class="result-title">Submission Result</h1>`,
		`<div class="summary status-text ${tone}">${escapeHtml(report.statusName)}</div>`,
		stats.length > 0
			? `<div class="stats-lines">${stats.map((line) => `<div>${line}</div>`).join('')}</div>`
			: '',
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