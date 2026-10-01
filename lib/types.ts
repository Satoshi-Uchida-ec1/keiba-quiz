export const GENRE_IDS = [1, 2, 3, 4, 5, 6, 7] as const;
export type GenreId = (typeof GENRE_IDS)[number];

export const DIFFICULTIES = ["easy", "normal", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const QUESTION_STATUSES = ["draft", "review", "published"] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

export type AnswerIndex = 0 | 1 | 2 | 3;

/** data/questions/*.json に置く原本。人間が編集する */
export interface SourceQuestion {
  id: string;
  genre: GenreId;
  difficulty: Difficulty;
  question: string;
  choices: [string, string, string, string];
  answerIndex: AnswerIndex;
  explanationShort: string;
  explanationLong?: string;
  tags?: string[];
  /** 事実確認に使った一次情報。人間だけが書く。非公開 */
  source: string;
  /** 確認が必要な箇所のメモ。非公開。published にする前に消す */
  reviewNote?: string;
  isTimeSensitive: boolean;
  asOf?: string;
  updatedAt: string;
  status: QuestionStatus;
  relatedArticleId?: string;
  imageRef?: string;
  eloRating?: number;
}

/** ブラウザに配信する問題。内部管理用のフィールドを含めない */
export type PublicQuestion = Omit<SourceQuestion, "source" | "status" | "reviewNote">;

/** 実際にブラウザが受け取る問題。unverified は開発サーバーでだけ付く */
export type DeliveredQuestion = PublicQuestion & { unverified?: true };
