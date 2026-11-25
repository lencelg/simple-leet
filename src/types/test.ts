import { Site } from './problem';

export interface TestReport {
	problemTitle: string;
	site: Site;
	statusCode: number;
	statusName: string;
	accepted: boolean;
	runtime?: string;
	memory?: string;
	passedTests?: number;
	totalTests?: number;
	input?: string;
	expectedOutput?: string;
	actualOutput?: string;
	stdOutput?: string;
	compileError?: string;
	runtimeError?: string;
	problemUrl: string;
}