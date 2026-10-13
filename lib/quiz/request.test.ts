import { describe, expect, it } from "vitest";
import { DEFAULT_REQUEST, parseSetRequest, toQuery } from "./request.ts";
import { DIFFICULTIES, GENRE_IDS, type DifficultyChoice, type GenreChoice } from "../types.ts";

const parse = (query: string) => parseSetRequest(new URLSearchParams(query));

describe("parseSetRequest", () => {
  it("正しい値をそのまま読む", () => {
    expect(parse("genre=4&difficulty=hard")).toEqual({ genre: 4, difficulty: "hard" });
    expect(parse("genre=all&difficulty=auto")).toEqual({ genre: "all", difficulty: "auto" });
  });

  it("値が欠けていれば、全ジャンル×おまかせにする", () => {
    expect(parse("")).toEqual(DEFAULT_REQUEST);
  });

  it("ジャンルが範囲外・不正なら、ジャンルだけ初期値に戻す", () => {
    for (const bad of ["0", "8", "-1", "1.5", "abc", ""]) {
      expect(parse(`genre=${bad}&difficulty=easy`)).toEqual({ genre: "all", difficulty: "easy" });
    }
  });

  it("難易度が不正なら、難易度だけ初期値に戻す", () => {
    for (const bad of ["EASY", "medium", "1", ""]) {
      expect(parse(`genre=3&difficulty=${bad}`)).toEqual({ genre: 3, difficulty: "auto" });
    }
  });

  it("同じキーが複数あれば、その項目を初期値に戻す", () => {
    expect(parse("genre=1&genre=2&difficulty=easy&difficulty=hard")).toEqual(DEFAULT_REQUEST);
  });
});

describe("toQuery", () => {
  it("genre と difficulty を並べる", () => {
    expect(toQuery({ genre: 2, difficulty: "normal" })).toBe("genre=2&difficulty=normal");
  });

  it("全32通りで、toQuery → parseSetRequest が元の条件に戻る", () => {
    const genres: GenreChoice[] = [...GENRE_IDS, "all"];
    const difficulties: DifficultyChoice[] = [...DIFFICULTIES, "auto"];
    for (const genre of genres) {
      for (const difficulty of difficulties) {
        expect(parse(toQuery({ genre, difficulty }))).toEqual({ genre, difficulty });
      }
    }
  });
});
