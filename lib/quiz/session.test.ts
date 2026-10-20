import { describe, expect, it } from "vitest";
import { AUTO_QUOTA, SET_SIZE, buildSet } from "./session.ts";
import type { DeliveredQuestion, Difficulty, GenreId, Progress } from "../types.ts";

// 定数を返す乱数だと並びが偏って誤って通ることがあるので、決定的な疑似乱数を使う
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
    updatedAt: "2026-10-03",
  }));
}

function progress(answered: readonly string[] = [], recent: readonly string[] = []): Progress {
  return { answeredIds: new Set([...answered, ...recent]), recentIds: recent, review: { box1: [], box2: [] } };
}

const idsOf = (list: readonly DeliveredQuestion[]) => list.map((q) => q.id);
const sortedIds = (list: readonly DeliveredQuestion[]) => idsOf(list).sort();
const countBy = (list: readonly DeliveredQuestion[], key: (q: DeliveredQuestion) => string) =>
  list.reduce<Record<string, number>>((acc, q) => ({ ...acc, [key(q)]: (acc[key(q)] ?? 0) + 1 }), {});

describe("buildSet: 難易度を指定", () => {
  it("条件に10問以上あれば、その条件だけから選ぶ", () => {
    const pool = [...questions("e", 1, "easy", 12), ...questions("n", 1, "normal", 5)];
    const set = buildSet(pool, { genre: 1, difficulty: "easy" }, progress(), seeded());
    expect(set.questions).toHaveLength(SET_SIZE);
    expect(set.questions.every((q) => q.difficulty === "easy")).toBe(true);
    expect(set.usedOtherGenres).toBe(false);
  });

  it("足りなければ 隣の難易度 → 同ジャンルの残り → 他ジャンル の順に補充する", () => {
    const pool = [
      ...questions("e", 1, "easy", 3),
      ...questions("n", 1, "normal", 3),
      ...questions("h", 1, "hard", 2),
      ...questions("x", 2, "easy", 5),
    ];
    const set = buildSet(pool, { genre: 1, difficulty: "easy" }, progress(), seeded());
    expect(countBy(set.questions, (q) => `${q.genre}-${q.difficulty}`)).toEqual({
      "1-easy": 3,
      "1-normal": 3,
      "1-hard": 2,
      "2-easy": 2,
    });
    expect(set.usedOtherGenres).toBe(true);
  });

  it("easy の補充は normal を hard より先に使う", () => {
    const pool = [...questions("e", 1, "easy", 4), ...questions("n", 1, "normal", 4), ...questions("h", 1, "hard", 4)];
    const set = buildSet(pool, { genre: 1, difficulty: "easy" }, progress(), seeded());
    expect(countBy(set.questions, (q) => q.difficulty)).toEqual({ easy: 4, normal: 4, hard: 2 });
  });

  it("normal の隣は easy と hard の両方で、他ジャンルより先に使う", () => {
    const pool = [
      ...questions("n", 1, "normal", 2),
      ...questions("e", 1, "easy", 4),
      ...questions("h", 1, "hard", 4),
      ...questions("x", 2, "normal", 10),
    ];
    const set = buildSet(pool, { genre: 1, difficulty: "normal" }, progress(), seeded());
    expect(set.questions.every((q) => q.genre === 1)).toBe(true);
    expect(set.usedOtherGenres).toBe(false);
  });

  it("直近30問を除外してから補充を判定する", () => {
    const easy = questions("e", 1, "easy", 10);
    const pool = [...easy, ...questions("n", 1, "normal", 10)];
    const set = buildSet(pool, { genre: 1, difficulty: "easy" }, progress([], idsOf(easy)), seeded());
    expect(set.questions.every((q) => q.difficulty === "normal")).toBe(true);
  });

  it("段の中では未出題の問題を先に使う", () => {
    const easy = questions("e", 1, "easy", 12);
    const answered = idsOf(easy.slice(0, 4));
    const set = buildSet(easy, { genre: 1, difficulty: "easy" }, progress(answered), seeded());
    const picked = new Set(idsOf(set.questions));
    expect(idsOf(easy.slice(4)).every((id) => picked.has(id))).toBe(true);
  });

  it("段の優先は「未出題かどうか」より上", () => {
    const easy = questions("e", 1, "easy", 10);
    const pool = [...easy, ...questions("n", 1, "normal", 10)];
    const set = buildSet(pool, { genre: 1, difficulty: "easy" }, progress(idsOf(easy)), seeded());
    expect(sortedIds(set.questions)).toEqual(idsOf(easy).sort());
  });

  it("全段を使っても足りなければ、直近の問題を古い順に戻す", () => {
    const fresh = questions("f", 1, "easy", 3);
    const recent = questions("r", 1, "easy", 12);
    const set = buildSet([...fresh, ...recent], { genre: 1, difficulty: "easy" }, progress([], idsOf(recent)), seeded());
    expect(sortedIds(set.questions)).toEqual([...idsOf(fresh), ...idsOf(recent.slice(0, 7))].sort());
  });

  it("問題データにない直近IDは無視する", () => {
    const pool = questions("e", 1, "easy", 3);
    const set = buildSet(pool, { genre: 1, difficulty: "easy" }, progress([], ["deleted-1", "e-0"]), seeded());
    expect(sortedIds(set.questions)).toEqual(["e-0", "e-1", "e-2"]);
  });

  it("問題が10問未満ならその数だけ、0問なら空にする", () => {
    expect(buildSet(questions("e", 1, "easy", 4), { genre: 1, difficulty: "easy" }, progress(), seeded()).questions).toHaveLength(4);
    expect(buildSet([], { genre: 1, difficulty: "easy" }, progress(), seeded())).toEqual({
      questions: [],
      usedOtherGenres: false,
    });
  });

  it("全ジャンルのときは usedOtherGenres が常に false", () => {
    const pool = [...questions("a", 1, "easy", 3), ...questions("b", 2, "hard", 7)];
    const set = buildSet(pool, { genre: "all", difficulty: "easy" }, progress(), seeded());
    expect(set.questions).toHaveLength(SET_SIZE);
    expect(set.usedOtherGenres).toBe(false);
  });

  it("セットの中で同じ問題を出さない", () => {
    const pool = [...questions("e", 1, "easy", 6), ...questions("x", 3, "hard", 6)];
    for (const seed of [1, 2, 3, 4, 5]) {
      const ids = idsOf(buildSet(pool, { genre: 1, difficulty: "easy" }, progress([], ["e-0", "x-0"]), seeded(seed)).questions);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe("buildSet: おまかせ", () => {
  it(`easy ${AUTO_QUOTA.easy}／normal ${AUTO_QUOTA.normal}／hard ${AUTO_QUOTA.hard} 問を易しい順に並べる`, () => {
    const pool = [
      ...questions("e", 1, "easy", 10),
      ...questions("n", 1, "normal", 10),
      ...questions("h", 1, "hard", 10),
      ...questions("x", 2, "easy", 10),
    ];
    const set = buildSet(pool, { genre: 1, difficulty: "auto" }, progress(), seeded());
    expect(set.questions.map((q) => q.difficulty)).toEqual([
      ...Array<Difficulty>(AUTO_QUOTA.easy).fill("easy"),
      ...Array<Difficulty>(AUTO_QUOTA.normal).fill("normal"),
      ...Array<Difficulty>(AUTO_QUOTA.hard).fill("hard"),
    ]);
    expect(set.usedOtherGenres).toBe(false);
  });

  it("足りない難易度の分は同じジャンルの他の難易度で埋める", () => {
    const pool = [
      ...questions("e", 1, "easy", 1),
      ...questions("n", 1, "normal", 10),
      ...questions("h", 1, "hard", 10),
      ...questions("x", 2, "easy", 10),
    ];
    const set = buildSet(pool, { genre: 1, difficulty: "auto" }, progress(), seeded());
    expect(set.questions).toHaveLength(SET_SIZE);
    expect(set.questions.every((q) => q.genre === 1)).toBe(true);
    expect(set.questions[0].difficulty).toBe("easy");
    expect(countBy(set.questions, (q) => q.difficulty).easy).toBe(1);
  });

  it("同じジャンルで足りなければ他ジャンルから補充する", () => {
    const pool = [...questions("e", 1, "easy", 2), ...questions("x", 2, "hard", 10)];
    const set = buildSet(pool, { genre: 1, difficulty: "auto" }, progress(), seeded());
    expect(set.questions).toHaveLength(SET_SIZE);
    expect(set.usedOtherGenres).toBe(true);
  });
});
