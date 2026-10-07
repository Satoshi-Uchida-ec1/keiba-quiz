import { describe, expect, it } from "vitest";
import { RECENT_LIMIT, summarizeAnswers } from "./summarize.ts";
import type { AnswerRecord } from "../types.ts";

function record(questionId: string, correct = true): AnswerRecord {
  return { questionId, correct, answeredAt: "2026-10-03T00:00:00.000Z", durationMs: 1000 };
}

describe("summarizeAnswers", () => {
  it("履歴が空なら、回答済みも直近もない", () => {
    const progress = summarizeAnswers([]);
    expect(progress.answeredIds.size).toBe(0);
    expect(progress.recentIds).toEqual([]);
  });

  it("直近は重複を除き、最後に回答した位置で古い順に並べる", () => {
    const progress = summarizeAnswers(["a", "b", "a", "c"].map((id) => record(id)));
    expect(progress.recentIds).toEqual(["b", "a", "c"]);
    expect([...progress.answeredIds].sort()).toEqual(["a", "b", "c"]);
  });

  it(`直近は新しい ${RECENT_LIMIT} 問まで。回答済みは全部残す`, () => {
    const ids = Array.from({ length: 35 }, (_, i) => `q${i}`);
    const progress = summarizeAnswers(ids.map((id) => record(id)));
    expect(progress.recentIds).toEqual(ids.slice(5));
    expect(progress.answeredIds.size).toBe(35);
  });

  it("復習の候補を履歴から計算して入れる", () => {
    const progress = summarizeAnswers([record("a", false), record("b")]);
    expect(progress.review).toEqual({ box1: ["a"], box2: [] });
  });
});
