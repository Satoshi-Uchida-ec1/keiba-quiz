import { describe, expect, it } from "vitest";
import { formatDuration, summarizeSession } from "./result.ts";
import type { DeliveredQuestion, SessionAnswer } from "../types.ts";
import type { PreparedQuestion } from "./shuffle.ts";

// 元の answerIndex(0) で引くと "C" になるように並べ替えておき、シャッフル後の位置から正解を取っているかを確かめる
function prepared(id: string): PreparedQuestion {
  const question: DeliveredQuestion = {
    id,
    genre: 1,
    difficulty: "easy",
    question: `${id}？`,
    choices: ["A", "B", "C", "D"],
    answerIndex: 0,
    explanationShort: `${id}の解説。`,
    isTimeSensitive: false,
    updatedAt: "2026-10-05",
  };
  return { question, choices: ["C", "D", "B", "A"], answerIndex: 3 };
}

const answer = (questionId: string, correct: boolean, durationMs = 1000): SessionAnswer => ({
  questionId,
  correct,
  durationMs,
});

const set = ["q1", "q2", "q3"].map(prepared);

describe("summarizeSession", () => {
  it("全問正解なら、間違えた問題は空", () => {
    const result = summarizeSession(set, [answer("q1", true), answer("q2", true), answer("q3", true)]);
    expect(result.total).toBe(3);
    expect(result.correctCount).toBe(3);
    expect(result.missed).toEqual([]);
  });

  it("全問不正解なら、全問が間違えた問題に入る", () => {
    const result = summarizeSession(set, [answer("q1", false), answer("q2", false), answer("q3", false)]);
    expect(result.correctCount).toBe(0);
    expect(result.missed.map((m) => m.question.id)).toEqual(["q1", "q2", "q3"]);
  });

  it("間違えた問題は回答の順ではなく出題順に並び、正解はシャッフル後の位置から取る", () => {
    const result = summarizeSession(set, [answer("q3", false), answer("q2", true), answer("q1", false)]);
    expect(result.correctCount).toBe(1);
    expect(result.missed.map((m) => m.question.id)).toEqual(["q1", "q3"]);
    expect(result.missed.map((m) => m.correctChoice)).toEqual(["A", "A"]);
  });

  it("回答時間は全問の合計", () => {
    const result = summarizeSession(set, [answer("q1", true, 1200), answer("q2", false, 3400), answer("q3", true, 500)]);
    expect(result.totalDurationMs).toBe(5100);
  });

  it("回答のない問題は、total にだけ数え、正解にも不正解にも入れない", () => {
    const result = summarizeSession(set, [answer("q1", true), answer("q2", false)]);
    expect(result.total).toBe(3);
    expect(result.correctCount).toBe(1);
    expect(result.missed.map((m) => m.question.id)).toEqual(["q2"]);
  });
});

describe("formatDuration", () => {
  it("1分未満は秒、1分以上は分と秒で出す（先に秒へ四捨五入する）", () => {
    expect(formatDuration(0)).toBe("0秒");
    expect(formatDuration(59_400)).toBe("59秒");
    expect(formatDuration(59_500)).toBe("1分");
    expect(formatDuration(60_000)).toBe("1分");
    expect(formatDuration(83_000)).toBe("1分23秒");
  });
});
