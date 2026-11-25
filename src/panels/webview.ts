import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import { escapeHtml } from '../util/html';

export function makeNonce(): string {
	return randomBytes(16).toString('base64');
}

export const BASE_STYLES = `
:root { color-scheme: light dark; }
body {
	margin: 0;
	padding: 20px 28px 48px;
	line-height: 1.6;
	font-family: var(--vscode-font-family);
	font-size: var(--vscode-font-size);
	color: var(--vscode-editor-foreground);
	background: var(--vscode-editor-background);
}
h1 { font-size: 1.4em; margin: 0 0 10px; }
h2 { font-size: 1.12em; margin-top: 26px; }
a { color: var(--vscode-textLink-foreground); text-decoration: none; }
a:hover { text-decoration: underline; }
pre, code { font-family: var(--vscode-editor-font-family, monospace); }
pre {
	background: var(--vscode-textCodeBlock-background, rgba(127, 127, 127, 0.12));
	border-radius: 6px;
	padding: 10px 12px;
	overflow-x: auto;
	white-space: pre-wrap;
	word-break: break-word;
}
img { max-width: 100%; }
table { border-collapse: collapse; }
td, th { border: 1px solid var(--vscode-panel-border, rgba(127, 127, 127, 0.35)); padding: 6px 9px; }
.muted { color: var(--vscode-descriptionForeground); }
.row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 8px 0; }
.tag {
	display: inline-block;
	padding: 1px 8px;
	border-radius: 10px;
	font-size: 0.82em;
	background: var(--vscode-badge-background);
	color: var(--vscode-badge-foreground);
}
.badge {
	display: inline-block;
	padding: 2px 10px;
	border-radius: 10px;
	font-size: 0.84em;
	font-weight: 600;
}
.badge.easy, .badge.pass, .badge.accepted {
	background: rgba(46, 160, 67, 0.2);
	color: #3fb950;
}
.badge.medium {
	background: rgba(219, 171, 47, 0.22);
	color: #d29922;
}
.badge.hard, .badge.fail, .badge.error {
	background: rgba(248, 81, 73, 0.2);
	color: #f85149;
}
.card {
	border: 1px solid var(--vscode-panel-border, rgba(127, 127, 127, 0.35));
	border-radius: 8px;
	padding: 14px 16px;
	margin: 14px 0;
}
.case-head { display: flex; gap: 10px; align-items: baseline; margin-bottom: 6px; }
.label {
	margin-top: 10px;
	font-size: 0.82em;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	color: var(--vscode-descriptionForeground);
}
.summary { font-size: 1.05em; font-weight: 600; margin: 12px 0 4px; }
details { margin-top: 20px; }
`;

export interface PageOptions {
	title: string;
	nonce: string;
	csp: string;
	body: string;
	baseHref?: string;
}

export function pageHtml(options: PageOptions): string {
	const base = options.baseHref ? `<base href="${escapeHtml(options.baseHref)}">` : '';
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${options.csp}">
${base}
<title>${escapeHtml(options.title)}</title>
<style>${BASE_STYLES}</style>
</head>
<body>
${options.body}
<script nonce="${options.nonce}">
const vscode = acquireVsCodeApi();
document.addEventListener('click', (event) => {
	const anchor = event.target && event.target.closest ? event.target.closest('a') : null;
	if (!anchor) { return; }
	event.preventDefault();
	const href = anchor.href || '';
	if (!href.startsWith('https://') && !href.startsWith('http://')) { return; }
	vscode.postMessage({ type: 'openLink', href: href });
});
</script>
</body>
</html>`;
}

export function handlePanelMessage(message: unknown): void {
	if (typeof message !== 'object' || message === null) {
		return;
	}
	const record = message as Record<string, unknown>;
	if (record.type !== 'openLink' || typeof record.href !== 'string') {
		return;
	}
	try {
		const uri = vscode.Uri.parse(record.href);
		if (uri.scheme === 'https' || uri.scheme === 'http') {
			void vscode.env.openExternal(uri);
		}
	} catch {
		// Ignore malformed links.
	}
}