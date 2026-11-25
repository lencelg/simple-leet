import * as vscode from 'vscode';
import { SessionData } from '../leetcode/auth';
import { Site } from '../types/problem';
import { siteLabel } from '../util/site';

export class AccountStatusBar implements vscode.Disposable {
	private readonly item: vscode.StatusBarItem;

	constructor() {
		this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	}

	update(site: Site, session?: SessionData): void {
		if (session) {
			const siteShort = site === 'leetcode.cn' ? 'CN' : 'Global';
			this.item.text = `$(account) ${session.username ?? 'LeetCode'} · ${siteShort}`;
			this.item.tooltip = `Signed in to ${siteLabel(site)}${session.username ? ` as ${session.username}` : ''}. Click for account options.`;
			this.item.command = 'simple-leet.accountMenu';
		} else {
			this.item.text = '$(account) LeetCode: Sign In';
			this.item.tooltip = `Sign in to ${siteLabel(site)}`;
			this.item.command = 'simple-leet.signIn';
		}
		this.item.show();
	}

	dispose(): void {
		this.item.dispose();
	}
}