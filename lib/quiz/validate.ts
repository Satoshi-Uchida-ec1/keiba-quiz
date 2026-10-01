import {
  DIFFICULTIES,
  GENRE_IDS,
  QUESTION_STATUSES,
  type PublicQuestion,
  type SourceQuestion,
} from "../types.ts";

export const QUESTION_MAX_LENGTH = 60;

export interface ValidationIssue {
  id: string;
  field: string;
  message: string;
}

type Raw = Record<string, unknown>;

const ID_PATTERN = /^g([1-7])-\d{4}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Raw {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isValidDate(value: unknown): boolean {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function includes<T>(list: readonly T[], value: unknown): value is T {
  return (list as readonly unknown[]).includes(value);
}

// 絵文字やサロゲートペアを1字として数えるため、length ではなく文字単位で数える
function charLength(text: string): number {
  return [...text].length;
}

export function validateQuestion(raw: unknown, label: string): ValidationIssue[] {
  if (!isRecord(raw)) {
    return [{ id: label, field: "-", message: "問題がオブジェクトではない" }];
  }

  const id = isNonEmptyString(raw.id) ? raw.id : label;
  const issues: ValidationIssue[] = [];
  const add = (field: string, message: string) => issues.push({ id, field, message });

  const idMatch = typeof raw.id === "string" ? ID_PATTERN.exec(raw.id) : null;
  if (!idMatch) add("id", "g<ジャンル番号>-<4桁の連番> の形式にする（例: g2-0001）");

  if (!includes(GENRE_IDS, raw.genre)) {
    add("genre", "1〜7の数値にする");
  } else if (idMatch && Number(idMatch[1]) !== raw.genre) {
    add("genre", `id の先頭（g${idMatch[1]}）と genre（${raw.genre}）が一致しない`);
  }

  if (!includes(DIFFICULTIES, raw.difficulty)) add("difficulty", "easy / normal / hard のいずれかにする");
  if (!includes(QUESTION_STATUSES, raw.status)) add("status", "draft / review / published のいずれかにする");

  if (!isNonEmptyString(raw.question)) {
    add("question", "問題文が空");
  } else if (charLength(raw.question) > QUESTION_MAX_LENGTH) {
    add("question", `${QUESTION_MAX_LENGTH}字以内にする（現在 ${charLength(raw.question)}字）`);
  }

  if (!Array.isArray(raw.choices) || raw.choices.length !== 4) {
    add("choices", "選択肢はちょうど4つにする");
  } else if (!raw.choices.every(isNonEmptyString)) {
    add("choices", "空の選択肢がある");
  } else if (new Set(raw.choices.map((c: string) => c.trim())).size !== 4) {
    add("choices", "同じ選択肢が重複している");
  }

  if (!includes([0, 1, 2, 3], raw.answerIndex)) add("answerIndex", "0〜3の整数にする");

  if (!isNonEmptyString(raw.explanationShort)) add("explanationShort", "要点解説が空");
  if (raw.explanationLong !== undefined && !isNonEmptyString(raw.explanationLong)) {
    add("explanationLong", "書かない場合は項目ごと省く");
  }

  if (raw.tags !== undefined && !(Array.isArray(raw.tags) && raw.tags.every(isNonEmptyString))) {
    add("tags", "空でない文字列の配列にする");
  }

  if (typeof raw.source !== "string") {
    add("source", "文字列にする（未確認の間は空文字）");
  } else if (raw.status !== "draft" && raw.source.trim() === "") {
    // AIの下書きは source が空のまま入る。人間が一次情報を確認して書くまで公開側に進めない
    add("source", "review / published にするには一次情報の確認元を書く");
  }

  if (raw.reviewNote !== undefined) {
    if (typeof raw.reviewNote !== "string") {
      add("reviewNote", "文字列にする");
    } else if (raw.status === "published") {
      add("reviewNote", "published にする前に確認を済ませて項目ごと消す");
    }
  }

  if (typeof raw.isTimeSensitive !== "boolean") {
    add("isTimeSensitive", "true / false にする");
  } else if (raw.isTimeSensitive && raw.asOf === undefined) {
    add("asOf", "時事問題には基準日が必要");
  }
  if (raw.asOf !== undefined && !isValidDate(raw.asOf)) add("asOf", "YYYY-MM-DD の実在する日付にする");
  if (!isValidDate(raw.updatedAt)) add("updatedAt", "YYYY-MM-DD の実在する日付にする");

  if (raw.relatedArticleId !== undefined && !isNonEmptyString(raw.relatedArticleId)) {
    add("relatedArticleId", "書かない場合は項目ごと省く");
  }
  if (raw.imageRef !== undefined && !isNonEmptyString(raw.imageRef)) {
    add("imageRef", "書かない場合は項目ごと省く");
  }
  if (raw.eloRating !== undefined && typeof raw.eloRating !== "number") {
    add("eloRating", "数値にする");
  }

  return issues;
}

export interface QuestionSetResult {
  questions: SourceQuestion[];
  issues: ValidationIssue[];
}

export function validateQuestionSet(raws: unknown[], labelPrefix = ""): QuestionSetResult {
  const issues: ValidationIssue[] = [];
  const questions: SourceQuestion[] = [];
  const seen = new Set<string>();

  raws.forEach((raw, index) => {
    const found = validateQuestion(raw, `${labelPrefix}[${index}]`);
    issues.push(...found);
    if (found.length === 0) questions.push(raw as SourceQuestion);

    if (isRecord(raw) && typeof raw.id === "string") {
      if (seen.has(raw.id)) issues.push({ id: raw.id, field: "id", message: "ID が重複している" });
      seen.add(raw.id);
    }
  });

  return { questions, issues };
}

export function toPublicQuestion(question: SourceQuestion): PublicQuestion {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { source, status, reviewNote, ...rest } = question;
  return rest;
}
