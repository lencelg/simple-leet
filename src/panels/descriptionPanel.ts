import * as vscode from 'vscode';
import { ProblemDetail, Site } from '../types/problem';
import { escapeHtml, sanitizeProblemHtml } from '../util/html';
import { problemUrl, siteLabel } from '../util/site';
import { handlePanelMessage, makeNonce, pageHtml } from './webview';

function difficultyClass(difficulty: string): string {
	const normalized = difficulty.toLowerCase();
	return normalized === 'easy' || normalized === 'medium' || normalized === 'hard' ? normalized : '';
}

export function renderDescriptionHtml(detail: ProblemDetail, site: Site, nonce: string): string {
	const url = problemUrl(site, detail.titleSlug);
	const rate =
		typeof detail.acRate === 'number' && Number.isFinite(detail.acRate)
			? `<span class="muted">AC ${detail.acRate.toFixed(1)}%</span>`
			: '';
	const premium = detail.paidOnly ? '<span class="badge medium">Premium</span>' : '';
	const tags = (detail.topicTags ?? [])
		.map((tag) => `<span class="tag">${escapeHtml(tag.name)}</span>`)
		.join(' ');
	const content = detail.content.trim()
		? sanitizeProblemHtml(detail.content)
		: '<p class="muted">No description is available for this problem. It may be a premium-only problem.</p>';
	const hints =
		detail.hints.length > 0
			? `<details><summary>Hints (${detail.hints.length})</summary><ol>${detail.hints
					.map((hint) => `<li>${sanitizeProblemHtml(hint)}</li>`)
					.join('')}</ol></details>`
			: '';
	const body = `<h1>${escapeHtml(detail.questionFrontendId)}. ${escapeHtml(detail.title)}</h1>
<div class="row">
	<span class="badge ${difficultyClass(detail.difficulty)}">${escapeHtml(detail.difficulty)}</span>
	${premium}
	${rate}
	<span class="muted">${siteLabel(site)}</span>
	<a href="${escapeHtml(url)}">Open on LeetCode</a>
</div>
${tags ? `<div class="row">${tags}</div>` : ''}
<hr>
<main>${content}</main>
${hints}`;
	return pageHtml({
		title: `${detail.questionFrontendId}. ${detail.title}`,
		nonce,
		csp: `default-src 'none'; img-src https: http: data:; style-src 'unsafe-inline'; font-src https: data:; script-src 'nonce-${nonce}';`,
		body,
		baseHref: `https://${site}/`,
	});
}

export class DescriptionPanel implements vscode.Disposable {
	private panel?: vscode.WebviewPanel;

	constructor(private readonly extensionUri: vscode.Uri) {}

	show(detail: ProblemDetail, site: Site): void {
		const html = renderDescriptionHtml(detail, site, makeNonce());
		if (this.panel) {
			this.panel.title = `${detail.questionFrontendId}. ${detail.title}`;
			this.panel.webview.html = html;
			this.panel.reveal(undefined, true);
			return;
		}
		const panel = vscode.window.createWebviewPanel(
			'simple-leet.problem',
			`${detail.questionFrontendId}. ${detail.title}`,
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