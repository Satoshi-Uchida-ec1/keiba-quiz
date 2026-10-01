import { describe, expect, it } from "vitest";
import { prepareQuestion, shuffle } from "./shuffle.ts";
import type { DeliveredQuestion } from "../types.ts";

function sequence(values: number[]) {
  let i = 0;
  return () => values[i++ % values.length];
}

const question: DeliveredQuestion = {
  id: "g2-0001",
  genre: 2,
  difficulty: "easy",
  question: "テスト用の問題文？",
  choices: ["A", "B", "C", "D"],
  answerIndex: 2,
  explanationShort: "テスト用の解説。",
  isTimeSensitive: false,
  updatedAt: "2026-09-23",
};

describe("shuffle", () => {
  it("要素を失わず、元の配列を変更しない", () => {
    const items = [1, 2, 3, 4];
    const result = shuffle(items, sequence([0.9, 0.1, 0.5]));
    expect([...result].sort()).toEqual([1, 2, 3, 4]);
    expect(items).toEqual([1, 2, 3, 4]);
  });

  it("random が常に 0 に近いとき、並びが変わる", () => {
    expect(shuffle([1, 2, 3, 4], () => 0)).toEqual([2, 3, 4, 1]);
  });
});

describe("prepareQuestion", () => {
  it("並べ替え後も answerIndex が正解の選択肢を指す", () => {
    for (const seed of [0, 0.2, 0.4, 0.6, 0.8, 0.99]) {
      const prepared = prepareQuestion(question, () => seed);
      expect(prepared.choices[prepared.answerIndex]).toBe("C");
      expect([...prepared.choices].sort()).toEqual(["A", "B", "C", "D"]);
    }
  });

  it("元の問題データを変更しない", () => {
    prepareQuestion(question, () => 0);
    expect(question.choices).toEqual(["A", "B", "C", "D"]);
    expect(question.answerIndex).toBe(2);
  });
});
