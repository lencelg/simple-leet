import { Site } from '../types/problem';
import { USER_AGENT } from './constants';

export interface ParsedCookies {
	session?: string;
	csrfToken?: string;
}

const SESSION_PATTERN = /LEETCODE_SESSION\s*["']?\s*[=:]\s*["']?([^;"'\s\\]+)/i;
const CSRF_PATTERN = /csrftoken\s*["']?\s*[=:]\s*["']?([^;"'\s\\]+)/i;

export function parseCookieInput(raw: string): ParsedCookies {
	const sessionMatch = SESSION_PATTERN.exec(raw);
	const csrfMatch = CSRF_PATTERN.exec(raw);
	return {
		session: sessionMatch?.[1]?.trim() || undefined,
		csrfToken: csrfMatch?.[1]?.trim() || undefined,
	};
}

function setCookieHeaders(headers: Headers): string[] {
	const withGetter = headers as Headers & { getSetCookie?: () => string[] };
	if (typeof withGetter.getSetCookie === 'function') {
		return withGetter.getSetCookie();
	}
	const raw = headers.get('set-cookie');
	return raw ? [raw] : [];
}

export async function fetchCsrfToken(site: Site, session: string): Promise<string | undefined> {
	try {
		const response = await fetch(`https://${site}/`, {
			headers: {
				'User-Agent': USER_AGENT,
				Cookie: `LEETCODE_SESSION=${session}`,
			},
			redirect: 'follow',
			signal: AbortSignal.timeout(15000),
		});
		for (const header of setCookieHeaders(response.headers)) {
			const match = /(?:^|[,;]\s*)csrftoken=([^;,\s]+)/i.exec(header);
			if (match?.[1]) {
				return match[1];
			}
		}
	} catch {
		// CSRF retrieval is best effort; the pasted cookie usually contains it already.
	}
	return undefined;
}