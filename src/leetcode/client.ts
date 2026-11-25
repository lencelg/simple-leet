import { ProblemDetail, ProblemSummary, Site, TopicTag } from '../types/problem';
import { SubmissionCheckResponse } from '../types/submission';
import { errorMessage } from '../util/errors';
import { problemUrl } from '../util/site';
import { REQUEST_TIMEOUT_MS, USER_AGENT } from './constants';
import { problemListQuery, SUBMIT_MUTATION, USER_STATUS_QUERY, questionQuery } from './graphql';

export interface ClientCredentials {
	session: string;
	csrfToken?: string;
}

export interface ProblemListOptions {
	search?: string;
	difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
	skip?: number;
	limit?: number;
}

export interface ProblemListPage {
	total: number;
	problems: ProblemSummary[];
}

export interface UserStatus {
	isSignedIn: boolean;
	username?: string;
}

export class LeetCodeError extends Error {
	constructor(message: string, readonly status?: number) {
		super(message);
		this.name = 'LeetCodeError';
	}
}

interface GraphQLErrorItem {
	message?: string;
}

interface GraphQLResponse<T> {
	data?: T | null;
	errors?: GraphQLErrorItem[] | null;
}

interface RawQuestionListNode {
	acRate?: number | null;
	difficulty?: string | null;
	frontendQuestionId?: string | number | null;
	paidOnly?: boolean | null;
	status?: string | null;
	title?: string | null;
	titleCn?: string | null;
	titleSlug?: string | null;
	topicTags?: TopicTag[] | null;
}

interface RawQuestion {
	questionId?: string | number | null;
	questionFrontendId?: string | number | null;
	title?: string | null;
	translatedTitle?: string | null;
	difficulty?: string | null;
	content?: string | null;
	translatedContent?: string | null;
	exampleTestcases?: string | null;
	sampleTestCase?: string | null;
	metaData?: string | null;
	isPaidOnly?: boolean | null;
	status?: string | null;
	stats?: string | null;
	hints?: string[] | null;
	topicTags?: TopicTag[] | null;
	codeSnippets?: { lang?: string; langSlug?: string; code?: string }[] | null;
}

function truncate(text: string, max: number): string {
	const collapsed = text.replace(/\s+/g, ' ').trim();
	return collapsed.length > max ? `${collapsed.slice(0, max)}...` : collapsed;
}

function parseJson(text: string | null | undefined): unknown {
	if (!text) {
		return undefined;
	}
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
}

function normalizeAcRate(value: number | null | undefined): number | null {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return null;
	}
	return value >= 0 && value <= 1 ? value * 100 : value;
}

function normalizeStatus(status: string | null | undefined): string | null {
	if (!status) {
		return null;
	}
	const normalized = status.toLowerCase();
	if (normalized === 'ac' || normalized === 'solved' || normalized === 'accepted') {
		return 'ac';
	}
	if (normalized === 'notac' || normalized === 'not_started' || normalized === 'tried' || normalized === 'attempted') {
		return 'notac';
	}
	return normalized;
}

export class LeetCodeClient {
	readonly baseUrl: string;

	constructor(readonly site: Site, private readonly credentials?: ClientCredentials) {
		this.baseUrl = `https://${site}`;
	}

	private headers(referer?: string): Record<string, string> {
		const headers: Record<string, string> = {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			Origin: this.baseUrl,
			Referer: referer ?? `${this.baseUrl}/problemset/`,
			'User-Agent': USER_AGENT,
		};
		if (this.credentials) {
			const cookies = [`LEETCODE_SESSION=${this.credentials.session}`];
			if (this.credentials.csrfToken) {
				cookies.push(`csrftoken=${this.credentials.csrfToken}`);
				headers['X-CSRFToken'] = this.credentials.csrfToken;
			}
			headers.Cookie = cookies.join('; ');
		}
		return headers;
	}

	private async requestJson<T>(url: string, init: RequestInit): Promise<T> {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
		let response: Response;
		let text: string;
		try {
			response = await fetch(url, { ...init, signal: controller.signal });
			text = await response.text();
		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError') {
				throw new LeetCodeError(`Request to ${this.site} timed out.`);
			}
			throw new LeetCodeError(`Network error while contacting ${this.site}: ${error instanceof Error ? error.message : String(error)}`);
		} finally {
			clearTimeout(timer);
		}
		if (!response.ok) {
			let detail = truncate(text, 300);
			if (/<html|<!doctype/i.test(text)) {
				detail = 'HTML error page (the request may have been blocked or the session is invalid)';
			} else {
				try {
					const parsed = JSON.parse(text) as { error?: unknown };
					if (typeof parsed.error === 'string') {
						detail = parsed.error;
					}
				} catch {
					// Keep the plain-text body as the detail.
				}
			}
			throw new LeetCodeError(`HTTP ${response.status} from ${this.site}: ${detail}`, response.status);
		}
		if (!text.trim()) {
			throw new LeetCodeError(`Empty response from ${this.site}.`);
		}
		try {
			return JSON.parse(text) as T;
		} catch {
			throw new LeetCodeError(`Unexpected non-JSON response from ${this.site}.`);
		}
	}

	private async graphql<T>(
		query: string,
		variables: Record<string, unknown>,
		options: { operationName?: string; referer?: string } = {}
	): Promise<T> {
		const payload = await this.requestJson<GraphQLResponse<T>>(`${this.baseUrl}/graphql/`, {
			method: 'POST',
			headers: this.headers(options.referer),
			body: JSON.stringify({ query, variables, operationName: options.operationName }),
		});
		const errors = payload.errors?.map((item) => item.message).filter((message): message is string => Boolean(message));
		if (errors && errors.length > 0) {
			const message = errors.join('; ');
			if (/csrf/i.test(message)) {
				throw new LeetCodeError(`${message} Sign in again and include the csrftoken cookie.`);
			}
			throw new LeetCodeError(message);
		}
		if (!payload.data) {
			throw new LeetCodeError(`Empty GraphQL response from ${this.site}.`);
		}
		return payload.data;
	}

	async getUserStatus(): Promise<UserStatus> {
		const data = await this.graphql<{ userStatus?: { isSignedIn?: boolean; username?: string | null } | null }>(
			USER_STATUS_QUERY,
			{},
			{ operationName: 'userStatus' }
		);
		return {
			isSignedIn: Boolean(data.userStatus?.isSignedIn),
			username: data.userStatus?.username ?? undefined,
		};
	}

	async fetchProblemList(options: ProblemListOptions): Promise<ProblemListPage> {
		const limit = options.limit ?? 50;
		const skip = options.skip ?? 0;
		const filters: Record<string, string> = {};
		if (options.search?.trim()) {
			filters.searchKeywords = options.search.trim();
		}
		if (options.difficulty) {
			filters.difficulty = options.difficulty;
		}
		const data = await this.graphql<{
			problemsetQuestionList?: { total?: number; questions?: RawQuestionListNode[] | null } | null;
		}>(
			problemListQuery(this.site),
			{ categorySlug: '', limit, skip, filters },
			{ operationName: 'problemsetQuestionList' }
		);
		const list = data.problemsetQuestionList;
		const problems = (list?.questions ?? [])
			.filter((question) => Boolean(question.titleSlug))
			.map((question) => ({
				questionFrontendId: String(question.frontendQuestionId ?? ''),
				title:
					(this.site === 'leetcode.cn' ? question.titleCn || question.title : question.title) ?? '',
				titleSlug: question.titleSlug ?? '',
				difficulty: question.difficulty ?? 'Unknown',
				paidOnly: Boolean(question.paidOnly),
				acRate: normalizeAcRate(question.acRate),
				status: normalizeStatus(question.status),
				topicTags: question.topicTags ?? [],
			}));
		return { total: Number(list?.total ?? problems.length), problems };
	}

	async fetchProblemDetail(titleSlug: string): Promise<ProblemDetail> {
		const data = await this.graphql<{ question?: RawQuestion | null }>(
			questionQuery(this.site),
			{ titleSlug },
			{ operationName: 'questionData', referer: problemUrl(this.site, titleSlug) }
		);
		const question = data.question;
		if (!question) {
			throw new LeetCodeError(`Problem "${titleSlug}" was not found on ${this.site}.`);
		}
		const translated = this.site === 'leetcode.cn';
		const stats = parseJson(question.stats) as { acRate?: string } | undefined;
		const rawRate = stats?.acRate ? Number.parseFloat(stats.acRate) : Number.NaN;
		const acRate = normalizeAcRate(Number.isFinite(rawRate) ? rawRate : undefined);
		return {
			questionId: String(question.questionId ?? ''),
			questionFrontendId: String(question.questionFrontendId ?? ''),
			title: (translated ? question.translatedTitle || question.title : question.title) ?? titleSlug,
			titleSlug,
			difficulty: question.difficulty ?? 'Unknown',
			paidOnly: Boolean(question.isPaidOnly),
			acRate,
			status: normalizeStatus(question.status),
			topicTags: question.topicTags ?? [],
			content: (translated ? question.translatedContent || question.content : question.content) ?? '',
			exampleTestcases: question.exampleTestcases ?? question.sampleTestCase ?? '',
			metaData: parseJson(question.metaData),
			codeSnippets: (question.codeSnippets ?? [])
				.filter((snippet) => Boolean(snippet.langSlug && snippet.code))
				.map((snippet) => ({ lang: snippet.lang ?? snippet.langSlug ?? '', langSlug: snippet.langSlug ?? '', code: snippet.code ?? '' })),
			hints: question.hints ?? [],
		};
	}

	async submitSolution(questionId: number, lang: string, code: string, titleSlug: string): Promise<string> {
		if (!this.credentials) {
			throw new LeetCodeError(`Sign in to ${this.site} before submitting.`);
		}
		if (this.site === 'leetcode.cn') {
			return this.submitViaRest(questionId, lang, code, titleSlug);
		}
		try {
			return await this.submitViaRest(questionId, lang, code, titleSlug);
		} catch (restError) {
			const restMessage = errorMessage(restError);
			const meaningfulError =
				!/<html/i.test(restMessage) &&
				/too soon|not authenticated|sign in|csrf/i.test(restMessage);
			if (meaningfulError) {
				throw restError;
			}
			try {
				return await this.submitViaGraphql(questionId, lang, code, titleSlug);
			} catch (graphError) {
				throw new LeetCodeError(
					`${restMessage} GraphQL fallback also failed: ${errorMessage(graphError)}`
				);
			}
		}
	}

	private async submitViaGraphql(
		questionId: number,
		lang: string,
		code: string,
		titleSlug: string
	): Promise<string> {
		const data = await this.graphql<{ submit?: { submissionId?: string | number | null } | null }>(
			SUBMIT_MUTATION,
			{ questionId, lang, code },
			{ operationName: 'submit', referer: problemUrl(this.site, titleSlug) }
		);
		const submissionId = data.submit?.submissionId;
		if (submissionId === undefined || submissionId === null || submissionId === '') {
			throw new LeetCodeError('LeetCode did not return a submission id.');
		}
		return String(submissionId);
	}

	private async submitViaRest(
		questionId: number,
		lang: string,
		code: string,
		titleSlug: string
	): Promise<string> {
		const response = await this.requestJson<{ submission_id?: string | number; error?: string }>(
			`${this.baseUrl}/problems/${encodeURIComponent(titleSlug)}/submit/`,
			{
				method: 'POST',
				headers: { ...this.headers(problemUrl(this.site, titleSlug)), 'X-Requested-With': 'XMLHttpRequest' },
				body: JSON.stringify({
					judge_type: 'large',
					lang,
					question_id: questionId,
					test_mode: false,
					typed_code: code,
				}),
			}
		);
		if (response.error) {
			throw new LeetCodeError(response.error);
		}
		const submissionId = response.submission_id;
		if (submissionId === undefined || submissionId === null || submissionId === '') {
			throw new LeetCodeError('LeetCode did not return a submission id.');
		}
		return String(submissionId);
	}

	async checkSubmission(submissionId: string): Promise<SubmissionCheckResponse> {
		return this.requestJson<SubmissionCheckResponse>(
			`${this.baseUrl}/submissions/detail/${encodeURIComponent(submissionId)}/check/`,
			{ method: 'GET', headers: this.headers() }
		);
	}
}