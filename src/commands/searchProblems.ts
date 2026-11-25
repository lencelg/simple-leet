import * as vscode from 'vscode';
import { createClient } from '../leetcode/auth';
import { LeetCodeClient, ProblemListPage } from '../leetcode/client';
import { loadProblem } from '../leetcode/problems';
import { Services } from '../services';
import { Site, SiteProblem } from '../types/problem';
import { errorMessage } from '../util/errors';
import { logError, logInfo } from '../util/log';
import { siteLabel } from '../util/site';
import { ensureSolutionFile } from '../workspace/problemStore';
import { pickLanguage } from './languagePicker';

const PAGE_SIZE = 100;
const PAGE_CONCURRENCY = 4;
const BATCH_DELAY_MS = 80;

let loadGeneration = 0;
let activeLoad: Promise<void> | undefined;

interface LoadOptions {
	site: Site;
	silent?: boolean;
}

interface ProblemPickItem extends vscode.QuickPickItem {
	problem: SiteProblem;
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPageWithRetry(
	client: LeetCodeClient,
	skip: number,
	limit: number
): Promise<ProblemListPage> {
	try {
		return await client.fetchProblemList({ skip, limit });
	} catch (error) {
		logInfo(`Retrying problem page at ${skip}: ${errorMessage(error)}`);
		await delay(500);
		return client.fetchProblemList({ skip, limit });
	}
}

async function loadRemaining(
	client: LeetCodeClient,
	services: Services,
	generation: number,
	site: Site,
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
				batch.map((index) => fetchPageWithRetry(client, index * limit, limit))
			);
			if (generation !== loadGeneration) {
				return;
			}
			const batchItems: SiteProblem[] = [];
			for (const result of results) {
				if (result.status === 'fulfilled') {
					for (const problem of result.value.problems) {
						batchItems.push({ ...problem, site });
					}
				} else {
					logError('load problems page', result.reason);
				}
			}
			if (batchItems.length > 0) {
				services.tree.appendProblems(batchItems, total);
			}
			await delay(BATCH_DELAY_MS);
		}
		if (generation === loadGeneration) {
			logInfo(`Problem list ready: ${services.tree.listState?.items.length ?? 0}/${total} from ${site}.`);
		}
	} catch (error) {
		logError('load remaining problems', error);
	}
}

async function runLoad(services: Services, options: LoadOptions, generation: number): Promise<void> {
	const limit = PAGE_SIZE;
	const client = await createClient(services.store, options.site);
	const fetchFirstPage = () => client.fetchProblemList({ skip: 0, limit });
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
		site: options.site,
		total: first.total,
		items,
	});
	logInfo(`Loaded ${items.length}/${first.total} problems from ${options.site}.`);
	if (items.length < first.total) {
		await loadRemaining(client, services, generation, options.site, limit, first.total);
	}
}

export function loadProblemList(services: Services, options: LoadOptions): Promise<void> {
	const generation = ++loadGeneration;
	const operation = runLoad(services, options, generation);
	activeLoad = operation;
	const clearActive = (): void => {
		if (activeLoad === operation) {
			activeLoad = undefined;
		}
	};
	void operation.then(clearActive, clearActive);
	return operation;
}

export function reloadProblems(services: Services): void {
	void loadProblemList(services, {
		site: services.store.activeSite,
		silent: true,
	}).catch((error) => {
		logError('reload problems', error);
		void vscode.window.showWarningMessage(`Could not load problems: ${errorMessage(error)}`);
	});
}

async function ensureAllProblems(services: Services): Promise<void> {
	const site = services.store.activeSite;
	const state = services.tree.listState;
	if (state && state.site === site && state.items.length >= state.total) {
		return;
	}
	if (activeLoad) {
		await activeLoad;
		const updated = services.tree.listState;
		if (updated && updated.site === site && updated.items.length >= updated.total) {
			return;
		}
	}
	await loadProblemList(services, { site, silent: true });
}

function toProblemItem(problem: SiteProblem): ProblemPickItem {
	const rate =
		typeof problem.acRate === 'number' && Number.isFinite(problem.acRate)
			? `AC: ${Math.round(problem.acRate)}% | `
			: '';
	return {
		label: `${problem.questionFrontendId}. ${problem.title}`,
		description: problem.status === 'ac' ? 'Solved' : '',
		detail: `${rate}${problem.difficulty}`,
		problem,
	};
}

function pickProblem(
	items: SiteProblem[],
	initialQuery: string
): Promise<{ item: ProblemPickItem; query: string } | undefined> {
	const picker = vscode.window.createQuickPick<ProblemPickItem>();
	picker.title = 'Search LeetCode Problems';
	picker.placeholder = 'Type to filter problems';
	picker.items = items.map(toProblemItem);
	picker.matchOnDescription = true;
	picker.matchOnDetail = true;
	picker.value = initialQuery;

	return new Promise((resolve) => {
		let accepted = false;
		picker.onDidAccept(() => {
			const item = picker.selectedItems[0] ?? picker.activeItems[0];
			if (!item) {
				return;
			}
			accepted = true;
			resolve({ item, query: picker.value });
			picker.hide();
		});
		picker.onDidHide(() => {
			if (!accepted) {
				resolve(undefined);
			}
			picker.dispose();
		});
		picker.show();
	});
}

export async function searchProblems(services: Services): Promise<void> {
	const site = services.store.activeSite;
	const state = services.tree.listState;
	if (!state || state.site !== site || state.items.length < state.total) {
		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: `Loading all problems from ${siteLabel(site)}...`,
			},
			() => ensureAllProblems(services)
		);
	}
	const items = services.tree.listState?.items ?? [];
	if (items.length === 0) {
		void vscode.window.showInformationMessage('No problems are available.');
		return;
	}

	let query = '';
	for (;;) {
		const picked = await pickProblem(items, query);
		if (!picked) {
			return;
		}
		query = picked.query;
		const problem = picked.item.problem;
		const client = await createClient(services.store, problem.site);
		const detail = await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: `Loading ${problem.title}...`,
			},
			() => loadProblem(client, problem.titleSlug)
		);

		const language = await pickLanguage(detail, { allowBack: true });
		if (language === undefined) {
			return;
		}
		if (language === 'back') {
			continue;
		}

		const solution = await ensureSolutionFile(detail, problem.site, language.language.slug);
		await vscode.window.showTextDocument(solution.uri, {
			viewColumn: vscode.ViewColumn.One,
			preview: false,
			preserveFocus: false,
		});
		services.description.show(detail, problem.site);
		logInfo(`Opened ${detail.titleSlug} (${language.language.slug}) from search.`);
		return;
	}
}

export async function refreshProblems(services: Services): Promise<void> {
	const site = services.store.activeSite;
	await vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: `Refreshing problems from ${siteLabel(site)}...`,
		},
		() => loadProblemList(services, { site, silent: true })
	);
}