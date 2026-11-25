import * as vscode from 'vscode';
import { createClient } from '../leetcode/auth';
import { LeetCodeClient, ProblemListPage } from '../leetcode/client';
import { Services } from '../services';
import { Difficulty, Site, SiteProblem } from '../types/problem';
import { errorMessage } from '../util/errors';
import { logError, logInfo } from '../util/log';
import { siteLabel } from '../util/site';

interface DifficultyPick extends vscode.QuickPickItem {
	value?: Difficulty;
}

const DIFFICULTIES: DifficultyPick[] = [
	{ label: 'All Difficulties', value: undefined },
	{ label: 'Easy', value: 'EASY' },
	{ label: 'Medium', value: 'MEDIUM' },
	{ label: 'Hard', value: 'HARD' },
];

const PAGE_SIZE = 100;
const PAGE_CONCURRENCY = 4;
const BATCH_DELAY_MS = 80;

let loadGeneration = 0;

interface LoadOptions {
	site: Site;
	query: string;
	difficulty?: Difficulty;
	focus?: boolean;
	silent?: boolean;
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPageWithRetry(
	client: LeetCodeClient,
	options: LoadOptions,
	skip: number,
	limit: number
): Promise<ProblemListPage> {
	try {
		return await client.fetchProblemList({
			search: options.query,
			difficulty: options.difficulty,
			skip,
			limit,
		});
	} catch (error) {
		logInfo(`Retrying problem page at ${skip}: ${errorMessage(error)}`);
		await delay(500);
		return client.fetchProblemList({
			search: options.query,
			difficulty: options.difficulty,
			skip,
			limit,
		});
	}
}

async function loadRemaining(
	client: LeetCodeClient,
	services: Services,
	generation: number,
	options: LoadOptions,
	limit: number,
	total: number
): Promise<void> {
	const pages = Math.ceil(total / limit);
	try {
		for (let pageIndex = 1; pageIndex < pages; pageIndex += PAGE_CONCURRENCY) {
			if (generation !== loadGeneration) {
				return;
			}
			const batch: number[] = [];
			for (let index = pageIndex; index < Math.min(pageIndex + PAGE_CONCURRENCY, pages); index += 1) {
				batch.push(index);
			}
			const results = await Promise.allSettled(
				batch.map((index) => fetchPageWithRetry(client, options, index * limit, limit))
			);
			if (generation !== loadGeneration) {
				return;
			}
			for (const result of results) {
				if (result.status === 'fulfilled') {
					const items: SiteProblem[] = result.value.problems.map((problem) => ({
						...problem,
						site: options.site,
					}));
					services.tree.appendProblems(items, total);
				} else {
					logError('load problems page', result.reason);
				}
			}
			await delay(BATCH_DELAY_MS);
		}
		if (generation === loadGeneration) {
			logInfo(
				`Problem list ready: ${services.tree.listState?.items.length ?? 0}/${total} from ${options.site}.`
			);
		}
	} catch (error) {
		logError('load remaining problems', error);
	}
}

export async function loadProblemList(services: Services, options: LoadOptions): Promise<void> {
	const generation = ++loadGeneration;
	const limit = PAGE_SIZE;
	const client = await createClient(services.store, options.site);
	const fetchFirstPage = () =>
		client.fetchProblemList({
			search: options.query,
			difficulty: options.difficulty,
			skip: 0,
			limit,
		});
	const first = options.silent
		? await fetchFirstPage()
		: await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: `Loading problems from ${siteLabel(options.site)}...`,
				},
				fetchFirstPage
			);
	if (generation !== loadGeneration) {
		return;
	}
	const items: SiteProblem[] = first.problems.map((problem) => ({ ...problem, site: options.site }));
	services.tree.setList({
		query: options.query,
		difficulty: options.difficulty,
		site: options.site,
		total: first.total,
		items,
	});
	if (options.focus) {
		await vscode.commands.executeCommand('simple-leet.problems.focus');
	}
	logInfo(
		`Loaded ${items.length}/${first.total} problems from ${options.site}${options.query ? ` for "${options.query}"` : ''}.`
	);
	if (items.length < first.total) {
		void loadRemaining(client, services, generation, options, limit, first.total);
	}
}

export function reloadProblems(services: Services): void {
	const site = services.store.activeSite;
	const state = services.tree.listState;
	const sameSite = state?.site === site;
	void loadProblemList(services, {
		site,
		query: sameSite ? state?.query ?? '' : '',
		difficulty: sameSite ? state?.difficulty : undefined,
		silent: true,
	}).catch((error) => {
		logError('reload problems', error);
	});
}

export async function searchProblems(services: Services): Promise<void> {
	const keyword = await vscode.window.showInputBox({
		title: 'Search LeetCode Problems',
		prompt: 'Enter keywords, a problem number, or leave empty to list all problems.',
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
	await loadProblemList(services, {
		site: services.store.activeSite,
		query: keyword.trim(),
		difficulty: difficulty.value,
		focus: true,
	});
	const state = services.tree.listState;
	if (state && state.total === 0) {
		void vscode.window.showInformationMessage('No problems matched the search.');
	}
}

export async function refreshProblems(services: Services): Promise<void> {
	const state = services.tree.listState;
	const site = services.store.activeSite;
	if (state && state.site === site) {
		await loadProblemList(services, {
			site,
			query: state.query,
			difficulty: state.difficulty,
		});
	} else {
		await loadProblemList(services, { site, query: '' });
	}
}