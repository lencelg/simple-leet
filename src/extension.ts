import * as vscode from 'vscode';
import { registerAllCommands } from './commands';
import { reloadProblems } from './commands/searchProblems';
import { SessionStore } from './leetcode/auth';
import { DescriptionPanel } from './panels/descriptionPanel';
import { ResultsPanel } from './panels/resultsPanel';
import { AccountStatusBar } from './providers/accountStatusBar';
import { ActiveProblemTracker } from './providers/activeProblemTracker';
import { ProblemCodeLensProvider } from './providers/problemCodeLensProvider';
import { ProblemTreeProvider } from './providers/problemTreeProvider';
import { refreshAuthUi, Services } from './services';
import { initLog } from './util/log';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	const output = initLog();
	const store = new SessionStore(context.secrets, context.globalState);
	const tree = new ProblemTreeProvider(context);
	const treeView = vscode.window.createTreeView('simple-leet.problems', {
		treeDataProvider: tree,
	});
	const statusBar = new AccountStatusBar();
	const description = new DescriptionPanel(context.extensionUri);
	const results = new ResultsPanel(context.extensionUri);
	const services: Services = {
		context,
		store,
		tree,
		statusBar,
		description,
		results,
	};
	let initialLoadStarted = false;
	const startInitialLoad = () => {
		if (initialLoadStarted) {
			return;
		}
		initialLoadStarted = true;
		reloadProblems(services);
	};

	context.subscriptions.push(
		output,
		tree,
		treeView,
		statusBar,
		description,
		results,
		new ActiveProblemTracker(),
		treeView.onDidChangeVisibility((event) => {
			if (event.visible && !services.tree.listState) {
				startInitialLoad();
			}
		}),
		vscode.languages.registerCodeLensProvider({ scheme: 'file' }, new ProblemCodeLensProvider()),
		...registerAllCommands(services)
	);

	await refreshAuthUi(services);
	if (treeView.visible) {
		startInitialLoad();
	}
}

export function deactivate(): void {
	// Resources are disposed through the extension context subscriptions.
}