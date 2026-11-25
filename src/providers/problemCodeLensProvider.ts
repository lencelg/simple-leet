import * as vscode from 'vscode';
import { languageByFileName } from '../languages';
import { getProblemReferenceForFile } from '../workspace/problemStore';

export class ProblemCodeLensProvider implements vscode.CodeLensProvider {
	async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
		if (document.uri.scheme !== 'file') {
			return [];
		}
		const language = languageByFileName(document.uri.fsPath);
		if (!language) {
			return [];
		}
		const reference = await getProblemReferenceForFile(document.uri);
		if (!reference) {
			return [];
		}
		const range = new vscode.Range(0, 0, 0, 0);
		const lenses: vscode.CodeLens[] = [
			new vscode.CodeLens(range, {
				title: 'Run Tests',
				command: 'simple-leet.runTests',
				arguments: [document.uri],
			}),
			new vscode.CodeLens(range, {
				title: 'Submit Solution',
				command: 'simple-leet.submitSolution',
				arguments: [document.uri],
			}),
			new vscode.CodeLens(range, {
				title: 'Open in Browser',
				command: 'simple-leet.openInBrowser',
				arguments: [document.uri],
			}),
		];
		return lenses;
	}
}