import * as vscode from 'vscode';
import { languageByFileName } from '../languages';
import { getProblemReferenceForFile } from '../workspace/problemStore';

export class ActiveProblemTracker implements vscode.Disposable {
	private readonly listener: vscode.Disposable;
	private updateId = 0;

	constructor() {
		this.listener = vscode.window.onDidChangeActiveTextEditor(() => {
			void this.update();
		});
		void this.update();
	}

	async update(): Promise<void> {
		const requestId = ++this.updateId;
		const uri = vscode.window.activeTextEditor?.document.uri;
		let isProblemFile = false;
		if (uri && uri.scheme === 'file' && languageByFileName(uri.fsPath)) {
			isProblemFile = Boolean(await getProblemReferenceForFile(uri));
		}
		if (requestId !== this.updateId) {
			return;
		}
		await vscode.commands.executeCommand('setContext', 'simple-leet.isProblemFile', isProblemFile);
	}

	dispose(): void {
		this.listener.dispose();
	}
}