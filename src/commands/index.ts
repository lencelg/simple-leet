import * as vscode from 'vscode';
import { Services } from '../services';
import { errorMessage } from '../util/errors';
import { logError } from '../util/log';
import { runTests } from './runTests';
import { changeLanguage, openInBrowser, showProblem } from './showProblem';
import { loadMore, refreshSearch, searchProblems } from './searchProblems';
import { accountMenu, signIn, signOut, switchSite } from './signIn';
import { submitSolution } from './submit';

function register(
	services: Services,
	id: string,
	handler: (...args: unknown[]) => unknown
): vscode.Disposable {
	return vscode.commands.registerCommand(id, async (...args: unknown[]) => {
		try {
			await handler(...args);
		} catch (error) {
			logError(id, error);
			void vscode.window.showErrorMessage(`LeetCode: ${errorMessage(error)}`);
		}
	});
}

export function registerAllCommands(services: Services): vscode.Disposable[] {
	return [
		register(services, 'simple-leet.signIn', (site?: unknown) => signIn(services, site)),
		register(services, 'simple-leet.signOut', () => signOut(services)),
		register(services, 'simple-leet.accountMenu', () => accountMenu(services)),
		register(services, 'simple-leet.switchSite', () => switchSite(services)),
		register(services, 'simple-leet.searchProblems', () => searchProblems(services)),
		register(services, 'simple-leet.refreshSearch', () => refreshSearch(services)),
		register(services, 'simple-leet.loadMore', () => loadMore(services)),
		register(services, 'simple-leet.showProblem', (slug?: unknown, site?: unknown) =>
			showProblem(services, slug, site)
		),
		register(services, 'simple-leet.changeLanguage', (uri?: unknown) => changeLanguage(services, uri)),
		register(services, 'simple-leet.runTests', (uri?: unknown) => runTests(services, uri)),
		register(services, 'simple-leet.submitSolution', (uri?: unknown) => submitSolution(services, uri)),
		register(services, 'simple-leet.openInBrowser', (uri?: unknown) => openInBrowser(services, uri)),
	];
}