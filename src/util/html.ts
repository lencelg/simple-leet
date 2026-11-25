export function decodeHtmlEntities(text: string): string {
	return text
		.replace(/&nbsp;/gi, ' ')
		.replace(/&quot;/gi, '"')
		.replace(/&#39;|&apos;/gi, "'")
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
		.replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
		.replace(/&amp;/gi, '&');
}

export function htmlToText(html: string): string {
	const withBreaks = html
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/(p|div|pre|li|tr|h[1-6])>/gi, '\n')
		.replace(/<[^>]+>/g, '');
	return decodeHtmlEntities(withBreaks)
		.replace(/\r/g, '')
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

export function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

export function sanitizeProblemHtml(html: string): string {
	return html
		.replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
		.replace(/<style\b[\s\S]*?<\/style\s*>/gi, '')
		.replace(/<(iframe|object|embed|link|meta|base|form|input|button)\b[^>]*>/gi, '')
		.replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
		.replace(/\s(?:href|src)\s*=\s*(["'])\s*javascript:[^"']*\1/gi, '')
		.replace(/\ssrcdoc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
}