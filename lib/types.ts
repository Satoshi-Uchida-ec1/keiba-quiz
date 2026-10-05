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

export type GenreChoice = GenreId | "all";
export type DifficultyChoice = Difficulty | "auto";

/** 1セットの出題条件。auto は「おまかせ」 */
export interface SetRequest {
  genre: GenreChoice;
  difficulty: DifficultyChoice;
}

export interface QuestionSet {
  questions: DeliveredQuestion[];
  /** 選んだジャンル以外から補充したか。genre が "all" のときは常に false */
  usedOtherGenres: boolean;
}

/** 1問ぶんの回答。IndexedDB の answers ストアに入る */
export interface AnswerRecord {
  questionId: string;
  correct: boolean;
  /** ISO 8601 */
  answeredAt: string;
  /** 問題を表示してから回答するまで */
  durationMs: number;
}

export interface Progress {
  /** 一度でも回答した問題 */
  answeredIds: ReadonlySet<string>;
  /** 直近に回答した重複しない問題ID。古い順 */
  recentIds: readonly string[];
}

export interface ProgressStore {
  load(): Promise<Progress>;
  recordAnswer(record: AnswerRecord): Promise<void>;
}

/** 1問ぶんの結果。セット内でだけ使い、保存しない */
export interface SessionAnswer {
  questionId: string;
  correct: boolean;
  durationMs: number;
}

export interface MissedQuestion {
  question: DeliveredQuestion;
  /** シャッフル後の選択肢から取った、正解の文字 */
  correctChoice: string;
}

export interface SessionResult {
  total: number;
  correctCount: number;
  /** 各問の回答時間の合計。解説を読む時間は含まない */
  totalDurationMs: number;
  /** 出題順 */
  missed: MissedQuestion[];
}
