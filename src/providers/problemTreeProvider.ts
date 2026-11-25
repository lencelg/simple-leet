import * as vscode from 'vscode';
import { Difficulty, Site, SiteProblem } from '../types/problem';
import { siteLabel } from '../util/site';

const DIFFICULTY_LABELS: Record<string, string> = {
	EASY: 'Easy',
	MEDIUM: 'Medium',
	HARD: 'Hard',
};

type CategoryKey = 'ALL' | Difficulty;

const CATEGORY_KEYS: CategoryKey[] = ['ALL', 'EASY', 'MEDIUM', 'HARD'];
const CATEGORY_LABELS: Record<CategoryKey, string> = {
	ALL: 'All',
	EASY: 'Easy',
	MEDIUM: 'Medium',
	HARD: 'Hard',
};

export interface ProblemListState {
	site: Site;
	total: number;
	items: SiteProblem[];
}

type CategoryNode = { type: 'category'; key: CategoryKey };
type ProblemNode = { type: 'problem'; problem: SiteProblem };

export type ProblemTreeNode = CategoryNode | ProblemNode;

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

	private readonly categories: CategoryNode[] = CATEGORY_KEYS.map((key) => ({
		type: 'category',
		key,
	}));

	private list?: ProblemListState;

	constructor(private readonly context: vscode.ExtensionContext) {}

	get listState(): ProblemListState | undefined {
		return this.list;
	}

	setList(state: ProblemListState): void {
		this.list = state;
		this.refreshCategories();
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
		this.refreshCategories();
	}

	clear(): void {
		this.list = undefined;
		this.refreshCategories();
	}

	refresh(): void {
		this.refreshCategories();
	}

	dispose(): void {
		this.emitter.dispose();
	}

	private refreshCategories(): void {
		// Keep the category node instances stable so expanded groups stay open while pages load.
		for (const category of this.categories) {
			this.emitter.fire(category);
		}
	}

	private problemsFor(key: CategoryKey): SiteProblem[] {
		if (!this.list) {
			return [];
		}
		if (key === 'ALL') {
			return this.list.items;
		}
		return this.list.items.filter((problem) => problem.difficulty.toUpperCase() === key);
	}

	getChildren(element?: ProblemTreeNode): ProblemTreeNode[] {
		if (!element) {
			return this.categories;
		}
		if (element.type === 'category') {
			return this.problemsFor(element.key).map((problem) => ({ type: 'problem', problem }));
		}
		return [];
	}

	getTreeItem(element: ProblemTreeNode): vscode.TreeItem {
		if (element.type === 'category') {
			const label = CATEGORY_LABELS[element.key];
			const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed);
			item.iconPath =
				element.key === 'ALL'
					? new vscode.ThemeIcon('list-unordered')
					: difficultyIcon(this.context.extensionUri, element.key);
			item.contextValue = 'category';
			item.tooltip = `${label} problems`;
			item.accessibilityInformation = {
				label: `${label} problems`,
			};
			return item;
		}

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