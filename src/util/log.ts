import * as vscode from 'vscode';
import { errorMessage } from './errors';

let channel: vscode.OutputChannel | undefined;

export function initLog(): vscode.OutputChannel {
	if (!channel) {
		channel = vscode.window.createOutputChannel('LeetCode');
	}
	return channel;
}

function stamp(): string {
	return new Date().toISOString();
}

export function logInfo(message: string): void {
	channel?.appendLine(`[${stamp()}] ${message}`);
}

export function logError(scope: string, error: unknown): void {
	channel?.appendLine(`[${stamp()}] ERROR ${scope}: ${errorMessage(error)}`);
	if (error instanceof Error && error.stack) {
		channel?.appendLine(error.stack);
	}
}