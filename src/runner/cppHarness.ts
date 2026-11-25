import { MethodSignature } from '../types/problem';

export class UnsupportedProblemError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'UnsupportedProblemError';
	}
}

type CppKind =
	| { kind: 'int' | 'long' | 'double' | 'bool' | 'string' | 'char' }
	| { kind: 'vector'; element: CppKind }
	| { kind: 'list' }
	| { kind: 'tree' };

export interface HarnessOptions {
	signature: MethodSignature;
	cases: unknown[][];
	solutionCode: string;
}

function parseKind(rawType: string): CppKind | undefined {
	const type = rawType.trim();
	switch (type) {
		case 'int':
		case 'integer':
			return { kind: 'int' };
		case 'long':
			return { kind: 'long' };
		case 'double':
		case 'float':
			return { kind: 'double' };
		case 'bool':
		case 'boolean':
			return { kind: 'bool' };
		case 'string':
		case 'str':
			return { kind: 'string' };
		case 'char':
		case 'character':
			return { kind: 'char' };
		case 'ListNode':
			return { kind: 'list' };
		case 'TreeNode':
			return { kind: 'tree' };
		default:
			break;
	}
	if (type.endsWith('[]')) {
		const element = parseKind(type.slice(0, -2));
		return element ? { kind: 'vector', element } : undefined;
	}
	const generic = /^list\s*<\s*(.+?)\s*>$/i.exec(type);
	if (generic) {
		const element = parseKind(generic[1]);
		return element ? { kind: 'vector', element } : undefined;
	}
	return undefined;
}

function cppType(kind: CppKind): string {
	switch (kind.kind) {
		case 'int':
			return 'int';
		case 'long':
			return 'long long';
		case 'double':
			return 'double';
		case 'bool':
			return 'bool';
		case 'string':
			return 'string';
		case 'char':
			return 'char';
		case 'vector':
			return `vector<${cppType(kind.element)}>`;
		case 'list':
			return 'ListNode*';
		case 'tree':
			return 'TreeNode*';
	}
}

function numericValue(value: unknown, context: string): number {
	const number =
		typeof value === 'number'
			? value
			: typeof value === 'string' && value.trim() !== ''
				? Number(value)
				: Number.NaN;
	if (!Number.isFinite(number)) {
		throw new UnsupportedProblemError(`Could not parse a number for ${context}.`);
	}
	return number;
}

function intLiteral(value: unknown, context: string): string {
	return String(Math.trunc(numericValue(value, context)));
}

function longLiteral(value: unknown, context: string): string {
	return `${String(Math.trunc(numericValue(value, context)))}LL`;
}

function doubleLiteral(value: unknown, context: string): string {
	const number = numericValue(value, context);
	return Number.isInteger(number) ? `${number}.0` : String(number);
}

function cppStringLiteral(value: string): string {
	let result = '';
	for (const char of value) {
		switch (char) {
			case '\\':
				result += '\\\\';
				break;
			case '"':
				result += '\\"';
				break;
			case '\n':
				result += '\\n';
				break;
			case '\r':
				result += '\\r';
				break;
			case '\t':
				result += '\\t';
				break;
			default: {
				const code = char.codePointAt(0) ?? 0;
				if (code < 0x20 || code === 0x7f) {
					result += `\\${code.toString(8).padStart(3, '0')}`;
				} else {
					result += char;
				}
			}
		}
	}
	return `"${result}"`;
}

function charLiteral(value: unknown, context: string): string {
	if (typeof value !== 'string' || [...value].length !== 1) {
		throw new UnsupportedProblemError(`Expected a single character for ${context}.`);
	}
	switch (value) {
		case "'":
			return "'\\''";
		case '\\':
			return "'\\\\'";
		case '\n':
			return "'\\n'";
		case '\r':
			return "'\\r'";
		case '\t':
			return "'\\t'";
		default: {
			const code = value.codePointAt(0) ?? 0;
			if (code < 0x20 || code > 0x7e) {
				throw new UnsupportedProblemError(`Non-ASCII character input is not supported for ${context}.`);
			}
			return `'${value}'`;
		}
	}
}

function literal(kind: CppKind, value: unknown, context: string): string {
	switch (kind.kind) {
		case 'int':
			return intLiteral(value, context);
		case 'long':
			return longLiteral(value, context);
		case 'double':
			return doubleLiteral(value, context);
		case 'bool':
			if (typeof value !== 'boolean') {
				throw new UnsupportedProblemError(`Expected a boolean value for ${context}.`);
			}
			return value ? 'true' : 'false';
		case 'string':
			return `string(${cppStringLiteral(typeof value === 'string' ? value : String(value))})`;
		case 'char':
			return charLiteral(value, context);
		case 'vector': {
			if (!Array.isArray(value)) {
				throw new UnsupportedProblemError(`Expected an array for ${context}.`);
			}
			const entries = value.map((item, index) =>
				literal(kind.element, item, `${context}[${index}]`)
			);
			return `${cppType(kind)}{${entries.join(', ')}}`;
		}
		case 'list': {
			if (value === null || value === undefined) {
				return 'static_cast<ListNode*>(nullptr)';
			}
			if (!Array.isArray(value)) {
				throw new UnsupportedProblemError(`Expected an array for linked list input ${context}.`);
			}
			const entries = value.map((item, index) => intLiteral(item, `${context}[${index}]`));
			return `__slBuildList(vector<int>{${entries.join(', ')}})`;
		}
		case 'tree': {
			if (value === null || value === undefined) {
				return 'static_cast<TreeNode*>(nullptr)';
			}
			if (!Array.isArray(value)) {
				throw new UnsupportedProblemError(`Expected an array for tree input ${context}.`);
			}
			const entries = value.map((item, index) =>
				item === null || item === undefined
					? 'std::nullopt'
					: intLiteral(item, `${context}[${index}]`)
			);
			return `__slBuildTree({${entries.join(', ')}})`;
		}
	}
}

function buildCase(
	index: number,
	args: unknown[],
	signature: MethodSignature,
	kinds: CppKind[]
): string {
	const lines: string[] = [`        case ${index}: {`];
	kinds.forEach((kind, argIndex) => {
		lines.push(
			`            ${cppType(kind)} __slArg${argIndex} = ${literal(kind, args[argIndex], `argument ${argIndex + 1}`)};`
		);
	});
	lines.push('            Solution __slSolution;');
	const argList = args.map((_, argIndex) => `__slArg${argIndex}`).join(', ');
	if (signature.returnType === 'void') {
		lines.push(`            __slSolution.${signature.name}(${argList});`);
		lines.push('            cout << __slJson(__slArg0) << endl;');
	} else {
		lines.push(`            auto __slResult = __slSolution.${signature.name}(${argList});`);
		lines.push('            cout << __slJson(__slResult) << endl;');
	}
	lines.push('            return 0;', '        }');
	return lines.join('\n');
}

const CPP_PRELUDE = String.raw`#include <bits/stdc++.h>
using namespace std;

struct ListNode {
    int val;
    ListNode* next;
    ListNode() : val(0), next(nullptr) {}
    ListNode(int x) : val(x), next(nullptr) {}
    ListNode(int x, ListNode* next) : val(x), next(next) {}
};

struct TreeNode {
    int val;
    TreeNode* left;
    TreeNode* right;
    TreeNode() : val(0), left(nullptr), right(nullptr) {}
    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
    TreeNode(int x, TreeNode* left, TreeNode* right) : val(x), left(left), right(right) {}
};

static string __slEscape(const string& text) {
    string out;
    out.reserve(text.size() + 8);
    for (char ch : text) {
        switch (ch) {
            case '"': out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default: out.push_back(ch); break;
        }
    }
    return out;
}

static string __slJson(int value) { return to_string(value); }
static string __slJson(long value) { return to_string(value); }
static string __slJson(long long value) { return to_string(value); }

static string __slJson(double value) {
    if (std::isnan(value) || std::isinf(value)) { return "null"; }
    ostringstream out;
    out << setprecision(12) << value;
    string text = out.str();
    if (text.find('.') == string::npos && text.find('e') == string::npos && text.find('E') == string::npos) {
        text += ".0";
    }
    return text;
}

static string __slJson(bool value) { return value ? "true" : "false"; }
static string __slJson(char value) { return "\"" + __slEscape(string(1, value)) + "\""; }
static string __slJson(const string& value) { return "\"" + __slEscape(value) + "\""; }

static string __slJson(ListNode* head);
static string __slJson(TreeNode* root);

template <typename T>
static string __slJson(const vector<T>& values) {
    string result = "[";
    for (size_t i = 0; i < values.size(); ++i) {
        if (i > 0) { result += ","; }
        result += __slJson(static_cast<T>(values[i]));
    }
    return result + "]";
}

static string __slJson(ListNode* head) {
    string result = "[";
    bool first = true;
    for (ListNode* node = head; node != nullptr; node = node->next) {
        if (!first) { result += ","; }
        first = false;
        result += __slJson(static_cast<long long>(node->val));
    }
    return result + "]";
}

static string __slJson(TreeNode* root) {
    if (root == nullptr) { return "[]"; }
    vector<string> values;
    deque<TreeNode*> queue;
    queue.push_back(root);
    while (!queue.empty()) {
        TreeNode* node = queue.front();
        queue.pop_front();
        if (node == nullptr) {
            values.push_back("null");
            continue;
        }
        values.push_back(__slJson(static_cast<long long>(node->val)));
        queue.push_back(node->left);
        queue.push_back(node->right);
    }
    while (!values.empty() && values.back() == "null") { values.pop_back(); }
    string result = "[";
    for (size_t i = 0; i < values.size(); ++i) {
        if (i > 0) { result += ","; }
        result += values[i];
    }
    return result + "]";
}

static ListNode* __slBuildList(const vector<int>& values) {
    ListNode* head = nullptr;
    ListNode* tail = nullptr;
    for (int value : values) {
        ListNode* node = new ListNode(value);
        if (head == nullptr) { head = node; } else { tail->next = node; }
        tail = node;
    }
    return head;
}

static TreeNode* __slBuildTree(const vector<optional<int>>& values) {
    if (values.empty() || !values[0].has_value()) { return nullptr; }
    TreeNode* root = new TreeNode(*values[0]);
    deque<TreeNode*> queue;
    queue.push_back(root);
    size_t index = 1;
    while (!queue.empty() && index < values.size()) {
        TreeNode* node = queue.front();
        queue.pop_front();
        if (index < values.size()) {
            if (values[index].has_value()) {
                node->left = new TreeNode(*values[index]);
                queue.push_back(node->left);
            }
            ++index;
        }
        if (index < values.size()) {
            if (values[index].has_value()) {
                node->right = new TreeNode(*values[index]);
                queue.push_back(node->right);
            }
            ++index;
        }
    }
    return root;
}
`;

export function generateCppHarness(options: HarnessOptions): string {
	const { signature, cases, solutionCode } = options;
	if (signature.manual) {
		throw new UnsupportedProblemError(
			'This problem uses a custom judge or special data types, so it cannot be tested locally.'
		);
	}
	if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(signature.name)) {
		throw new UnsupportedProblemError(`Unsupported method name "${signature.name}" for local testing.`);
	}
	if (/\bint\s+main\s*\(/.test(solutionCode)) {
		throw new UnsupportedProblemError(
			'Your solution file must not define main(); the local test runner provides its own entry point.'
		);
	}
	const escapedName = signature.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	if (!new RegExp(`\\b${escapedName}\\s*\\(`).test(solutionCode)) {
		throw new UnsupportedProblemError(
			`The solution file does not define a "${signature.name}" method. Design problems and interactive problems cannot be tested locally; use Submit Solution.`
		);
	}
	if (signature.returnType !== 'void' && !parseKind(signature.returnType)) {
		throw new UnsupportedProblemError(
			`Local testing does not support return type "${signature.returnType}". Use Submit Solution to judge online.`
		);
	}
	const kinds = signature.params.map((param, index) => {
		const kind = parseKind(param.type);
		if (!kind) {
			throw new UnsupportedProblemError(
				`Local testing does not support parameter type "${param.type}" (argument ${index + 1}). Use Submit Solution to judge online.`
			);
		}
		return kind;
	});
	if (signature.returnType === 'void' && kinds.length === 0) {
		throw new UnsupportedProblemError('This method has no parameters to inspect after the void return.');
	}
	if (cases.length === 0) {
		throw new UnsupportedProblemError('No example test cases were found for this problem.');
	}
	for (const args of cases) {
		if (!Array.isArray(args) || args.length !== kinds.length) {
			throw new UnsupportedProblemError('The example test cases do not match the solution signature.');
		}
	}
	const blocks = cases.map((args, index) => buildCase(index, args, signature, kinds)).join('\n');
	return `// Generated by Simple Leet for local testing.
${CPP_PRELUDE}
${solutionCode.trimEnd()}

int main(int argc, char** argv) {
    if (argc < 2) { return 2; }
    int __slCaseIndex = 0;
    try {
        __slCaseIndex = stoi(argv[1]);
    } catch (...) {
        return 2;
    }
    switch (__slCaseIndex) {
${blocks}
        default:
            return 3;
    }
}
`;
}