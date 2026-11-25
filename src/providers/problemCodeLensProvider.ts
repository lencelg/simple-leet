import * as vscode from 'vscode';
import { languageByFileName } from '../languages';
import { getProblemMetaForFile } from '../workspace/problemStore';

export class ProblemCodeLensProvider implements vscode.CodeLensProvider {
	async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
		if (document.uri.scheme !== 'file') {
			return [];
		}
		const language = languageByFileName(document.uri.fsPath);
		if (!language) {
			return [];
		}
		const problem = await getProblemMetaForFile(document.uri);
		if (!problem) {
			return [];
		}
		const range = new vscode.Range(0, 0, 0, 0);
		const lenses: vscode.CodeLens[] = [];
		if (language.slug === 'cpp') {
			lenses.push(
				new vscode.CodeLens(range, {
					title: 'Run Local Tests',
					command: 'simple-leet.runTests',
					arguments: [document.uri],
				})
			);
		}
		lenses.push(
			new vscode.CodeLens(range, {
				title: 'Submit Solution',
				command: 'simple-leet.submitSolution',
				arguments: [document.uri],
			}),
			new vscode.CodeLens(range, {
				title: 'Open in Browser',
				command: 'simple-leet.openInBrowser',
				arguments: [document.uri],
			})
		);
		return lenses;
	}
}