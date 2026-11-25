import { Site } from './problem';

export interface SubmissionCheckResponse {
	state?: string;
	status_code?: number;
	status_msg?: string;
	compile_error?: string;
	full_compile_error?: string;
	runtime_error?: string;
	status_runtime?: string;
	status_memory?: string;
	display_runtime?: string;
	total_correct?: number;
	total_testcases?: number;
	last_testcase?: string;
	input?: string;
	expected_output?: string[] | string;
	code_answer?: string[] | string;
	code_output?: string[] | string;
	expected_code_answer?: string[] | string;
	std_output?: string;
	std_output_list?: string[];
	elapsed_time?: number;
}

export interface SubmissionReport {
	problemTitle: string;
	site: Site;
	submissionId: string;
	statusCode: number;
	statusName: string;
	accepted: boolean;
	runtime?: string;
	memory?: string;
	passedTests?: number;
	totalTests?: number;
	compileError?: string;
	runtimeError?: string;
	lastTestcase?: string;
	expectedOutput?: string;
	actualOutput?: string;
	stdOutput?: string;
	url: string;
}

const STATUS_NAMES: Record<number, string> = {
	10: 'Accepted',
	11: 'Wrong Answer',
	12: 'Memory Limit Exceeded',
	13: 'Output Limit Exceeded',
	14: 'Time Limit Exceeded',
	15: 'Runtime Error',
	16: 'Internal Error',
	20: 'Compile Error',
	21: 'Unknown Error',
	30: 'Timeout',
};

export function submissionStatusName(code: number | undefined): string {
	if (code === undefined) {
		return 'Unknown';
	}
	return STATUS_NAMES[code] ?? `Unknown (code ${code})`;
}

export function isAccepted(code: number | undefined): boolean {
	return code === 10;
}