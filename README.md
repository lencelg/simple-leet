# Simple Leet

A small LeetCode extension for VS Code: sign in to **leetcode.cn** or **leetcode.com**, search problems, generate multi-language solution files, run local C++ tests against the examples, and submit solutions with live judge results.

## Features

- **Sign in with your browser session** for LeetCode China and LeetCode Global. Sessions are stored per site in VS Code `SecretStorage`, never in settings, source files or logs.
- **Problem explorer** with keyword search, difficulty filter, pagination and recent problems.
- **Problem description** in a side panel, with tags, acceptance rate, hints and a link to the website.
- **Multi-language templates**: C++, C, C#, Go, Java, JavaScript, Kotlin, PHP, Python 3, Ruby, Rust, Scala, Swift, TypeScript and MySQL. The template is generated from the problem's official snippet.
- **Local C++ testing**: parses the example cases, builds a temporary test harness for common LeetCode signatures, compiles with `g++`/`clang++` and compares your output with the expected output.
- **Submit and judge**: submits the current file, polls the judge and shows Accepted / Wrong Answer / TLE / Runtime Error / Compile Error with failing-case details. Submissions use LeetCode's REST submit endpoint (with a GraphQL fallback on LeetCode Global).
- **CodeLens and editor title buttons** for Run / Submit / Open in Browser.

## Requirements

- VS Code 1.85 or newer.
- A C++ compiler (`g++` or `clang++`) on `PATH` if you want local tests. You can also set `simple-leet.compilerPath`.
- No extra runtime dependencies: network access is done with the built-in `fetch`.

## Getting started

1. Open a folder in VS Code. Problems are stored in `leetcode/<id>-<slug>/`.
2. Pick a site with **LeetCode: Switch Site** (default is `leetcode.cn`).
3. Optional for browsing, required for submitting: **LeetCode: Sign In**. See below for the cookie values.
4. Run **LeetCode: Search Problems**, enter keywords (or leave empty), choose a difficulty, then select a problem from the sidebar.
5. Edit `solution.cpp` (or the file for your configured language).
   - `LeetCode: Run Tests` compiles and runs the example cases locally (C++ only).
   - `LeetCode: Submit Solution` sends the file to the LeetCode judge.
6. Use **LeetCode: Change Language** in a problem folder to generate a solution file in another language.

## Signing in

LeetCode login forms can require a captcha, so this extension uses the session cookies of a browser where you are already signed in:

1. Open <https://leetcode.cn> or <https://leetcode.com> and sign in.
2. Open DevTools -> Network, click any request to the site, and find **Request Headers -> Cookie**.
3. Copy the whole cookie value. It must contain `LEETCODE_SESSION`; include `csrftoken` as well so submissions work.
4. In VS Code run **LeetCode: Sign In** (or click the status bar account item) and paste the value.

The extension validates the session with a GraphQL `userStatus` query before saving it. Signing out removes the secret for that site. Cookies are never written to settings, source files, output channels or logs.

## Commands

All commands are in English under the **LeetCode** category:

| Command | Description |
| --- | --- |
| Sign In / Sign Out | Manage the session of the active site |
| Switch Site | Choose LeetCode China or LeetCode Global |
| Search Problems | Search by keyword and difficulty |
| Refresh Search Results | Re-run the current search |
| Show Problem | Open a problem file and description |
| Change Language | Generate or open a solution in another language |
| Run Tests | Compile and run the examples locally (C++) |
| Submit Solution | Submit the active solution file |
| Open Problem in Browser | Open the problem page |
| Account Menu | Quick access to search, site switching and sign-in/out |

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `simple-leet.defaultSite` | `leetcode.cn` | Site used for browsing before a site is selected |
| `simple-leet.defaultLanguage` | `cpp` | Language used when opening a problem |
| `simple-leet.workspaceFolder` | `leetcode` | Folder for problem files (relative or absolute) |
| `simple-leet.compilerPath` | empty | C++ compiler; empty auto-detects `g++`, `clang++` |
| `simple-leet.testTimeoutMs` | `10000` | Per-case local test timeout |
| `simple-leet.submissionTimeoutMs` | `60000` | Judge polling timeout |
| `simple-leet.paginationSize` | `50` | Problems fetched per search page |

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

`Submit Solution` and local tests use only the code between these markers, so debug helpers, notes or extra test code outside the markers are not sent to LeetCode. Keep any imports or helper definitions required by the judge inside the markers. Files created before this feature (without markers) are used as a whole. If only one marker is found, the whole file is used and a warning is shown.

## How local testing works

For C++ problems the runner reads the problem metadata (`meta.json`) saved when you opened the problem, generates a temporary `main.cpp` that constructs the parameters from the example inputs, calls `Solution`, and prints the result in LeetCode's output format. It compiles the code inside the submit markers (or the whole file if no markers are present) and runs each example in its own process so a crash or timeout in one case does not hide the others. Results are compared numerically with a small tolerance; when the statement says the answer may be returned **in any order**, element order is ignored.

Supported signature types: integers, longs, doubles, booleans, characters, strings, arrays/matrices of those, `ListNode` and `TreeNode`, plus `void` methods (the runner prints the first argument after the call).

Limitations:

- Local tests are only a quick check of the **example** cases. The LeetCode judge runs hidden tests and may use special judging rules.
- Only C++ is supported locally. Other languages can be submitted online.
- Problems with custom types (`Node`, `NestedInteger`, `MountainArray`, design classes, interactive problems) cannot be tested locally.
- Problems that use LeetCode's special in-place display format (for example `2, nums = [1,2,_]`) are marked **skipped** locally instead of being compared.
- Local results are not authoritative; always submit to confirm.

## Project layout

```
src/
├── extension.ts
├── commands/          # sign-in, search, problem, test, submit commands
├── leetcode/          # GraphQL client, sessions, submissions, caching
├── providers/         # tree view, CodeLens, status bar, active-file tracking
├── panels/            # description and result webviews
├── runner/            # C++ harness, compiler, output parsing/comparison
├── workspace/         # problem folders, meta.json, language templates
├── types/             # shared interfaces
└── test/              # unit and integration tests
```

Each problem folder contains `meta.json` (problem id/slug, example inputs, language-agnostic signature and expected outputs) and the generated `solution.<ext>` file. You can commit these folders to keep your work in version control.

## Development

```bash
npm install
npm run compile
npm run lint
npm run test:unit   # node --test, includes real g++ compile/run tests when available
```

Press `F5` to launch an Extension Development Host.

## Notes

- LeetCode's internal GraphQL API is not officially supported and can change. All network access is isolated in `src/leetcode/`.
- `LEETCODE_SESSION` and `csrftoken` are sensitive credentials. Treat them like passwords.