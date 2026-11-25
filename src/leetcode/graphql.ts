import { Site } from '../types/problem';

export const USER_STATUS_QUERY = `query userStatus {
  userStatus {
    isSignedIn
    username
  }
}`;

export function problemListQuery(site: Site): string {
	if (site === 'leetcode.cn') {
		return `query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
  problemsetQuestionList(
    categorySlug: $categorySlug
    limit: $limit
    skip: $skip
    filters: $filters
  ) {
    total
    questions {
      acRate
      difficulty
      frontendQuestionId
      paidOnly
      status
      title
      titleCn
      titleSlug
      topicTags {
        name
        slug
      }
    }
  }
}`;
	}
	return `query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
  problemsetQuestionList: questionList(
    categorySlug: $categorySlug
    limit: $limit
    skip: $skip
    filters: $filters
  ) {
    total: totalNum
    questions: data {
      acRate
      difficulty
      frontendQuestionId: questionFrontendId
      paidOnly: isPaidOnly
      status
      title
      titleSlug
      topicTags {
        name
        slug
      }
    }
  }
}`;
}

export function questionQuery(site: Site): string {
	const translated = site === 'leetcode.cn' ? '\n    translatedTitle\n    translatedContent' : '';
	return `query questionData($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionId
    questionFrontendId
    title${translated}
    difficulty
    content
    exampleTestcases
    sampleTestCase
    metaData
    isPaidOnly
    status
    stats
    hints
    topicTags {
      name
      slug
    }
    codeSnippets {
      lang
      langSlug
      code
    }
  }
}`;
}

export const SUBMIT_MUTATION = `mutation submit($questionId: Int!, $lang: String!, $code: String!) {
  submit(question: $questionId, lang: $lang, code: $code) {
    submissionId
  }
}`;