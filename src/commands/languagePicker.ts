import * as vscode from 'vscode';
import { ProblemDetail } from '../types/problem';
import { AvailableLanguage, availableLanguages } from '../workspace/templateGenerator';

interface LanguagePickItem extends vscode.QuickPickItem {
	available: AvailableLanguage;
}

export interface LanguagePickerOptions {
	allowBack?: boolean;
}

export async function pickLanguage(
	detail: ProblemDetail,
	options: { allowBack: true }
): Promise<AvailableLanguage | 'back' | undefined>;
export async function pickLanguage(
	detail: ProblemDetail,
	options?: { allowBack?: false }
): Promise<AvailableLanguage | undefined>;
export async function pickLanguage(
	detail: ProblemDetail,
	options: LanguagePickerOptions = {}
): Promise<AvailableLanguage | 'back' | undefined> {
	const available = availableLanguages(detail);
	if (available.length === 0) {
		throw new Error('This problem does not provide code snippets for a supported language.');
	}
	const picker = vscode.window.createQuickPick<LanguagePickItem>();
	picker.title = `Select Language for ${detail.questionFrontendId}. ${detail.title}`;
	picker.placeholder = 'Choose a language for the solution file';
	picker.items = available.map((entry) => ({
		label: entry.language.slug,
		available: entry,
	}));
	const preferred = vscode.workspace
		.getConfiguration('simple-leet')
		.get<string>('defaultLanguage', 'cpp');
	const preferredItem = picker.items.find((item) => item.available.language.slug === preferred);
	if (preferredItem) {
		picker.activeItems = [preferredItem];
	}
	if (options.allowBack) {
		picker.buttons = [vscode.QuickInputButtons.Back];
	}

	return new Promise((resolve) => {
		let settled = false;
		if (options.allowBack) {
			picker.onDidTriggerButton((button) => {
				if (button === vscode.QuickInputButtons.Back) {
					settled = true;
					resolve('back');
					picker.hide();
				}
			});
		}
		picker.onDidAccept(() => {
			const item = picker.selectedItems[0] ?? picker.activeItems[0];
			if (!item) {
				return;
			}
			settled = true;
			resolve(item.available);
			picker.hide();
		});
		picker.onDidHide(() => {
			if (!settled) {
				resolve(undefined);
			}
			picker.dispose();
		});
		picker.show();
	});
}