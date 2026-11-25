import { MethodSignature, ParamMeta, ProblemDetail } from '../types/problem';
import { LeetCodeClient } from './client';

const CACHE_TTL_MS = 5 * 60 * 1000;

const detailCache = new Map<string, { detail: ProblemDetail; fetchedAt: number }>();

export async function loadProblem(
	client: LeetCodeClient,
	titleSlug: string,
	force = false
): Promise<ProblemDetail> {
	const key = `${client.site}:${titleSlug}`;
	const cached = detailCache.get(key);
	if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
		return cached.detail;
	}
	const detail = await client.fetchProblemDetail(titleSlug);
	detailCache.set(key, { detail, fetchedAt: Date.now() });
	return detail;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return undefined;
	}
	return value as Record<string, unknown>;
}

function parseParam(value: unknown): ParamMeta | undefined {
	const record = asRecord(value);
	if (!record || typeof record.name !== 'string' || typeof record.type !== 'string') {
		return undefined;
	}
	return { name: record.name, type: record.type };
}

export function parseMethodSignature(metaData: unknown): MethodSignature | undefined {
	let raw = metaData;
	if (typeof raw === 'string') {
		try {
			raw = JSON.parse(raw);
		} catch {
			return undefined;
		}
	}
	const record = asRecord(raw);
	if (!record) {
		return undefined;
	}
	if (typeof record.name !== 'string' || !record.name || !Array.isArray(record.params)) {
		return undefined;
	}
	const returnRecord = asRecord(record.return);
	if (!returnRecord || typeof returnRecord.type !== 'string') {
		return undefined;
	}
	const params: ParamMeta[] = [];
	for (const item of record.params) {
		const param = parseParam(item);
		if (!param) {
			return undefined;
		}
		params.push(param);
	}
	return {
		name: record.name,
		params,
		returnType: returnRecord.type,
		manual: record.manual === true || record.systemdesign === true,
	};
}