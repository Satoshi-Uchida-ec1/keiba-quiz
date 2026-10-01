import type { Difficulty, GenreId } from "../types.ts";

export const GENRE_LABELS: Record<GenreId, string> = {
  1: "馬の生物学",
  2: "競馬の基礎・ルール",
  3: "騎手・調教師・厩舎",
  4: "血統",
  5: "名馬・歴史",
  6: "海外・地方・ばんえい",
  7: "馬文化",
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "簡単",
  normal: "普通",
  hard: "難しい",
};
