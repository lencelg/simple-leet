import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCookieInput } from '../../leetcode/cookies';

test('parses a raw cookie header', () => {
	const parsed = parseCookieInput('LEETCODE_SESSION=abc123; csrftoken=token456; other=value');
	assert.equal(parsed.session, 'abc123');
	assert.equal(parsed.csrfToken, 'token456');
});

test('parses cookies from JSON', () => {
	const parsed = parseCookieInput('{"LEETCODE_SESSION":"abc123","csrftoken":"token456"}');
	assert.equal(parsed.session, 'abc123');
	assert.equal(parsed.csrfToken, 'token456');
});

test('parses cookies from a copied curl command', () => {
	const parsed = parseCookieInput(
		"curl 'https://leetcode.cn/graphql/' -H 'cookie: LEETCODE_SESSION=abc123; csrftoken=token456'"
	);
	assert.equal(parsed.session, 'abc123');
	assert.equal(parsed.csrfToken, 'token456');
});

test('reports a missing session', () => {
	const parsed = parseCookieInput('csrftoken=token456');
	assert.equal(parsed.session, undefined);
	assert.equal(parsed.csrfToken, 'token456');
});