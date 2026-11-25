import { Site } from '../types/problem';
import { SubmissionCheckResponse, SubmissionReport, isAccepted, submissionStatusName } from '../types/submission';
import { siteBaseUrl } from '../util/site';
import { LeetCodeClient } from './client';

export interface WaitOptions {
	timeoutMs: number;
	pollIntervalMs?: number;
	shouldCancel?: () => boolean;
	onPoll?: (attempt: number) => void;
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function isFinalResponse(response: SubmissionCheckResponse): boolean {
	const state = (response.state ?? '').toUpperCase();
	if (state === 'SUCCESS' || state === 'FAILURE') {
		return true;
	}
	return (
		typeof response.status_code === 'number' &&
		response.status_code > 0 &&
		state !== 'PENDING' &&
		state !== 'STARTED'
	);
}

export async function waitForSubmission(
	client: LeetCodeClient,
	submissionId: string,
	options: WaitOptions
): Promise<SubmissionCheckResponse> {
	const pollInterval = options.pollIntervalMs ?? 1200;
	const deadline = Date.now() + options.timeoutMs;
	let attempt = 0;
	let consecutiveErrors = 0;
	await delay(700);
	while (Date.now() < deadline) {
		if (options.shouldCancel?.()) {
			throw new Error('Stopped waiting for the judge result. The submission is still running on LeetCode.');
		}
		attempt += 1;
		try {
			const response = await client.checkSubmission(submissionId);
			options.onPoll?.(attempt);
			if (isFinalResponse(response)) {
				return response;
			}
			consecutiveErrors = 0;
		} catch (error) {
			consecutiveErrors += 1;
			if (consecutiveErrors >= 3) {
				throw error;
			}
		}
		await delay(pollInterval);
	}
	throw new Error('Timed out waiting for the judge result. Open the submission on LeetCode to check it.');
}

function joinAnswer(value: string[] | string | undefined): string | undefined {
	if (Array.isArray(value)) {
		return value.filter((item) => item !== '').join('\n') || undefined;
	}
	return value || undefined;
}

export function buildSubmissionReport(
	problemTitle: string,
	site: Site,
	submissionId: string,
	response: SubmissionCheckResponse
): SubmissionReport {
	const statusCode = response.status_code ?? 0;
	return {
		problemTitle,
		site,
		submissionId,
		statusCode,
		statusName: response.status_msg || submissionStatusName(statusCode),
		accepted: isAccepted(statusCode),
		runtime: response.status_runtime || response.display_runtime || undefined,
		memory: response.status_memory || undefined,
		passedTests: response.total_correct,
		totalTests: response.total_testcases,
		compileError: response.full_compile_error || response.compile_error || undefined,
		runtimeError: response.runtime_error || undefined,
		lastTestcase: response.input || response.last_testcase || undefined,
		expectedOutput: joinAnswer(response.expected_output) || joinAnswer(response.expected_code_answer) || undefined,
		actualOutput: joinAnswer(response.code_output) || joinAnswer(response.code_answer),
		stdOutput: response.std_output || joinAnswer(response.std_output_list),
		url: `${siteBaseUrl(site)}/submissions/detail/${encodeURIComponent(submissionId)}/`,
	};
}