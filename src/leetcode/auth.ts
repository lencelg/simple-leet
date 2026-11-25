import * as vscode from 'vscode';
import { isSite, siteLabel } from '../util/site';
import { Site, SITES } from '../types/problem';
import { LeetCodeClient } from './client';
import { fetchCsrfToken, parseCookieInput } from './cookies';

const SECRET_PREFIX = 'simple-leet.session.';
const ACTIVE_SITE_KEY = 'simple-leet.activeSite';

export interface SessionData {
	site: Site;
	session: string;
	csrfToken?: string;
	username?: string;
	savedAt: string;
}

function secretKey(site: Site): string {
	return `${SECRET_PREFIX}${site}`;
}

export class SessionStore {
	constructor(private readonly secrets: vscode.SecretStorage, private readonly state: vscode.Memento) {}

	get activeSite(): Site {
		const saved = this.state.get<string>(ACTIVE_SITE_KEY);
		if (isSite(saved)) {
			return saved;
		}
		const configured = vscode.workspace.getConfiguration('simple-leet').get<string>('defaultSite');
		return isSite(configured) ? configured : 'leetcode.cn';
	}

	async setActiveSite(site: Site): Promise<void> {
		await this.state.update(ACTIVE_SITE_KEY, site);
	}

	async get(site: Site): Promise<SessionData | undefined> {
		const raw = await this.secrets.get(secretKey(site));
		if (!raw) {
			return undefined;
		}
		try {
			const parsed = JSON.parse(raw) as Partial<SessionData>;
			if (typeof parsed.session !== 'string' || !parsed.session) {
				return undefined;
			}
			return {
				site,
				session: parsed.session,
				csrfToken: typeof parsed.csrfToken === 'string' && parsed.csrfToken ? parsed.csrfToken : undefined,
				username: typeof parsed.username === 'string' && parsed.username ? parsed.username : undefined,
				savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date(0).toISOString(),
			};
		} catch {
			return undefined;
		}
	}

	async getAll(): Promise<SessionData[]> {
		const sessions = await Promise.all(SITES.map((site) => this.get(site)));
		return sessions.filter((session): session is SessionData => session !== undefined);
	}

	async save(data: SessionData): Promise<void> {
		await this.secrets.store(secretKey(data.site), JSON.stringify(data));
		await this.setActiveSite(data.site);
	}

	async remove(site: Site): Promise<void> {
		await this.secrets.delete(secretKey(site));
	}
}

export async function createClient(store: SessionStore, site: Site): Promise<LeetCodeClient> {
	const session = await store.get(site);
	return new LeetCodeClient(site, session ? { session: session.session, csrfToken: session.csrfToken } : undefined);
}

export async function performSignIn(store: SessionStore, site: Site): Promise<SessionData | undefined> {
	const display = siteLabel(site);
	const input = await vscode.window.showInputBox({
		title: `Sign in to ${display}`,
		prompt:
			`Paste the Cookie request header from ${site} (DevTools -> Network -> any request -> Request Headers -> Cookie). ` +
			'It must include LEETCODE_SESSION; include csrftoken as well so submissions work.',
		placeHolder: 'LEETCODE_SESSION=...; csrftoken=...',
		password: true,
		ignoreFocusOut: true,
		validateInput: (value) => {
			if (!value.trim()) {
				return 'Paste your cookies to sign in.';
			}
			return parseCookieInput(value).session ? undefined : 'LEETCODE_SESSION was not found in the pasted text.';
		},
	});
	if (input === undefined) {
		return undefined;
	}

	const cookies = parseCookieInput(input);
	if (!cookies.session) {
		throw new Error('The pasted text does not contain a LEETCODE_SESSION cookie.');
	}
	let csrfToken = cookies.csrfToken;
	if (!csrfToken) {
		csrfToken = await fetchCsrfToken(site, cookies.session);
	}

	const session: SessionData = {
		site,
		session: cookies.session,
		csrfToken,
		savedAt: new Date().toISOString(),
	};
	const client = new LeetCodeClient(site, { session: session.session, csrfToken: session.csrfToken });
	let status;
	try {
		status = await client.getUserStatus();
	} catch (error) {
		throw new Error(`Could not verify the ${display} session: ${error instanceof Error ? error.message : String(error)}`);
	}
	if (!status.isSignedIn) {
		throw new Error(`The ${display} session is invalid or has expired. Copy a fresh cookie header and try again.`);
	}
	session.username = status.username;
	await store.save(session);
	return session;
}

export async function ensureCsrfToken(store: SessionStore, session: SessionData): Promise<SessionData> {
	if (session.csrfToken) {
		return session;
	}
	const token = await fetchCsrfToken(session.site, session.session);
	if (!token) {
		return session;
	}
	const updated: SessionData = { ...session, csrfToken: token };
	await store.save(updated);
	return updated;
}

export async function ensureSignedInClient(
	store: SessionStore,
	site: Site
): Promise<LeetCodeClient | undefined> {
	let session = await store.get(site);
	if (!session) {
		const action = await vscode.window.showWarningMessage(`Sign in to ${siteLabel(site)} to continue.`, 'Sign In');
		if (!action) {
			return undefined;
		}
		await vscode.commands.executeCommand('simple-leet.signIn', site);
		session = await store.get(site);
		if (!session) {
			return undefined;
		}
	}
	session = await ensureCsrfToken(store, session);
	let client = new LeetCodeClient(site, { session: session.session, csrfToken: session.csrfToken });
	let status;
	try {
		status = await client.getUserStatus();
	} catch (error) {
		throw new Error(`Could not verify your ${siteLabel(site)} session: ${error instanceof Error ? error.message : String(error)}`);
	}
	if (!status.isSignedIn) {
		const action = await vscode.window.showWarningMessage(
			`Your ${siteLabel(site)} session has expired. Sign in again to continue.`,
			'Sign In'
		);
		if (!action) {
			return undefined;
		}
		await vscode.commands.executeCommand('simple-leet.signIn', site);
		session = await store.get(site);
		if (!session) {
			return undefined;
		}
		session = await ensureCsrfToken(store, session);
		client = new LeetCodeClient(site, { session: session.session, csrfToken: session.csrfToken });
	}
	return client;
}