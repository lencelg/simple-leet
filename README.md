# Simple Leet

A small LeetCode extension for VS Code:

- sign in to **leetcode.cn** or **leetcode.com**
- search problems
- generate multi-language solution files
- test solutions on LeetCode
- submit with live judge results.

## Features

- **Sign in with your browser session** for LeetCode China and LeetCode Global. Sessions are stored per site in VS Code `SecretStorage`, never in settings, source files or logs.
- **Problem explorer** grouped into **All**, **Easy**, **Medium** and **Hard** categories, with a live-filtering problem picker and Solved markers.
- **Language selection**: opening a problem from the sidebar or search asks which language to use before creating the file.
- **Solutions stored directly in `~/.leetcode`**, named after the problem title; no per-problem folders or metadata files.
- **Problem description** in a side panel, with tags, acceptance rate, hints and a link to the website.
- **Multi-language templates**: C++, C, C#, Go, Java, JavaScript, Kotlin, PHP, Python 3, Ruby, Rust, Scala, Swift, TypeScript and MySQL. The template is generated from the problem's official snippet.
- **Online testing**: runs the marked code against the problem's sample test case on LeetCode for any supported language and shows the judge result, expected/actual output and errors.
- **Submit and judge**: submits the current file, polls the judge and shows Accepted / Wrong Answer / TLE / Runtime Error / Compile Error with failing-case details. Submissions use LeetCode's REST submit endpoint (with a GraphQL fallback on LeetCode Global).
- **CodeLens and editor title buttons** for Run / Submit / Open in Browser.

## Getting started

1. Solutions are stored in `~/.leetcode/<problem title>.<ext>` by default, for example `~/.leetcode/两数之和.cpp`. You can change the folder with `simple-leet.solutionFolder`; no workspace folder is required.
2. Pick a site with **LeetCode: Switch Site** (default is `leetcode.cn`).
3. Optional for browsing, required for submitting: **LeetCode: Sign In**. See below for the cookie values.
4. Run **LeetCode: Search Problems** and type keywords. Pick a problem from the live-filtered list, choose a language, and the solution file is created in your solution folder with the problem description beside the editor. In the language picker, use the back button to return to the search with your query preserved.
5. Edit the generated file.
   - `LeetCode: Run Tests` runs the marked code against the sample test case on LeetCode (sign-in required).
   - `LeetCode: Submit Solution` sends the marked section to the LeetCode judge.
6. Use **LeetCode: Change Language** to generate a solution file in another language. Files for the same problem share the title and differ by extension.

## Signing in

use the session cookies of a browser where you are already signed in:

1. Open <https://leetcode.cn> or <https://leetcode.com> and sign in.
2. Open DevTools -> Network, click any request to the site, and find **Request Headers -> Cookie**.
3. Copy the whole cookie value. It must contain `LEETCODE_SESSION`; include `csrftoken` as well so submissions work.
4. In VS Code run **LeetCode: Sign In** (or click the status bar account item) and paste the value.

## Commands

All commands are in English under the **LeetCode** category:

| Command | Description |
| --- | --- |
| Sign In / Sign Out | Manage the session of the active site |
| Switch Site | Choose LeetCode China or LeetCode Global |
| Search Problems | Find a problem, choose a language and create the solution file |
| Refresh Problems | Reload the current list or search results |
| Show Problem | Open a problem file and description |
| Change Language | Generate or open a solution in another language |
| Run Tests | Run the marked code on LeetCode's sample test case |
| Submit Solution | Submit the active solution file |
| Open Problem in Browser | Open the problem page |
| Account Menu | Quick access to search, site switching and sign-in/out |

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `simple-leet.defaultSite` | `leetcode.cn` | Site used for browsing before a site is selected |
| `simple-leet.defaultLanguage` | `cpp` | Language used when opening a problem |
| `simple-leet.solutionFolder` | `~/.leetcode` | Folder for solution files; `~` expands to your home directory |
| `simple-leet.submissionTimeoutMs` | `60000` | Judge polling timeout |

## Submit markers

Generated solution files wrap the official LeetCode snippet in language-appropriate comments:

```cpp
// @simple-leet:submit-start
class Solution {
public:
    // ...
};
// @simple-leet:submit-end
```

`Run Tests` and `Submit Solution` use only the code between these markers, so debug helpers, notes or extra test code outside the markers are not sent to LeetCode. Keep any imports or helper definitions required by the judge inside the markers. Files created before this feature (without markers) are used as a whole. If only one marker is found, the whole file is used and a warning is shown.

The generated header also contains the problem URL. Keep that line: it identifies the problem for tests, submission and Change Language.

## Project layout

```
src/
├── extension.ts
├── commands/          # sign-in, search, problem, test, submit commands
├── leetcode/          # GraphQL client, sessions, submissions, caching
├── providers/         # tree view, CodeLens, status bar, active-file tracking
├── panels/            # description and result webviews
├── workspace/         # solution storage, file naming, language templates
├── types/             # shared interfaces
└── test/              # unit and integration tests
```

## Development

```bash
npm install
npm run compile
npm run lint
npm run test:unit
```

## License

[MIT](LICENSE)
