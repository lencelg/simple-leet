export type Site = 'leetcode.com' | 'leetcode.cn';

export const SITES: readonly Site[] = ['leetcode.cn', 'leetcode.com'];

export interface TopicTag {
	name: string;
	slug: string;
}

export interface ProblemSummary {
	questionFrontendId: string;
	title: string;
	titleSlug: string;
	difficulty: string;
	paidOnly: boolean;
	acRate?: number | null;
	status?: string | null;
	topicTags?: TopicTag[];
}

export interface CodeSnippet {
	lang: string;
	langSlug: string;
	code: string;
}

export interface ParamMeta {
	name: string;
	type: string;
}

export interface MethodSignature {
	name: string;
	params: ParamMeta[];
	returnType: string;
	manual?: boolean;
}

export interface ProblemDetail extends ProblemSummary {
	questionId: string;
	content: string;
	exampleTestcases: string;
	metaData: unknown;
	codeSnippets: CodeSnippet[];
	hints: string[];
}

export interface ProblemMetaFile {
	titleSlug: string;
	questionId: string;
	frontendId: string;
	title: string;
	difficulty: string;
	site: Site;
	exampleTestcases?: string;
	metaData?: unknown;
	expectedOutputs?: string[];
	anyOrder?: boolean;
}

export interface RecentProblem extends ProblemSummary {
	site: Site;
}