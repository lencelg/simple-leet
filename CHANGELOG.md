# Change Log

## 0.1.0

- Sign in to LeetCode China and LeetCode Global with browser session cookies stored in `SecretStorage`.
- Problem search by keyword.
- Search opens a live-filtering problem picker, asks for the language and creates the file; the language picker's back button returns to the search with the query preserved.
- Multi-language solution templates and problem description panel.
- Problem explorer groups problems into All, Easy, Medium and Hard categories with Solved markers at the end of each row.
- Solutions stored directly in `~/.leetcode`, named after the problem title, with no per-problem folders or `meta.json`.
- Submit markers in generated files; tests and submissions use only the marked code region.
- Run Tests uses the LeetCode judge with the sample test case for any supported language; no local compiler or harness is used.
- Submit solutions and poll the LeetCode judge with status details.