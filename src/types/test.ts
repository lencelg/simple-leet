export interface LocalTestCase {
	index: number;
	input: string;
	expected?: string;
	actual?: string;
	stderr?: string;
	passed?: boolean;
	exact?: boolean;
	note?: string;
	timedOut?: boolean;
	durationMs?: number;
}

export interface TestRunReport {
	problemTitle: string;
	compiler: string;
	compileError?: string;
	cases: LocalTestCase[];
	passed: number;
	total: number;
	skipped: number;
	expectedAvailable: boolean;
}