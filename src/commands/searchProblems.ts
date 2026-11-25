import * as vscode from 'vscode';
import { createClient } from '../leetcode/auth';
import { ProblemListPage } from '../leetcode/client';
import { Services } from '../services';
import { ProblemSummary, RecentProblem, Site } from '../types/problem';
import { siteLabel } from '../util/site';
import { logInfo } from '../util/log';

type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

interface DifficultyPick extends vscode.QuickPickItem {
	value?: Difficulty;
}

const DIFFICULTIES: DifficultyPick[] = [
	{ label: 'All Difficulties', value: undefined },
	{ label: 'Easy', value: 'EASY' },
	{ label: 'Medium', value: 'MEDIUM' },
	{ label: 'Hard', value: 'HARD' },
];

async function fetchPage(
	services: Services,
	site: Site,
	query: string,
	difficulty: Difficulty | undefined,
	skip: number
): Promise<ProblemListPage> {
	const client = await createClient(services.store, site);
	const limit = vscode.workspace.getConfiguration('simple-leet').get<number>('paginationSize', 50);
	return vscode.window.withProgress(
		{ location: vscode.ProgressLocation.Notification, title: `Searching ${siteLabel(site)}...` },
		() => client.fetchProblemList({ search: query, difficulty, skip, limit })
	);
}

export async function searchProblems(services: Services): Promise<void> {
	const keyword = await vscode.window.showInputBox({
		title: 'Search LeetCode Problems',
		prompt: 'Enter keywords, a problem number, or leave empty to list problems.',
		placeHolder: 'e.g. two sum, graph, 42',
		ignoreFocusOut: true,
	});
	if (keyword === undefined) {
		return;
	}
	const difficulty = await vscode.window.showQuickPick(DIFFICULTIES, {
		title: 'Difficulty',
		placeHolder: 'Filter by difficulty',
	});
	if (!difficulty) {
		return;
	}
	await runSearch(services, services.store.activeSite, keyword.trim(), difficulty.value, false);
}

async function runSearch(
	services: Services,
	site: Site,
	query: string,
	difficulty: Difficulty | undefined,
	append: boolean
): Promise<void> {
	const skip = append ? services.tree.searchState?.items.length ?? 0 : 0;
	const page = await fetchPage(services, site, query, difficulty, skip);
	const items: RecentProblem[] = page.problems.map((problem) => ({ ...problem, site }));
	if (append && services.tree.searchState) {
		services.tree.appendSearch(items, page.total);
		if (items.length === 0) {
			void vscode.window.showInformationMessage('No more problems to load.');
		}
		return;
	}
	services.tree.setSearch({
		query,
		difficulty,
		site,
		total: page.total,
		items,
	});
	await vscode.commands.executeCommand('simple-leet.problems.focus');
	if (items.length === 0) {
		void vscode.window.showInformationMessage('No problems matched the search.');
	} else {
		logInfo(`Search "${query || '*'}" on ${site}: ${items.length}/${page.total} result(s).`);
	}
}

export async function refreshSearch(services: Services): Promise<void> {
	const state = services.tree.searchState;
	if (!state) {
		void vscode.window.showInformationMessage('Search for problems first.');
		return;
	}
	await runSearch(services, state.site, state.query, state.difficulty, false);
}

export async function loadMore(services: Services): Promise<void> {
	const state = services.tree.searchState;
	if (!state) {
		void vscode.window.showInformationMessage('Search for problems first.');
		return;
	}
	if (state.items.length >= state.total) {
		void vscode.window.showInformationMessage('All search results are already loaded.');
		return;
	}
	await runSearch(services, state.site, state.query, state.difficulty, true);
}

export function toSummary(problem: ProblemSummary): ProblemSummary {
	return {
		questionFrontendId: problem.questionFrontendId,
		title: problem.title,
		titleSlug: problem.titleSlug,
		difficulty: problem.difficulty,
		paidOnly: problem.paidOnly,
		acRate: problem.acRate,
		status: problem.status,
		topicTags: problem.topicTags,
	};
}