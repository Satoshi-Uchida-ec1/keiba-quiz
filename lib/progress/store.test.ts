import { describe, expect, it } from "vitest";
import { createMemoryStore } from "./memory.ts";
import { openProgressStore, withFallback } from "./store.ts";
import type { AnswerRecord, ProgressStore } from "../types.ts";

function record(questionId: string): AnswerRecord {
  return { questionId, correct: false, answeredAt: "2026-10-03T00:00:00.000Z", durationMs: 500 };
}

const broken: ProgressStore = {
  load: () => Promise.reject(new Error("load failed")),
  recordAnswer: () => Promise.reject(new Error("write failed")),
};

describe("createMemoryStore", () => {
  it("記録した回答を読み込める", async () => {
    const store = createMemoryStore([record("a")]);
    await store.recordAnswer(record("b"));
    const progress = await store.load();
    expect(progress.recentIds).toEqual(["a", "b"]);
  });
});

describe("withFallback", () => {
  it("読み込みに失敗したら、進捗なしとして扱う", async () => {
    const progress = await withFallback(broken).load();
    expect(progress.answeredIds.size).toBe(0);
    expect(progress.recentIds).toEqual([]);
  });

  it("保存に失敗しても reject しない", async () => {
    await expect(withFallback(broken).recordAnswer(record("a"))).resolves.toBeUndefined();
  });
});

describe("openProgressStore", () => {
  it("IndexedDB がない環境では、メモリに保存する", async () => {
    const store = await openProgressStore();
    await store.recordAnswer(record("a"));
    expect((await store.load()).recentIds).toEqual(["a"]);
  });
});
