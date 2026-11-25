import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeHtmlEntities, escapeHtml, sanitizeProblemHtml } from '../../util/html';

test('decodes common HTML entities', () => {
	assert.equal(decodeHtmlEntities('a &lt; b &amp;&amp; c &gt; d &quot;e&quot;'), 'a < b && c > d "e"');
});

test('escapes text for HTML output', () => {
	assert.equal(escapeHtml('<a href="x">\''), '&lt;a href=&quot;x&quot;&gt;&#39;');
});

test('removes scripts, event handlers and javascript URLs', () => {
	const cleaned = sanitizeProblemHtml(
		'<p onclick="evil()">ok</p><script>alert(1)</script><img src="x" onerror="evil()"><a href="javascript:evil()">link</a>'
	);
	assert.doesNotMatch(cleaned, /<script/i);
	assert.doesNotMatch(cleaned, /onclick|onerror/i);
	assert.doesNotMatch(cleaned, /javascript:/i);
	assert.match(cleaned, /ok/);
});