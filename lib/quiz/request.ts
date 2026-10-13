import {
  DIFFICULTIES,
  GENRE_IDS,
  type DifficultyChoice,
  type GenreChoice,
  type SetRequest,
} from "../types.ts";

export const DEFAULT_REQUEST: SetRequest = { genre: "all", difficulty: "auto" };

type Params = Pick<URLSearchParams, "getAll">;

// 同じキーが複数あるリンクは意図が読めないので、その項目は初期値に戻す
function single(params: Params, key: string): string | null {
  const values = params.getAll(key);
  return values.length === 1 ? values[0] : null;
}

function parseGenre(value: string | null): GenreChoice {
  return GENRE_IDS.find((id) => String(id) === value) ?? DEFAULT_REQUEST.genre;
}

function parseDifficulty(value: string | null): DifficultyChoice {
  return DIFFICULTIES.find((difficulty) => difficulty === value) ?? DEFAULT_REQUEST.difficulty;
}

/** リンクの打ち間違いでも必ず出題が始まるよう、不正な値は項目ごとに初期値にする */
export function parseSetRequest(params: Params): SetRequest {
  return {
    genre: parseGenre(single(params, "genre")),
    difficulty: parseDifficulty(single(params, "difficulty")),
  };
}

export function toQuery(request: SetRequest): string {
  return `genre=${request.genre}&difficulty=${request.difficulty}`;
}
