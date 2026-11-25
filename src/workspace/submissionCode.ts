import { LanguageInfo } from '../languages';

export const SUBMIT_START_MARKER = '@simple-leet:submit-start';
export const SUBMIT_END_MARKER = '@simple-leet:submit-end';

export interface SubmissionSource {
	code: string;
	marked: boolean;
	warning?: string;
}

export function submissionMarkers(language: LanguageInfo): { start: string; end: string } {
	return {
		start: `${language.commentPrefix} ${SUBMIT_START_MARKER}`,
		end: `${language.commentPrefix} ${SUBMIT_END_MARKER}`,
	};
}

function lineStart(text: string, index: number): number {
	const newline = text.lastIndexOf('\n', index - 1);
	return newline === -1 ? 0 : newline + 1;
}

function nextLineStart(text: string, index: number): number {
	const newline = text.indexOf('\n', index);
	return newline === -1 ? text.length : newline + 1;
}

const INCOMPLETE_WARNING =
	'The submit markers are incomplete; the whole file will be used. Add both submit-start and submit-end markers.';

export function extractSubmissionCode(text: string): SubmissionSource {
	const startIndex = text.indexOf(SUBMIT_START_MARKER);
	const endIndex = startIndex >= 0 ? text.indexOf(SUBMIT_END_MARKER, startIndex) : text.indexOf(SUBMIT_END_MARKER);
	if (startIndex < 0 && endIndex < 0) {
		return { code: text, marked: false };
	}
	if (startIndex < 0 || endIndex < 0) {
		return { code: text, marked: false, warning: INCOMPLETE_WARNING };
	}
	const code = text
		.slice(nextLineStart(text, startIndex), lineStart(text, endIndex))
		.trim();
	if (!code) {
		return { code: '', marked: true, warning: 'The marked submission section is empty.' };
	}
	return { code, marked: true };
}