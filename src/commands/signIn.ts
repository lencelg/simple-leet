import * as vscode from 'vscode';
import { performSignIn } from '../leetcode/auth';
import { Services, refreshAuthUi } from '../services';
import { Site, SITES } from '../types/problem';
import { isSite, siteLabel } from '../util/site';
import { logInfo } from '../util/log';

export async function signIn(services: Services, siteArg?: unknown): Promise<void> {
	const site = isSite(siteArg) ? siteArg : services.store.activeSite;
	const session = await performSignIn(services.store, site);
	if (!session) {
		return;
	}
	await refreshAuthUi(services);
	const name = session.username ? ` as ${session.username}` : '';
	void vscode.window.showInformationMessage(`Signed in to ${siteLabel(site)}${name}.`);
	if (!session.csrfToken) {
		void vscode.window.showWarningMessage(
			'No csrftoken cookie was found. Submissions may fail; sign in again and include csrftoken in the pasted cookies.'
		);
	}
	logInfo(`Signed in to ${site}${name}.`);
}

export async function signOut(services: Services): Promise<void> {
	const sessions = await services.store.getAll();
	if (sessions.length === 0) {
		void vscode.window.showInformationMessage('You are not signed in to LeetCode.');
		return;
	}
	let target: Site | undefined;
	if (sessions.length === 1) {
		target = sessions[0].site;
	} else {
		const picked = await vscode.window.showQuickPick(
			sessions.map((session) => ({
				label: `Sign out of ${siteLabel(session.site)}`,
				description: session.username ?? '',
				site: session.site,
			})),
			{ title: 'Sign Out', placeHolder: 'Choose the account to sign out of' }
		);
		target = picked?.site;
	}
	if (!target) {
		return;
	}
	await services.store.remove(target);
	if (services.store.activeSite === target) {
		const remaining = (await services.store.getAll())[0];
		if (remaining) {
			await services.store.setActiveSite(remaining.site);
		}
	}
	await refreshAuthUi(services);
	void vscode.window.showInformationMessage(`Signed out of ${siteLabel(target)}.`);
	logInfo(`Signed out of ${target}.`);
}

export async function switchSite(services: Services): Promise<void> {
	const sessions = await services.store.getAll();
	const items = SITES.map((site) => {
		const session = sessions.find((candidate) => candidate.site === site);
		return {
			label: siteLabel(site),
			description: session?.username ? `Signed in as ${session.username}` : 'Not signed in',
			detail: `https://${site}`,
			site,
		};
	});
	const picked = await vscode.window.showQuickPick(items, {
		title: 'LeetCode Site',
		placeHolder: 'Choose the site used for browsing and searching',
	});
	if (!picked) {
		return;
	}
	await services.store.setActiveSite(picked.site);
	services.tree.clearSearch();
	await refreshAuthUi(services);
	void vscode.window.showInformationMessage(`Active site: ${siteLabel(picked.site)}.`);
}

export async function accountMenu(services: Services): Promise<void> {
	const activeSite = services.store.activeSite;
	const session = await services.store.get(activeSite);
	interface MenuItem extends vscode.QuickPickItem {
		command: string;
	}
	const items: MenuItem[] = [
		{ label: '$(search) Search Problems', command: 'simple-leet.searchProblems' },
		{ label: '$(globe) Switch Site', command: 'simple-leet.switchSite' },
		session
			? { label: '$(sign-out) Sign Out', command: 'simple-leet.signOut' }
			: { label: '$(account) Sign In', command: 'simple-leet.signIn' },
	];
	const picked = await vscode.window.showQuickPick(items, {
		title: `${siteLabel(activeSite)}${session?.username ? ` - ${session.username}` : ''}`,
	});
	if (picked) {
		await vscode.commands.executeCommand(picked.command);
	}
}