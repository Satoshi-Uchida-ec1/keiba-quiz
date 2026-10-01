/**
 * 誤答通報フォーム（Googleフォーム）の事前入力URL。
 * フォームの「事前入力したURLを取得」で、問題IDの欄に __QUESTION_ID__ と入れて作ったURLを貼る。
 * 空のうちは通報リンクを表示しない。
 */
export const REPORT_FORM_URL_TEMPLATE = "";

const PLACEHOLDER = "__QUESTION_ID__";

export function buildReportUrl(questionId: string, template = REPORT_FORM_URL_TEMPLATE): string | null {
  if (!template.includes(PLACEHOLDER)) return null;
  return template.replace(PLACEHOLDER, encodeURIComponent(questionId));
}
