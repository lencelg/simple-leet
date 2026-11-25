import * as vscode from 'vscode';
import { ProblemDetail, Site } from '../types/problem';
import { escapeHtml, sanitizeProblemHtml } from '../util/html';
import { problemUrl } from '../util/site';
import { handlePanelMessage, makeNonce, pageHtml } from './webview';

export function renderDescriptionHtml(detail: ProblemDetail, site: Site, nonce: string): string {
	const tags = (detail.topicTags ?? []).map((tag) => escapeHtml(tag.name)).join(' | ');
	const content = detail.content.trim()
		? sanitizeProblemHtml(detail.content)
		: '<p class="muted">No description is available for this problem. It may be a premium-only problem.</p>';
	const hints =
		detail.hints.length > 0
			? `<details><summary>Hints (${detail.hints.length})</summary><ol>${detail.hints
					.map((hint) => `<li>${sanitizeProblemHtml(hint)}</li>`)
					.join('')}</ol></details>`
			: '';
	const baseUrl = problemUrl(site, detail.titleSlug);
	const footer = `<div class="bottom-links"><a href="${escapeHtml(`${baseUrl}submissions/`)}">submission</a> | <a href="${escapeHtml(`${baseUrl}solutions/`)}">solution</a></div>`;
	const body = `<h1>${escapeHtml(detail.questionFrontendId)}. ${escapeHtml(detail.title)}</h1>
${tags ? `<details class="tags-details"><summary>Tags</summary><div class="tags">${tags}</div></details>` : ''}
<hr>
<main>${content}</main>
${hints}
${footer}`;
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