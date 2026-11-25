export interface LanguageInfo {
	slug: string;
	name: string;
	extension: string;
	commentPrefix: string;
}

export const LANGUAGES: readonly LanguageInfo[] = [
	{ slug: 'cpp', name: 'C++', extension: '.cpp', commentPrefix: '//' },
	{ slug: 'c', name: 'C', extension: '.c', commentPrefix: '//' },
	{ slug: 'csharp', name: 'C#', extension: '.cs', commentPrefix: '//' },
	{ slug: 'golang', name: 'Go', extension: '.go', commentPrefix: '//' },
	{ slug: 'java', name: 'Java', extension: '.java', commentPrefix: '//' },
	{ slug: 'javascript', name: 'JavaScript', extension: '.js', commentPrefix: '//' },
	{ slug: 'kotlin', name: 'Kotlin', extension: '.kt', commentPrefix: '//' },
	{ slug: 'php', name: 'PHP', extension: '.php', commentPrefix: '//' },
	{ slug: 'python3', name: 'Python 3', extension: '.py', commentPrefix: '#' },
	{ slug: 'ruby', name: 'Ruby', extension: '.rb', commentPrefix: '#' },
	{ slug: 'rust', name: 'Rust', extension: '.rs', commentPrefix: '//' },
	{ slug: 'scala', name: 'Scala', extension: '.scala', commentPrefix: '//' },
	{ slug: 'swift', name: 'Swift', extension: '.swift', commentPrefix: '//' },
	{ slug: 'typescript', name: 'TypeScript', extension: '.ts', commentPrefix: '//' },
	{ slug: 'mysql', name: 'MySQL', extension: '.sql', commentPrefix: '--' },
];

export function languageBySlug(slug: string): LanguageInfo | undefined {
	return LANGUAGES.find((language) => language.slug === slug);
}

export function languageByExtension(extension: string): LanguageInfo | undefined {
	const normalized = extension.startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
	return LANGUAGES.find((language) => language.extension === normalized);
}

export function languageByFileName(fileName: string): LanguageInfo | undefined {
	const dot = fileName.lastIndexOf('.');
	if (dot < 0) {
		return undefined;
	}
	return languageByExtension(fileName.slice(dot));
}