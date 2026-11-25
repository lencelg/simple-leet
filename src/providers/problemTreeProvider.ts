import * as vscode from 'vscode';
import { ProblemSummary, RecentProblem, Site } from '../types/problem';
import { isSite, siteLabel } from '../util/site';

const RECENT_KEY = 'simple-leet.recentProblems';
const MAX_RECENT = 15;

const DIFFICULTY_LABELS: Record<string, string> = {
	EASY: 'Easy',
	MEDIUM: 'Medium',
	HARD: 'Hard',
};

export interface SearchState {
	query: string;
	difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
	site: Site;
	total: number;
	items: RecentProblem[];
}

type SearchGroupNode = { type: 'searchGroup' };
type RecentGroupNode = { type: 'recentGroup' };
type ProblemNode = { type: 'problem'; problem: RecentProblem };
type LoadMoreNode = { type: 'loadMore' };

export type ProblemTreeNode = SearchGroupNode | RecentGroupNode | ProblemNode | LoadMoreNode;

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

function normalizeRecent(value: unknown): RecentProblem | undefined {
	if (typeof value !== 'object' || value === null) {
		return undefined;
	}
	const record = value as Record<string, unknown>;
	if (typeof record.titleSlug !== 'string' || !record.titleSlug || !isSite(record.site)) {
		return undefined;
	}
	return {
		questionFrontendId: typeof record.questionFrontendId === 'string' ? record.questionFrontendId : String(record.questionFrontendId ?? ''),
		title: typeof record.title === 'string' ? record.title : record.titleSlug,
		titleSlug: record.titleSlug,
		difficulty: typeof record.difficulty === 'string' ? record.difficulty : 'Unknown',
		paidOnly: Boolean(record.paidOnly),
		acRate: typeof record.acRate === 'number' ? record.acRate : null,
		status: typeof record.status === 'string' ? record.status : null,
		topicTags: Array.isArray(record.topicTags)
			? record.topicTags
					.filter((tag): tag is { name: string; slug: string } => {
						return typeof tag === 'object' && tag !== null && typeof (tag as Record<string, unknown>).name === 'string';
					})
					.map((tag) => ({ name: tag.name, slug: String(tag.slug ?? '') }))
			: [],
		site: record.site,
	};
}

export class ProblemTreeProvider implements vscode.TreeDataProvider<ProblemTreeNode>, vscode.Disposable {
	private readonly emitter = new vscode.EventEmitter<ProblemTreeNode | undefined>();
	readonly onDidChangeTreeData = this.emitter.event;

	private search?: SearchState;
	private recent: RecentProblem[];

	constructor(private readonly context: vscode.ExtensionContext) {
		const stored = context.globalState.get<unknown[]>(RECENT_KEY, []);
		this.recent = stored
			.map(normalizeRecent)
			.filter((problem): problem is RecentProblem => problem !== undefined)
			.slice(0, MAX_RECENT);
	}

	get searchState(): SearchState | undefined {
		return this.search;
	}

	setSearch(state: SearchState): void {
		this.search = state;
		this.refresh();
	}

	appendSearch(items: RecentProblem[], total: number): void {
		if (!this.search) {
			return;
		}
		this.search = {
			...this.search,
			items: [...this.search.items, ...items],
			total,
		};
		this.refresh();
	}

	clearSearch(): void {
		this.search = undefined;
		this.refresh();
	}

	async addRecent(problem: ProblemSummary, site: Site): Promise<void> {
		const entry: RecentProblem = { ...problem, site };
		this.recent = [entry, ...this.recent.filter((item) => !(item.titleSlug === entry.titleSlug && item.site === entry.site))].slice(
			0,
			MAX_RECENT
		);
		await this.context.globalState.update(RECENT_KEY, this.recent);
		this.refresh();
	}

	refresh(): void {
		this.emitter.fire(undefined);
	}

	dispose(): void {
		this.emitter.dispose();
	}

	getChildren(element?: ProblemTreeNode): ProblemTreeNode[] {
		if (!element) {
			const nodes: ProblemTreeNode[] = [];
			if (this.search) {
				nodes.push({ type: 'searchGroup' });
			}
			if (this.recent.length > 0) {
				nodes.push({ type: 'recentGroup' });
			}
			return nodes;
		}
		if (element.type === 'searchGroup' && this.search) {
			const nodes: ProblemTreeNode[] = this.search.items.map((problem) => ({ type: 'problem', problem }));
			if (this.search.items.length < this.search.total) {
				nodes.push({ type: 'loadMore' });
			}
			return nodes;
		}
		if (element.type === 'recentGroup') {
			return this.recent.map((problem) => ({ type: 'problem', problem }));
		}
		return [];
	}

	getTreeItem(element: ProblemTreeNode): vscode.TreeItem {
		switch (element.type) {
			case 'searchGroup': {
				const item = new vscode.TreeItem('Search Results', vscode.TreeItemCollapsibleState.Expanded);
				const search = this.search;
				if (search) {
					const parts: string[] = [];
					if (search.query.trim()) {
						parts.push(`"${search.query.trim()}"`);
					}
					if (search.difficulty) {
						parts.push(difficultyLabel(search.difficulty));
					}
					parts.push(`${search.items.length}/${search.total}`);
					parts.push(siteLabel(search.site));
					item.description = parts.join(' · ');
				}
				item.iconPath = new vscode.ThemeIcon('search');
				item.contextValue = 'searchGroup';
				return item;
			}
			case 'recentGroup': {
				const item = new vscode.TreeItem('Recent', vscode.TreeItemCollapsibleState.Collapsed);
				item.description = String(this.recent.length);
				item.iconPath = new vscode.ThemeIcon('history');
				return item;
			}
			case 'loadMore': {
				const search = this.search;
				const remaining = search ? Math.max(0, search.total - search.items.length) : 0;
				const item = new vscode.TreeItem('Load more...', vscode.TreeItemCollapsibleState.None);
				item.description = `${remaining} remaining`;
				item.iconPath = new vscode.ThemeIcon('chevron-down');
				item.command = { command: 'simple-leet.loadMore', title: 'Load More Problems' };
				return item;
			}
			case 'problem': {
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
	}
}