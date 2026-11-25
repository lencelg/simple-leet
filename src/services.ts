import * as vscode from 'vscode';
import { SessionStore } from './leetcode/auth';
import { AccountStatusBar } from './providers/accountStatusBar';
import { ProblemTreeProvider } from './providers/problemTreeProvider';
import { DescriptionPanel } from './panels/descriptionPanel';
import { ResultsPanel } from './panels/resultsPanel';

export interface Services {
	context: vscode.ExtensionContext;
	store: SessionStore;
	tree: ProblemTreeProvider;
	statusBar: AccountStatusBar;
	description: DescriptionPanel;
	results: ResultsPanel;
}

export async function refreshAuthUi(services: Services): Promise<void> {
	const site = services.store.activeSite;
	const session = await services.store.get(site);
	await vscode.commands.executeCommand('setContext', 'simple-leet.signedIn', Boolean(session));
	services.tree.refresh();
	services.statusBar.update(site, session);
}