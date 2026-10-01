import { describe, expect, it } from "vitest";
import { toPublicQuestion, validateQuestion, validateQuestionSet } from "./validate.ts";
import type { SourceQuestion } from "../types.ts";

function makeQuestion(overrides: Partial<Record<keyof SourceQuestion, unknown>> = {}) {
  return {
    id: "g2-0001",
    genre: 2,
    difficulty: "easy",
    question: "テスト用の問題文？",
    choices: ["A", "B", "C", "D"],
    answerIndex: 0,
    explanationShort: "テスト用の解説。",
    source: "",
    isTimeSensitive: false,
    updatedAt: "2026-09-23",
    status: "draft",
    ...overrides,
  };
}

function fieldsOf(raw: unknown) {
  return validateQuestion(raw, "test").map((issue) => issue.field);
}

describe("validateQuestion", () => {
  it("正しい draft の問題はエラーなし", () => {
    expect(fieldsOf(makeQuestion())).toEqual([]);
  });

  it("オブジェクト以外はエラー", () => {
    expect(fieldsOf(null)).toEqual(["-"]);
    expect(fieldsOf([])).toEqual(["-"]);
  });

  it("id の形式とジャンルの一致を確認する", () => {
    expect(fieldsOf(makeQuestion({ id: "q-1" }))).toContain("id");
    expect(fieldsOf(makeQuestion({ id: "g3-0001" }))).toContain("genre");
  });

  it("enum の値を確認する", () => {
    expect(fieldsOf(makeQuestion({ genre: 8 }))).toContain("genre");
    expect(fieldsOf(makeQuestion({ difficulty: "expert" }))).toContain("difficulty");
    expect(fieldsOf(makeQuestion({ status: "done" }))).toContain("status");
  });

  it("問題文は60字以内", () => {
    expect(fieldsOf(makeQuestion({ question: "あ".repeat(60) }))).toEqual([]);
    expect(fieldsOf(makeQuestion({ question: "あ".repeat(61) }))).toContain("question");
    expect(fieldsOf(makeQuestion({ question: " " }))).toContain("question");
  });

  it("選択肢は空でない4つで重複なし", () => {
    expect(fieldsOf(makeQuestion({ choices: ["A", "B", "C"] }))).toContain("choices");
    expect(fieldsOf(makeQuestion({ choices: ["A", "B", "C", ""] }))).toContain("choices");
    expect(fieldsOf(makeQuestion({ choices: ["A", "B", "C", "A"] }))).toContain("choices");
  });

  it("answerIndex は0〜3の整数", () => {
    expect(fieldsOf(makeQuestion({ answerIndex: 4 }))).toContain("answerIndex");
    expect(fieldsOf(makeQuestion({ answerIndex: 1.5 }))).toContain("answerIndex");
    expect(fieldsOf(makeQuestion({ answerIndex: "0" }))).toContain("answerIndex");
  });

  it("source が空のままでは review / published にできない", () => {
    expect(fieldsOf(makeQuestion({ status: "review" }))).toContain("source");
    expect(fieldsOf(makeQuestion({ status: "published" }))).toContain("source");
    expect(fieldsOf(makeQuestion({ status: "published", source: "確認元" }))).toEqual([]);
  });

  it("reviewNote が残ったままでは published にできない", () => {
    expect(fieldsOf(makeQuestion({ reviewNote: "要確認" }))).toEqual([]);
    expect(
      fieldsOf(makeQuestion({ status: "published", source: "確認元", reviewNote: "要確認" })),
    ).toContain("reviewNote");
  });

  it("時事問題には asOf が必要", () => {
    expect(fieldsOf(makeQuestion({ isTimeSensitive: true }))).toContain("asOf");
    expect(fieldsOf(makeQuestion({ isTimeSensitive: true, asOf: "2024-08-11" }))).toEqual([]);
  });

  it("日付は実在する YYYY-MM-DD", () => {
    expect(fieldsOf(makeQuestion({ updatedAt: "2026-02-30" }))).toContain("updatedAt");
    expect(fieldsOf(makeQuestion({ updatedAt: "2026/09/23" }))).toContain("updatedAt");
    expect(fieldsOf(makeQuestion({ asOf: "yesterday" }))).toContain("asOf");
  });

  it("任意項目は書くなら空にしない", () => {
    expect(fieldsOf(makeQuestion({ explanationLong: "" }))).toContain("explanationLong");
    expect(fieldsOf(makeQuestion({ tags: ["競馬", ""] }))).toContain("tags");
  });
});

describe("validateQuestionSet", () => {
  it("ID の重複を検出し、正しい問題だけを返す", () => {
    const result = validateQuestionSet([
      makeQuestion(),
      makeQuestion(),
      makeQuestion({ id: "g2-0002", answerIndex: 9 }),
    ]);
    expect(result.issues.map((issue) => issue.message)).toContain("ID が重複している");
    expect(result.questions).toHaveLength(2);
  });
});

describe("toPublicQuestion", () => {
  it("内部管理用のフィールドを取り除く", () => {
    const question = makeQuestion({ source: "確認元", reviewNote: "メモ" }) as SourceQuestion;
    const pub = toPublicQuestion(question);
    expect(pub).not.toHaveProperty("source");
    expect(pub).not.toHaveProperty("status");
    expect(pub).not.toHaveProperty("reviewNote");
    expect(pub.id).toBe("g2-0001");
  });
});
