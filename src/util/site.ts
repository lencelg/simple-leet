import { CodeSnippet, Site } from '../types/problem';

export function siteLabel(site: Site): string {
	return site === 'leetcode.cn' ? 'LeetCode China' : 'LeetCode Global';
}

export function siteBaseUrl(site: Site): string {
	return `https://${site}`;
}

export function problemUrl(site: Site, slug: string): string {
	return `${siteBaseUrl(site)}/problems/${slug}/`;
}

export function isSite(value: unknown): value is Site {
	return value === 'leetcode.cn' || value === 'leetcode.com';
}

export function findCodeSnippet(snippets: CodeSnippet[], langSlug: string): CodeSnippet | undefined {
	return snippets.find((snippet) => snippet.langSlug === langSlug);
}