import * as vscode from 'vscode';
import { Difficulty, Site, SiteProblem } from '../types/problem';
import { siteLabel } from '../util/site';

const DIFFICULTY_LABELS: Record<string, string> = {
	EASY: 'Easy',
	MEDIUM: 'Medium',
	HARD: 'Hard',
};

export interface ProblemListState {
	query: string;
	difficulty?: Difficulty;
	site: Site;
	total: number;
	items: SiteProblem[];
}

type ProblemNode = { type: 'problem'; problem: SiteProblem };

export type ProblemTreeNode = ProblemNode;

function difficultyLabel(difficulty: string): string {
	return DIFFICULTY_LABELS[difficulty.toUpperCase()] ?? difficulty;
}

function difficultyIcon(extensionUri: vscode.Uri, difficulty: string): vscode.Uri | vscode.ThemeIcon {
	switch (difficulty.toLowerCase()) {
		case 'easy':
			return vscode.Uri.joinPath(extensionUri, 'resources', 'difficulty-easy.svg');
		case 'medium':
			return vscode.Uri.joinPath(extensionUri, 'resources', 'difficulty-medium.svg');
		case 'hard':
			return vscode.Uri.joinPath(extensionUri, 'resources', 'difficulty-hard.svg');
		default:
			return new vscode.ThemeIcon('circle-outline');
	}
}

export class ProblemTreeProvider implements vscode.TreeDataProvider<ProblemTreeNode>, vscode.Disposable {
	private readonly emitter = new vscode.EventEmitter<ProblemTreeNode | undefined>();
	readonly onDidChangeTreeData = this.emitter.event;

	private list?: ProblemListState;

	constructor(private readonly context: vscode.ExtensionContext) {}

	get listState(): ProblemListState | undefined {
		return this.list;
	}

	setList(state: ProblemListState): void {
		this.list = state;
		this.refresh();
	}

	appendProblems(items: SiteProblem[], total: number): void {
		if (!this.list) {
			return;
		}
		this.list = {
			...this.list,
			items: [...this.list.items, ...items],
			total,
		};
		this.refresh();
	}

	clear(): void {
		this.list = undefined;
		this.refresh();
	}

	refresh(): void {
		this.emitter.fire(undefined);
	}

	dispose(): void {
		this.emitter.dispose();
	}

	getChildren(element?: ProblemTreeNode): ProblemTreeNode[] {
		if (element) {
			return [];
		}
		return (this.list?.items ?? []).map((problem) => ({ type: 'problem', problem }));
	}

	getTreeItem(element: ProblemTreeNode): vscode.TreeItem {
		const problem = element.problem;
		const item = new vscode.TreeItem(
			`${problem.questionFrontendId}. ${problem.title}`,
			vscode.TreeItemCollapsibleState.None
		);
		const parts: string[] = [];
		if (problem.paidOnly) {
			parts.push('Premium');
		}
		if (problem.status === 'ac') {
			parts.push('Solved');
		}
		item.description = parts.join(' · ');
		item.iconPath = difficultyIcon(this.context.extensionUri, problem.difficulty);
		item.contextValue = 'problem';
		item.accessibilityInformation = {
			label: `${difficultyLabel(problem.difficulty)} problem ${problem.questionFrontendId}. ${problem.title}`,
		};
		item.command = {
			command: 'simple-leet.showProblem',
			title: 'Show Problem',
			arguments: [problem.titleSlug, problem.site],
		};
		const tooltip = [
			`${problem.questionFrontendId}. ${problem.title}`,
			`${difficultyLabel(problem.difficulty)}${problem.paidOnly ? ' · Premium' : ''}`,
		];
		if (typeof problem.acRate === 'number' && Number.isFinite(problem.acRate)) {
			tooltip.push(`Acceptance: ${problem.acRate.toFixed(1)}%`);
		}
		if (problem.topicTags && problem.topicTags.length > 0) {
			tooltip.push(`Tags: ${problem.topicTags.map((tag) => tag.name).join(', ')}`);
		}
		tooltip.push(`Site: ${siteLabel(problem.site)}`);
		item.tooltip = tooltip.join('\n');
		return item;
	}
}