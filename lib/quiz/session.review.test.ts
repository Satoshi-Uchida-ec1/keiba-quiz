import { describe, expect, it } from "vitest";
import { createMemoryStore } from "../progress/memory.ts";
import { REVIEW_INTERVAL } from "../progress/review.ts";
import { AUTO_QUOTA, REVIEW_MAX, SET_SIZE, buildSet } from "./session.ts";
import type {
  DeliveredQuestion,
  Difficulty,
  GenreId,
  Progress,
  ProgressStore,
  ReviewCandidates,
  SetRequest,
} from "../types.ts";

// session.test.ts のヘルパーは export していない。既存のテストを触らないために複製した
function seeded(seed = 1) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

function questions(prefix: string, genre: GenreId, difficulty: Difficulty, count: number): DeliveredQuestion[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${i}`,
    genre,
    difficulty,
    question: `${prefix}-${i}？`,
    choices: ["A", "B", "C", "D"],
    answerIndex: 0,
    explanationShort: "テスト用の解説。",
    isTimeSensitive: false,
    updatedAt: "2026-10-08",
  }));
}

const candidates = (box1: readonly string[], box2: readonly string[] = []): ReviewCandidates => ({ box1, box2 });

function progress(recent: readonly string[], review: ReviewCandidates): Progress {
  return { answeredIds: new Set([...recent, ...review.box1, ...review.box2]), recentIds: recent, review };
}

const idsOf = (list: readonly DeliveredQuestion[]) => list.map((q) => q.id);
const countBy = (list: readonly DeliveredQuestion[], key: (q: DeliveredQuestion) => string) =>
  list.reduce<Record<string, number>>((acc, q) => ({ ...acc, [key(q)]: (acc[key(q)] ?? 0) + 1 }), {});

const easyRequest: SetRequest = { genre: 1, difficulty: "easy" };

describe("buildSet: 復習の混ぜ方", () => {
  it(`復習問題は最大 ${REVIEW_MAX} 問`, () => {
    const pool = questions("e", 1, "easy", 12);
    const box1 = idsOf(pool.slice(0, 5));
    const set = buildSet(pool, easyRequest, progress(box1, candidates(box1)), seeded());
    expect(set.questions).toHaveLength(SET_SIZE);
    expect(idsOf(set.questions).filter((id) => box1.includes(id))).toHaveLength(REVIEW_MAX);
  });

  it("箱1を箱2より先に選ぶ", () => {
    const pool = questions("e", 1, "easy", 12);
    const ids = idsOf(pool.slice(0, 5));
    const box1 = ids.slice(0, 2);
    const box2 = ids.slice(2);
    const picked = idsOf(buildSet(pool, easyRequest, progress(ids, candidates(box1, box2)), seeded()).questions);
    expect(box1.every((id) => picked.includes(id))).toBe(true);
    expect(box2.filter((id) => picked.includes(id))).toHaveLength(1);
  });

  it("同じ箱の中はランダムに選ぶ", () => {
    const pool = questions("e", 1, "easy", 12);
    const box1 = idsOf(pool.slice(0, 5));
    const chosen = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const picked = idsOf(buildSet(pool, easyRequest, progress(box1, candidates(box1)), seeded(seed)).questions);
      box1.filter((id) => picked.includes(id)).forEach((id) => chosen.add(id));
    }
    expect(chosen.size).toBeGreaterThan(REVIEW_MAX);
  });

  it("選んだジャンルの外の復習問題は混ぜない。全ジャンルのときは混ぜる", () => {
    const pool = [...questions("e", 1, "easy", 12), ...questions("x", 2, "easy", 12)];
    const outside = ["x-0", "x-1"];
    const current = progress(outside, candidates(outside));

    const inGenre = idsOf(buildSet(pool, easyRequest, current, seeded()).questions);
    expect(inGenre).not.toContain("x-0");
    expect(inGenre).not.toContain("x-1");

    const all = idsOf(buildSet(pool, { genre: "all", difficulty: "easy" }, current, seeded()).questions);
    expect(all).toContain("x-0");
    expect(all).toContain("x-1");
  });

  it("直近30問に入っている復習問題も出る", () => {
    const pool = questions("e", 1, "easy", 12);
    for (const seed of [1, 2, 3, 4, 5]) {
      const picked = idsOf(buildSet(pool, easyRequest, progress(["e-0"], candidates(["e-0"])), seeded(seed)).questions);
      expect(picked).toContain("e-0");
    }
  });

  it("問題データにない復習IDは無視する", () => {
    const pool = questions("e", 1, "easy", 12);
    const set = buildSet(pool, easyRequest, progress(["e-0"], candidates(["deleted-1", "e-0"])), seeded());
    expect(set.questions).toHaveLength(SET_SIZE);
    expect(idsOf(set.questions)).toContain("e-0");
    expect(idsOf(set.questions)).not.toContain("deleted-1");
  });

  it("復習問題が重複して出ない", () => {
    const pool = questions("e", 1, "easy", 12);
    for (const seed of [1, 2, 3, 4, 5]) {
      const ids = idsOf(buildSet(pool, easyRequest, progress([], candidates(["e-0", "e-1"])), seeded(seed)).questions);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("難易度では絞らない。選んだ難易度と違う復習問題も混ざる", () => {
    const pool = [...questions("e", 1, "easy", 12), ...questions("h", 1, "hard", 3)];
    const set = buildSet(pool, easyRequest, progress(["h-0"], candidates(["h-0"])), seeded());
    expect(idsOf(set.questions)).toContain("h-0");
  });

  it("おまかせの配分には復習問題も数える", () => {
    const pool = [
      ...questions("e", 1, "easy", 10),
      ...questions("n", 1, "normal", 10),
      ...questions("h", 1, "hard", 10),
    ];
    const reviewIds = ["e-0", "e-1", "e-2"];
    const set = buildSet(pool, { genre: 1, difficulty: "auto" }, progress(reviewIds, candidates(reviewIds)), seeded());
    expect(countBy(set.questions, (q) => q.difficulty)).toEqual({
      easy: AUTO_QUOTA.easy,
      normal: AUTO_QUOTA.normal,
      hard: AUTO_QUOTA.hard,
    });
    expect(reviewIds.every((id) => idsOf(set.questions).includes(id))).toBe(true);
  });
});

describe("履歴から出題までの流れ", () => {
  const pool = questions("q", 1, "easy", 60);

  async function answer(store: ProgressStore, id: string, correct: boolean) {
    await store.recordAnswer({ questionId: id, correct, answeredAt: "2026-10-08T00:00:00.000Z", durationMs: 1000 });
  }

  async function nextSetIds(store: ProgressStore) {
    return idsOf(buildSet(pool, easyRequest, await store.load(), seeded()).questions);
  }

  it("間違えると次のセットに入り、箱2では30回答後まで入らず、卒業すると入らない。卒業後にまた間違えると入る", async () => {
    const store = createMemoryStore();

    await answer(store, "q-0", false);
    expect(await nextSetIds(store)).toContain("q-0");

    await answer(store, "q-0", true);
    for (let i = 1; i < REVIEW_INTERVAL; i++) await answer(store, `q-${i}`, true);
    expect(await nextSetIds(store)).not.toContain("q-0");

    await answer(store, `q-${REVIEW_INTERVAL}`, true);
    expect(await nextSetIds(store)).toContain("q-0");

    await answer(store, "q-0", true);
    expect((await store.load()).review).toEqual({ box1: [], box2: [] });
    expect(await nextSetIds(store)).not.toContain("q-0");

    await answer(store, "q-0", false);
    expect(await nextSetIds(store)).toContain("q-0");
  });
});
