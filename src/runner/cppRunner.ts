import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export interface ProcessResult {
	code: number | null;
	stdout: string;
	stderr: string;
	timedOut: boolean;
	durationMs: number;
}

export interface CompileResult {
	ok: boolean;
	binaryPath?: string;
	error?: string;
}

const OUTPUT_LIMIT = 1024 * 1024;

function runProcess(command: string, args: string[], timeoutMs: number, cwd?: string): Promise<ProcessResult> {
	return new Promise((resolve) => {
		const startedAt = Date.now();
		let child;
		try {
			child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
		} catch (error) {
			resolve({
				code: null,
				stdout: '',
				stderr: error instanceof Error ? error.message : String(error),
				timedOut: false,
				durationMs: Date.now() - startedAt,
			});
			return;
		}
		let stdout = '';
		let stderr = '';
		let timedOut = false;
		let settled = false;
		const finish = (result: ProcessResult): void => {
			if (settled) {
				return;
			}
			settled = true;
			clearTimeout(timer);
			resolve(result);
		};
		const timer = setTimeout(() => {
			timedOut = true;
			child.kill('SIGKILL');
		}, timeoutMs);
		child.stdout.on('data', (chunk: Buffer) => {
			if (stdout.length < OUTPUT_LIMIT) {
				stdout += chunk.toString('utf8');
			}
		});
		child.stderr.on('data', (chunk: Buffer) => {
			if (stderr.length < OUTPUT_LIMIT) {
				stderr += chunk.toString('utf8');
			}
		});
		child.on('error', (error) => {
			finish({
				code: null,
				stdout,
				stderr: stderr ? `${stderr}\n${error.message}` : error.message,
				timedOut,
				durationMs: Date.now() - startedAt,
			});
		});
		child.on('close', (code) => {
			finish({ code, stdout, stderr, timedOut, durationMs: Date.now() - startedAt });
		});
	});
}

export async function findCppCompiler(preferred?: string): Promise<string | undefined> {
	const candidates = [preferred?.trim(), 'g++', 'clang++', 'clang', 'c++'].filter(
		(candidate): candidate is string => Boolean(candidate)
	);
	for (const candidate of candidates) {
		const result = await runProcess(candidate, ['--version'], 5000);
		if (!result.timedOut && result.code === 0) {
			return candidate;
		}
	}
	return undefined;
}

export async function createTempWorkDir(): Promise<string> {
	return fs.mkdtemp(path.join(os.tmpdir(), 'simple-leet-'));
}

export async function removeTempWorkDir(workDir: string): Promise<void> {
	try {
		await fs.rm(workDir, { recursive: true, force: true });
	} catch {
		// Temporary files are best-effort cleanup.
	}
}

export async function compileCpp(
	sourcePath: string,
	workDir: string,
	compiler: string
): Promise<CompileResult> {
	const binaryName = process.platform === 'win32' ? 'solution.exe' : 'solution';
	const binaryPath = path.join(workDir, binaryName);
	const result = await runProcess(
		compiler,
		['-std=c++17', '-O2', sourcePath, '-o', binaryPath],
		60000,
		workDir
	);
	if (result.timedOut) {
		return { ok: false, error: 'Compilation timed out after 60 seconds.' };
	}
	if (result.code !== 0) {
		const error = [result.stderr, result.stdout]
			.filter((text) => text.trim().length > 0)
			.join('\n')
			.trim();
		return { ok: false, error: error || `The compiler exited with code ${result.code}.` };
	}
	return { ok: true, binaryPath };
}

export async function runCase(
	binaryPath: string,
	caseIndex: number,
	timeoutMs: number,
	cwd: string
): Promise<ProcessResult> {
	return runProcess(binaryPath, [String(caseIndex)], timeoutMs, cwd);
}