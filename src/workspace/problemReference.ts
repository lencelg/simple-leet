import { Site } from '../types/problem';

export interface ProblemReference {
	site: Site;
	titleSlug: string;
}

export const MISSING_PROBLEM_REFERENCE =
	'Could not find the LeetCode problem URL in this file header. Open the problem from the LeetCode sidebar again or restore the generated header.';

const PROBLEM_URL_PATTERN = /https:\/\/(leetcode\.com|leetcode\.cn)\/problems\/([A-Za-z0-9-]+)/i;
const MAX_FILE_NAME_LENGTH = 120;

export function parseProblemReference(text: string): ProblemReference | undefined {
	const match = PROBLEM_URL_PATTERN.exec(text);
	if (!match) {
		return undefined;
	}
	return {
		site: match[1].toLowerCase() === 'leetcode.cn' ? 'leetcode.cn' : 'leetcode.com',
		titleSlug: match[2],
	};
}

export function sanitizeProblemFileName(title: string, fallback: string): string {
	let name = title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').trim();
	name = name.replace(/[. ]+$/g, '');
	if (!name) {
		name = fallback;
	}
	if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(name)) {
		name = `_${name}`;
	}
	if (name.length > MAX_FILE_NAME_LENGTH) {
		name = [...name].slice(0, MAX_FILE_NAME_LENGTH).join('').replace(/[. ]+$/g, '');
	}
	return name || fallback;
}

export function sameProblem(reference: ProblemReference, site: Site, titleSlug: string): boolean {
	return reference.site === site && reference.titleSlug === titleSlug;
}