import * as vscode from 'vscode';
import { SubmissionReport } from '../types/submission';
import { TestRunReport } from '../types/test';
import { escapeHtml } from '../util/html';
import { handlePanelMessage, makeNonce, pageHtml } from './webview';

function section(label: string, value: string, kind = ''): string {
	return `<div class="label">${escapeHtml(label)}</div><pre class="${kind}">${escapeHtml(value || '(empty)')}</pre>`;
}

export function renderTestReport(report: TestRunReport): string {
	const judgedTotal = report.total - report.skipped;
	const allPassed = judgedTotal > 0 && report.passed === judgedTotal;
	const summary = report.compileError
		? '<span class="badge fail">Compilation failed</span>'
		: judgedTotal === 0 && report.total > 0
			? `<span class="badge medium">${report.total} case(s) skipped</span>`
			: report.expectedAvailable
				? `<span class="badge ${allPassed ? 'pass' : 'fail'}">${report.passed} / ${judgedTotal} passed${report.skipped > 0 ? ` · ${report.skipped} skipped` : ''}</span>`
				: `<span class="badge medium">${report.total} case(s) executed</span>`;
	const header = `<h1>Local Test Results</h1>
<div class="muted">${escapeHtml(report.problemTitle)}</div>
<div class="summary">${summary}</div>
<div class="muted">Compiler: ${escapeHtml(report.compiler)}</div>`;
	if (report.compileError) {
		return `${header}<h2>Compilation failed</h2><pre class="error">${escapeHtml(report.compileError)}</pre>`;
	}
	const cases = report.cases
		.map((testCase) => {
			const status = testCase.timedOut
				? '<span class="badge fail">TLE</span>'
				: typeof testCase.expected !== 'string'
					? '<span class="badge medium">NO EXPECTED</span>'
					: testCase.passed === undefined
						? '<span class="badge medium">SKIPPED</span>'
						: testCase.passed
							? '<span class="badge pass">PASS</span>'
							: '<span class="badge fail">FAIL</span>';
			const time =
				typeof testCase.durationMs === 'number' ? `<span class="muted">${testCase.durationMs} ms</span>` : '';
			const timeout = testCase.timedOut ? section('Error', 'Time limit exceeded.') : '';
			const expected =
				typeof testCase.expected === 'string' ? section('Expected', testCase.expected) : '';
			return `<div class="card">
<div class="case-head"><strong>Case ${testCase.index + 1}</strong>${status}${time}</div>
${section('Input', testCase.input)}
${expected}
${section('Your output', testCase.actual ?? '')}
${testCase.stderr ? section('stderr', testCase.stderr, 'error') : ''}
${timeout}
${testCase.note ? `<div class="muted">${escapeHtml(testCase.note)}</div>` : ''}
</div>`;
		})
		.join('');
	return `${header}
<p class="muted">Local tests are a quick check against the example cases. The LeetCode judge may run additional or special tests.</p>
${cases}`;
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

	showTestReport(report: TestRunReport): void {
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