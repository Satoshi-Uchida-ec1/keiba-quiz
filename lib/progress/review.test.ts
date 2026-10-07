import { describe, expect, it } from "vitest";
import { REVIEW_INTERVAL, computeReviewCandidates } from "./review.ts";
import type { AnswerRecord } from "../types.ts";

function record(questionId: string, correct: boolean): AnswerRecord {
  return { questionId, correct, answeredAt: "2026-10-08T00:00:00.000Z", durationMs: 1000 };
}

const wrong = (id: string) => record(id, false);
const right = (id: string) => record(id, true);

/** 一度も間違えていない別の問題への正解を count 件並べる。箱の状態は変わらない */
function others(count: number): AnswerRecord[] {
  return Array.from({ length: count }, (_, i) => right(`other-${i}`));
}

describe("computeReviewCandidates", () => {
  it("履歴が空なら、候補はない", () => {
    expect(computeReviewCandidates([])).toEqual({ box1: [], box2: [] });
  });

  it("不正解で箱1に入る。同じ問題を続けて間違えても1回だけ", () => {
    expect(computeReviewCandidates([wrong("a"), wrong("a"), wrong("b")])).toEqual({ box1: ["a", "b"], box2: [] });
  });

  it("一度も間違えていない問題は候補に出ない", () => {
    expect(computeReviewCandidates([right("a"), right("b")])).toEqual({ box1: [], box2: [] });
  });

  it("箱1で正解すると箱2に移り、最後の正解から30回答後に候補に入る（29回答後はまだ）", () => {
    const history = [wrong("a"), right("a")];
    expect(computeReviewCandidates([...history, ...others(REVIEW_INTERVAL - 1)])).toEqual({ box1: [], box2: [] });
    expect(computeReviewCandidates([...history, ...others(REVIEW_INTERVAL)])).toEqual({ box1: [], box2: ["a"] });
  });

  it("箱2で正解すると卒業し、候補から外れる", () => {
    const history = [wrong("a"), right("a"), right("a"), ...others(REVIEW_INTERVAL)];
    expect(computeReviewCandidates(history)).toEqual({ box1: [], box2: [] });
  });

  it("箱2で間違えると箱1に戻る", () => {
    expect(computeReviewCandidates([wrong("a"), right("a"), wrong("a")])).toEqual({ box1: ["a"], box2: [] });
  });

  it("卒業したあとにまた間違えると、箱1に入る", () => {
    expect(computeReviewCandidates([wrong("a"), right("a"), right("a"), wrong("a")])).toEqual({
      box1: ["a"],
      box2: [],
    });
  });

  it("箱1と箱2を別々に返す", () => {
    const history = [wrong("a"), right("a"), wrong("b"), ...others(REVIEW_INTERVAL)];
    expect(computeReviewCandidates(history)).toEqual({ box1: ["b"], box2: ["a"] });
  });
});
