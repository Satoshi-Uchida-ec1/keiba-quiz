import { GENRE_IDS, type DeliveredQuestion, type GenreId } from "../types.ts";

export async function loadQuestions(
  genres: readonly GenreId[] = GENRE_IDS,
): Promise<DeliveredQuestion[]> {
  const lists = await Promise.all(
    genres.map(async (genre) => {
      const response = await fetch(`/questions/genre-${genre}.json`);
      if (!response.ok) throw new Error(`ジャンル${genre}の問題を取得できない（${response.status}）`);
      const data: unknown = await response.json();
      if (!Array.isArray(data)) throw new Error(`ジャンル${genre}の問題データの形式が不正`);
      return data as DeliveredQuestion[];
    }),
  );
  return lists.flat();
}
