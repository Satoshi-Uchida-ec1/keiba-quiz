# 出題アルゴリズムとセッション管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 10問セットを spec §4 の手順で生成し、回答を1問ごとに IndexedDB へ保存して、`/play` をそのセットで動かす。

**Architecture:** セット生成は状態を持たない関数 `buildSet`（`lib/quiz/session.ts`）にする。保存は `ProgressStore` インターフェース（`lib/progress/`）の裏に IndexedDB 実装とメモリ実装を置き、失敗したらメモリ実装・空の進捗に切り替える。`PlayLoader` が両者をつなぐ。

**Tech Stack:** TypeScript（strict）、Next.js 16（App Router、静的出力）、React 19、Vitest 5（node 環境。`indexedDB` はない）、ブラウザ標準の IndexedDB

**Spec:** `docs/superpowers/specs/2026-10-03-session-algorithm-design.md`（必ず先に読む）。仕様の正本は `docs/spec.md`

## Global Constraints

- `any` を使わない。新しい型は `lib/types.ts` に置く
- 新しい依存パッケージを入れない（`idb`・`fake-indexeddb` も使わない）
- 1ファイル200行を超えたら分割を検討する
- コメントは「なぜ」だけ書く。既存コードのコメントは日本語
- ブラウザストレージの操作は try/catch で囲み、失敗しても画面を壊さない（CLAUDE.md ルール5）
- 相対 import は拡張子 `.ts` 付き（例: `from "../types.ts"`）。コンポーネントからは `@/lib/...`（拡張子なし）
- テストは `*.test.ts` を対象ファイルの隣に置く。`describe`／`it` の説明は日本語
- `git add -A`／`git add .` を使わない。ステージするパスは明示する。コミットメッセージは英語で、末尾に `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` を付ける
- `main` に直接 push しない
- 定数: セット 10 問、直近 30 問、おまかせの配分 easy 3／normal 4／hard 3

## ファイル構成

| ファイル | 作成／変更 | 役割 |
| --- | --- | --- |
| `docs/spec.md` | 変更 | §4・§6 に決定を反映（Task 1）、§2 の状態を更新（Task 6） |
| `docs/data-schema.md` | 変更 | `seenRecently` と出題アルゴリズムの記述を spec に合わせる |
| `lib/types.ts` | 変更 | `SetRequest`・`QuestionSet`・`AnswerRecord`・`Progress`・`ProgressStore` |
| `lib/progress/summarize.ts` | 作成 | 回答履歴 → `Progress`（直近30問の計算） |
| `lib/quiz/session.ts` | 作成 | `buildSet` |
| `lib/progress/memory.ts` | 作成 | メモリ実装 |
| `lib/progress/indexeddb.ts` | 作成 | IndexedDB 実装 |
| `lib/progress/store.ts` | 作成 | `withFallback`・`openProgressStore` |
| `components/quiz/QuizScreen.tsx` | 変更 | `onAnswer` を追加 |
| `components/quiz/PlayLoader.tsx` | 変更 | セット生成と保存につなぐ |
| `docs/worklog/2026-10-03.md` など | 変更 | 実装セッションの worklog |

---

### Task 1: 決定を spec と data-schema に反映する

**Files:**
- Modify: `docs/spec.md`（§2 の M-02 の行、§4 全体、§6 の U-12・U-16・U-20 の行）
- Modify: `docs/data-schema.md`（`seenRecently` の行、「出題アルゴリズム（MVP）」の番号付きリスト）

**Interfaces:** なし（ドキュメントのみ）

- [ ] **Step 1: spec §2 の M-02 の行を直す**

`おまかせの選び方は【未決】U-12` を `おまかせの選び方は §4` に置き換える。状態の列（未着手）は Task 6 で直すので、ここでは変えない。

- [ ] **Step 2: spec §4 を置き換える**

`## 4. 出題アルゴリズム` から `## 5. データ` の直前までを、次の内容にする。

```markdown
## 4. 出題アルゴリズム

1. 直近に出題した30問を除外する
2. 選んだジャンル・難易度で候補を絞る。10問に満たなければ、隣の難易度 → 同じジャンルの全難易度 → 全ジャンルの順に補充する（全ジャンルから補充したことは画面で知らせる）
3. 復習キューの問題を混ぜる（10問中 最大3問。混ぜ方の詳細は【未決】U-13）
4. 候補の中では未出題の問題を先に使い、足りない分だけ出題済みの問題から選ぶ。どちらもランダム
5. 候補が尽きたら、除外した問題を古い順に戻す

- 補充の段は「未出題かどうか」より優先する。選んだ条件からなるべくずらさないため
- 「未出題」は一度も回答していない問題。「直近30問」は回答履歴を新しい順にたどって集めた、重複しない問題ID 30個
- おまかせ: そのジャンルの easy 3／normal 4／hard 3 問。易しい順に出し、同じ難易度の中はランダム。足りない難易度の分は同じジャンルの他の難易度で埋める
- セット途中でリロード・離脱したら、そのセットは破棄する。回答は1問ごとに保存する

U-12・U-16・U-20 は 2026-10-03 に本人が決定（メンター合意待ち）。設計は `superpowers/specs/2026-10-03-session-algorithm-design.md`。
```

- [ ] **Step 3: spec §6 の3行を直す**

U-12・U-16・U-20 の行の「決めるタイミング」の列を `**決定（2026-10-03、メンター合意待ち）** → §4` に置き換える。論点の列はそのまま残す。

- [ ] **Step 4: data-schema を直す**

`seenRecently` の行を次に置き換える。

```markdown
| seenRecently | 保存しない。直近に回答した、重複しない問題ID 30個を `answers` から計算する（保存場所を1か所にして食い違いを防ぐ） |
```

「## 出題アルゴリズム（MVP）」の見出しの下の番号付きリスト（1.〜5.）を、次の1行に置き換える。「### フェーズ2：適応型出題」以下は残す。

```markdown
`spec.md` §4 を正本とする（直近30問を除外してから補充を判定する、未出題を先に使う、おまかせの配分など）。
```

- [ ] **Step 5: 差分を確認する**

Run: `git diff --stat`
Expected: `docs/spec.md` と `docs/data-schema.md` の2ファイルだけが変わっている

- [ ] **Step 6: Commit**

```bash
git add docs/spec.md docs/data-schema.md
git commit -m "Record decisions for U-12, U-16 and U-20 in spec" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 型と、直近30問の計算

**Files:**
- Modify: `lib/types.ts`（末尾に追加）
- Create: `lib/progress/summarize.ts`
- Test: `lib/progress/summarize.test.ts`

**Interfaces:**
- Produces:
  - `lib/types.ts`: `GenreChoice`、`DifficultyChoice`、`SetRequest`、`QuestionSet`、`AnswerRecord`、`Progress`、`ProgressStore`（下のコードのとおり）
  - `lib/progress/summarize.ts`: `RECENT_LIMIT = 30`、`summarizeAnswers(records: readonly AnswerRecord[]): Progress`（`records` は古い順）

- [ ] **Step 1: 型を追加する**

`lib/types.ts` の末尾に追加する。

```ts
export type GenreChoice = GenreId | "all";
export type DifficultyChoice = Difficulty | "auto";

/** 1セットの出題条件。auto は「おまかせ」 */
export interface SetRequest {
  genre: GenreChoice;
  difficulty: DifficultyChoice;
}

export interface QuestionSet {
  questions: DeliveredQuestion[];
  /** 選んだジャンル以外から補充したか。genre が "all" のときは常に false */
  usedOtherGenres: boolean;
}

/** 1問ぶんの回答。IndexedDB の answers ストアに入る */
export interface AnswerRecord {
  questionId: string;
  correct: boolean;
  /** ISO 8601 */
  answeredAt: string;
  /** 問題を表示してから回答するまで */
  durationMs: number;
}

export interface Progress {
  /** 一度でも回答した問題 */
  answeredIds: ReadonlySet<string>;
  /** 直近に回答した重複しない問題ID。古い順 */
  recentIds: readonly string[];
}

export interface ProgressStore {
  load(): Promise<Progress>;
  recordAnswer(record: AnswerRecord): Promise<void>;
}
```

- [ ] **Step 2: 失敗するテストを書く**

`lib/progress/summarize.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { RECENT_LIMIT, summarizeAnswers } from "./summarize.ts";
import type { AnswerRecord } from "../types.ts";

function record(questionId: string): AnswerRecord {
  return { questionId, correct: true, answeredAt: "2026-10-03T00:00:00.000Z", durationMs: 1000 };
}

describe("summarizeAnswers", () => {
  it("履歴が空なら、回答済みも直近もない", () => {
    const progress = summarizeAnswers([]);
    expect(progress.answeredIds.size).toBe(0);
    expect(progress.recentIds).toEqual([]);
  });

  it("直近は重複を除き、最後に回答した位置で古い順に並べる", () => {
    const progress = summarizeAnswers(["a", "b", "a", "c"].map(record));
    expect(progress.recentIds).toEqual(["b", "a", "c"]);
    expect([...progress.answeredIds].sort()).toEqual(["a", "b", "c"]);
  });

  it(`直近は新しい ${RECENT_LIMIT} 問まで。回答済みは全部残す`, () => {
    const ids = Array.from({ length: 35 }, (_, i) => `q${i}`);
    const progress = summarizeAnswers(ids.map(record));
    expect(progress.recentIds).toEqual(ids.slice(5));
    expect(progress.answeredIds.size).toBe(35);
  });
});
```

- [ ] **Step 3: テストが失敗することを確かめる**

Run: `npx vitest run lib/progress/summarize.test.ts`
Expected: FAIL（`./summarize.ts` を解決できない）

- [ ] **Step 4: 実装する**

`lib/progress/summarize.ts`:

```ts
import type { AnswerRecord, Progress } from "../types.ts";

export const RECENT_LIMIT = 30;

/** records は古い順に並んでいること */
export function summarizeAnswers(records: readonly AnswerRecord[]): Progress {
  const recent: string[] = [];
  const collected = new Set<string>();
  for (let i = records.length - 1; i >= 0 && recent.length < RECENT_LIMIT; i--) {
    const id = records[i].questionId;
    if (collected.has(id)) continue;
    collected.add(id);
    recent.push(id);
  }
  return {
    answeredIds: new Set(records.map((record) => record.questionId)),
    recentIds: recent.reverse(),
  };
}
```

- [ ] **Step 5: テストと型チェックが通ることを確かめる**

Run: `npx vitest run lib/progress/summarize.test.ts`
Expected: PASS（3 tests）

Run: `npm run typecheck`
Expected: エラーなし

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/progress/summarize.ts lib/progress/summarize.test.ts
git commit -m "Add progress types and recent-question summary" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: セット生成 `buildSet`

**Files:**
- Create: `lib/quiz/session.ts`
- Test: `lib/quiz/session.test.ts`

**Interfaces:**
- Consumes: `SetRequest`、`QuestionSet`、`Progress`、`DeliveredQuestion`、`Difficulty`、`DIFFICULTIES`（`lib/types.ts`）。`shuffle`、`RandomSource`（`lib/quiz/shuffle.ts`）
- Produces: `SET_SIZE = 10`、`AUTO_QUOTA: Record<Difficulty, number>`、`buildSet(pool: readonly DeliveredQuestion[], request: SetRequest, progress: Progress, random?: RandomSource): QuestionSet`

- [ ] **Step 1: 失敗するテストを書く**

`lib/quiz/session.test.ts`:

```ts
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
  return { answeredIds: new Set([...answered, ...recent]), recentIds: recent };
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
```

- [ ] **Step 2: テストが失敗することを確かめる**

Run: `npx vitest run lib/quiz/session.test.ts`
Expected: FAIL（`./session.ts` を解決できない）

- [ ] **Step 3: 実装する**

`lib/quiz/session.ts`:

```ts
import {
  DIFFICULTIES,
  type DeliveredQuestion,
  type Difficulty,
  type Progress,
  type QuestionSet,
  type SetRequest,
} from "../types.ts";
import { shuffle, type RandomSource } from "./shuffle.ts";

export const SET_SIZE = 10;

/** おまかせで各難易度から取る問題数。合計は SET_SIZE */
export const AUTO_QUOTA: Record<Difficulty, number> = { easy: 3, normal: 4, hard: 3 };

const ADJACENT: Record<Difficulty, readonly Difficulty[]> = {
  easy: ["normal"],
  normal: ["easy", "hard"],
  hard: ["normal"],
};

/** 補充の段。上の段から順に、limit 問まで取る */
interface Tier {
  match: (question: DeliveredQuestion) => boolean;
  limit: number;
}

function tiersFor({ genre, difficulty }: SetRequest): Tier[] {
  const inGenre = (q: DeliveredQuestion) => genre === "all" || q.genre === genre;
  const sameGenre: Tier = { match: inGenre, limit: SET_SIZE };
  const anyGenre: Tier = { match: () => true, limit: SET_SIZE };

  if (difficulty === "auto") {
    const quotas = DIFFICULTIES.map((d) => ({
      match: (q: DeliveredQuestion) => inGenre(q) && q.difficulty === d,
      limit: AUTO_QUOTA[d],
    }));
    return [...quotas, sameGenre, anyGenre];
  }
  return [
    { match: (q) => inGenre(q) && q.difficulty === difficulty, limit: SET_SIZE },
    { match: (q) => inGenre(q) && ADJACENT[difficulty].includes(q.difficulty), limit: SET_SIZE },
    sameGenre,
    anyGenre,
  ];
}

function arrange(questions: DeliveredQuestion[], request: SetRequest, random: RandomSource) {
  const shuffled = shuffle(questions, random);
  if (request.difficulty !== "auto") return shuffled;
  // 初心者が序盤でつまずかないよう、おまかせは易しい順に出す（sort は安定なので同じ難易度内はランダムのまま）
  return shuffled.sort((a, b) => DIFFICULTIES.indexOf(a.difficulty) - DIFFICULTIES.indexOf(b.difficulty));
}

export function buildSet(
  pool: readonly DeliveredQuestion[],
  request: SetRequest,
  progress: Progress,
  random: RandomSource = Math.random,
): QuestionSet {
  const recent = new Set(progress.recentIds);
  const picked: DeliveredQuestion[] = [];
  const pickedIds = new Set<string>();
  const add = (question: DeliveredQuestion) => {
    picked.push(question);
    pickedIds.add(question.id);
  };

  for (const tier of tiersFor(request)) {
    const room = Math.min(tier.limit, SET_SIZE - picked.length);
    if (room <= 0) continue;
    const candidates = pool.filter((q) => tier.match(q) && !pickedIds.has(q.id) && !recent.has(q.id));
    const unseen = candidates.filter((q) => !progress.answeredIds.has(q.id));
    const seen = candidates.filter((q) => progress.answeredIds.has(q.id));
    [...shuffle(unseen, random), ...shuffle(seen, random)].slice(0, room).forEach(add);
  }

  const byId = new Map(pool.map((q) => [q.id, q]));
  for (const id of progress.recentIds) {
    if (picked.length >= SET_SIZE) break;
    const question = byId.get(id);
    if (question && !pickedIds.has(id)) add(question);
  }

  return {
    questions: arrange(picked, request, random),
    usedOtherGenres: request.genre !== "all" && picked.some((q) => q.genre !== request.genre),
  };
}
```

- [ ] **Step 4: テストが通ることを確かめる**

Run: `npx vitest run lib/quiz/session.test.ts`
Expected: PASS（15 tests）

- [ ] **Step 5: 全体のテスト・型・lint**

Run: `npm test` → 全件 PASS
Run: `npm run typecheck` → エラーなし
Run: `npm run lint` → エラーなし

- [ ] **Step 6: Commit**

```bash
git add lib/quiz/session.ts lib/quiz/session.test.ts
git commit -m "Add question-set builder (spec section 4)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 進捗の保存（メモリ実装・IndexedDB 実装・失敗時の切り替え）

**Files:**
- Create: `lib/progress/memory.ts`
- Create: `lib/progress/indexeddb.ts`
- Create: `lib/progress/store.ts`
- Test: `lib/progress/store.test.ts`

**Interfaces:**
- Consumes: `AnswerRecord`、`Progress`、`ProgressStore`（`lib/types.ts`）。`summarizeAnswers`（`lib/progress/summarize.ts`）
- Produces:
  - `createMemoryStore(initial?: readonly AnswerRecord[]): ProgressStore`
  - `createIndexedDbStore(): Promise<ProgressStore>`（使えないときは reject）
  - `withFallback(store: ProgressStore): ProgressStore`（`load` の失敗 → 空の進捗、`recordAnswer` の失敗 → 握りつぶす）
  - `openProgressStore(): Promise<ProgressStore>`（reject しない。戻り値は `withFallback` 済み）

- [ ] **Step 1: 失敗するテストを書く**

`lib/progress/store.test.ts`（Vitest は node 環境なので `indexedDB` がない。IndexedDB 実装そのものは Task 5 のブラウザ確認で確かめる）:

```ts
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
```

- [ ] **Step 2: テストが失敗することを確かめる**

Run: `npx vitest run lib/progress/store.test.ts`
Expected: FAIL（`./memory.ts` を解決できない）

- [ ] **Step 3: メモリ実装を書く**

`lib/progress/memory.ts`:

```ts
import type { AnswerRecord, ProgressStore } from "../types.ts";
import { summarizeAnswers } from "./summarize.ts";

export function createMemoryStore(initial: readonly AnswerRecord[] = []): ProgressStore {
  const records = [...initial];
  return {
    async load() {
      return summarizeAnswers(records);
    },
    async recordAnswer(record) {
      records.push(record);
    },
  };
}
```

- [ ] **Step 4: IndexedDB 実装を書く**

`lib/progress/indexeddb.ts`:

```ts
import type { AnswerRecord, ProgressStore } from "../types.ts";
import { summarizeAnswers } from "./summarize.ts";

const DB_NAME = "keiba-quiz";
// ストアを足すときはバージョンを上げ、onupgradeneeded に既存データの移行を書く（data-schema.md）
const DB_VERSION = 1;
const ANSWERS = "answers";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ANSWERS)) {
        db.createObjectStore(ANSWERS, { autoIncrement: true }).createIndex("answeredAt", "answeredAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("別のタブが古いバージョンの DB を開いている"));
  });
}

export async function createIndexedDbStore(): Promise<ProgressStore> {
  if (typeof indexedDB === "undefined") throw new Error("IndexedDB を使えない環境");
  const db = await openDatabase();

  return {
    load() {
      return new Promise((resolve, reject) => {
        const request = db.transaction(ANSWERS, "readonly").objectStore(ANSWERS).index("answeredAt").getAll();
        request.onsuccess = () => {
          const records: AnswerRecord[] = request.result;
          resolve(summarizeAnswers(records));
        };
        request.onerror = () => reject(request.error);
      });
    },
    recordAnswer(record) {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(ANSWERS, "readwrite");
        transaction.objectStore(ANSWERS).add(record);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    },
  };
}
```

- [ ] **Step 5: 失敗時の切り替えを書く**

`lib/progress/store.ts`:

```ts
import type { ProgressStore } from "../types.ts";
import { createIndexedDbStore } from "./indexeddb.ts";
import { createMemoryStore } from "./memory.ts";
import { summarizeAnswers } from "./summarize.ts";

// ストレージは容量超過やプライベートモードで失敗しうる。進捗が残らなくても出題は続けられるようにする（CLAUDE.md ルール5）
export function withFallback(store: ProgressStore): ProgressStore {
  return {
    async load() {
      try {
        return await store.load();
      } catch {
        return summarizeAnswers([]);
      }
    },
    async recordAnswer(record) {
      try {
        await store.recordAnswer(record);
      } catch {
        // 進捗が1問ぶん残らないだけで、出題は続けられる
      }
    },
  };
}

export async function openProgressStore(): Promise<ProgressStore> {
  try {
    return withFallback(await createIndexedDbStore());
  } catch {
    return withFallback(createMemoryStore());
  }
}
```

- [ ] **Step 6: テストが通ることを確かめる**

Run: `npx vitest run lib/progress/store.test.ts`
Expected: PASS（4 tests）

- [ ] **Step 7: 全体のテスト・型・lint**

Run: `npm test` → 全件 PASS
Run: `npm run typecheck` → エラーなし（`request.result` の型が `any` のため、`const records: AnswerRecord[]` に入れて型を付けている）
Run: `npm run lint` → エラーなし

- [ ] **Step 8: Commit**

```bash
git add lib/progress/memory.ts lib/progress/indexeddb.ts lib/progress/store.ts lib/progress/store.test.ts
git commit -m "Add progress store backed by IndexedDB with in-memory fallback" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `/play` をセット生成と保存につなぐ

**Files:**
- Modify: `components/quiz/QuizScreen.tsx`
- Modify: `components/quiz/PlayLoader.tsx`（全体を置き換え）

**Interfaces:**
- Consumes: `buildSet`（`@/lib/quiz/session`）、`openProgressStore`（`@/lib/progress/store`）、`prepareQuestion`／`PreparedQuestion`（`@/lib/quiz/shuffle`）、`loadQuestions`（`@/lib/quiz/load`）、`DeliveredQuestion`／`ProgressStore`／`SetRequest`（`@/lib/types`）
- Produces: `QuizScreen` の props に `onAnswer: (questionId: string, correct: boolean, durationMs: number) => void`

- [ ] **Step 1: `QuizScreen` に `onAnswer` を足す**

`components/quiz/QuizScreen.tsx` の props を変える。

```ts
interface QuizScreenProps {
  questions: PreparedQuestion[];
  onAnswer: (questionId: string, correct: boolean, durationMs: number) => void;
  onFinish: () => void;
}

export function QuizScreen({ questions, onAnswer, onFinish }: QuizScreenProps) {
```

`isFirstRender` の宣言の下に、表示時刻を持つ ref を追加する。

```ts
  const shownAtRef = useRef(0);
```

既存の2つの `useEffect` の後に、表示時刻を記録する effect を追加する（描画中に `Date.now()` を呼ばないため effect で記録する）。

```ts
  useEffect(() => {
    shownAtRef.current = Date.now();
  }, [index]);
```

`handleNext` の前に回答の処理を追加する。

```ts
  function handleSelect(choiceIndex: number) {
    if (selectedIndex !== null) return;
    setSelectedIndex(choiceIndex);
    onAnswer(prepared.question.id, choiceIndex === prepared.answerIndex, Date.now() - shownAtRef.current);
  }
```

`<ChoiceList>` の `onSelect={setSelectedIndex}` を `onSelect={handleSelect}` に変える。

- [ ] **Step 2: `PlayLoader` を置き換える**

`components/quiz/PlayLoader.tsx` の全体を次にする。

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { DeliveredQuestion, ProgressStore, SetRequest } from "@/lib/types";
import { loadQuestions } from "@/lib/quiz/load";
import { buildSet } from "@/lib/quiz/session";
import { prepareQuestion, type PreparedQuestion } from "@/lib/quiz/shuffle";
import { openProgressStore } from "@/lib/progress/store";
import { QuizScreen } from "./QuizScreen";

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "empty" }
  | { status: "playing"; questions: PreparedQuestion[]; round: number }
  | { status: "finished"; total: number; round: number };

interface Session {
  pool: DeliveredQuestion[];
  store: ProgressStore;
}

// ジャンル・難易度選択（P-03）ができるまでは全ジャンル×おまかせで出題する
const REQUEST: SetRequest = { genre: "all", difficulty: "auto" };

async function nextSet({ pool, store }: Session): Promise<PreparedQuestion[]> {
  const progress = await store.load();
  return buildSet(pool, REQUEST, progress).questions.map((question) => prepareQuestion(question));
}

export function PlayLoader() {
  const [state, setState] = useState<State>({ status: "loading" });
  const sessionRef = useRef<Session | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadQuestions(), openProgressStore()])
      .then(async ([pool, store]) => {
        const session = { pool, store };
        sessionRef.current = session;
        const questions = await nextSet(session);
        if (cancelled) return;
        setState(questions.length === 0 ? { status: "empty" } : { status: "playing", questions, round: 0 });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 書き込みの完了を待たずに次へ進める。同じ DB の後続の読み込みは先の書き込みの完了後に実行されるので、「もう一度」で読み直す進捗に反映される
  function handleAnswer(questionId: string, correct: boolean, durationMs: number) {
    void sessionRef.current?.store.recordAnswer({
      questionId,
      correct,
      durationMs,
      answeredAt: new Date().toISOString(),
    });
  }

  async function restart(round: number) {
    const session = sessionRef.current;
    if (!session) return;
    setState({ status: "playing", questions: await nextSet(session), round: round + 1 });
  }

  if (state.status === "playing") {
    return (
      <QuizScreen
        key={state.round}
        questions={state.questions}
        onAnswer={handleAnswer}
        onFinish={() => setState({ status: "finished", total: state.questions.length, round: state.round })}
      />
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      {state.status === "loading" && <p role="status">問題を読み込んでいます…</p>}
      {state.status === "error" && <p role="alert">問題を読み込めませんでした。通信状況を確認して、ページを再読み込みしてください。</p>}
      {state.status === "empty" && <p>公開中の問題はまだありません。</p>}
      {state.status === "finished" && (
        <>
          <p className="text-xl font-bold">全{state.total}問おわりました</p>
          <button
            type="button"
            onClick={() => void restart(state.round)}
            className="min-h-12 w-full rounded-xl bg-zinc-900 px-4 py-3 font-bold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
          >
            もう一度
          </button>
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 3: テスト・型・lint**

Run: `npm test` → 全件 PASS
Run: `npm run typecheck` → エラーなし
Run: `npm run lint` → エラーなし

- [ ] **Step 4: ブラウザで確かめる**

`preview_start`（name: `dev`）で開発サーバーを起動し、`http://localhost:3000/play` を開く。開発サーバーでは下書きの10問（easy 5・normal 5・hard 0）が出る。

1. 進捗が `1/10` で始まり、最初の5問が easy、後の5問が normal であること（おまかせの易しい順。hard がないので同じジャンル内の他の難易度で埋まる）
2. 3問回答してから、次の式で IndexedDB の件数が 3 であることを確かめる

   ```js
   await new Promise((r) => { const q = indexedDB.open("keiba-quiz"); q.onsuccess = () => { const c = q.result.transaction("answers").objectStore("answers").count(); c.onsuccess = () => r(c.result); }; })
   ```

3. 途中でリロードすると `1/10` から新しいセットが始まり、件数は 3 のままであること（U-16）
4. 10問回答して「もう一度」を押すと、新しいセットが始まること。件数が増えていること
5. `resize_window` で 375×667 にして、出題画面がスクロールなしに収まり、壊れていないこと。スクリーンショットを撮る
6. コンソールにエラーがないこと（`read_console_messages`）
7. 確認が終わったら `resize_window` を `desktop` に戻す

直近30問の除外は、問題が10問しかないため画面では確かめられない（毎回すべて戻る）。Task 3 の単体テストで確かめている、と worklog に書く。IndexedDB が使えないときの動作も、主要ブラウザのプライベートモードでは IndexedDB が使えるため画面では再現しにくい。Task 4 の単体テスト（`withFallback`・`openProgressStore`）で確かめている、と worklog に書く。

- [ ] **Step 5: Commit**

```bash
git add components/quiz/QuizScreen.tsx components/quiz/PlayLoader.tsx
git commit -m "Build play sets from progress and save each answer" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: spec の状態更新と worklog

**Files:**
- Modify: `docs/spec.md`（§2 の M-02・M-08・M-10 の状態の列）
- Modify: `docs/worklog/YYYY-MM-DD.md`（実装した日。同じ日のファイルがあれば追記）

**Interfaces:** なし

- [ ] **Step 1: spec §2 の状態を直す**（`S1` は実装した日の worklog のセッション番号に合わせる）

| ID | 状態の列 |
| --- | --- |
| M-02 | `一部（おまかせの選び方のみ。選択画面は未着手）（YYYY-MM-DD S1）` |
| M-08 | `実装済み（YYYY-MM-DD S1）` |
| M-10 | `一部（解答履歴のみ）（YYYY-MM-DD S1）` |

- [ ] **Step 2: 最終確認のコマンドを実行する**

Run: `npm test`、`npm run typecheck`、`npm run lint`、`npm run build`
Expected: すべて成功。出力の要点（テスト件数、build の成否）を worklog に貼る

- [ ] **Step 3: worklog を書く**

`docs/worklog/TEMPLATE.md` の書式に従う。次を必ず含める。
- 確認したこと: Step 2 のコマンドと出力の要点。Task 5 Step 4 のブラウザ確認の手順と結果（375×667 を含む）。単体テストで代えた2点（直近30問の除外、IndexedDB が使えないとき）
- [要確認]: 「進捗を保存できていないことを画面で知らせるか」（仕様にないので作っていない）
- 次にやること: P-03（ジャンル・難易度選択画面）と `usedOtherGenres` の表示、M-06（結果画面）、M-07（U-13 を決めてから）

- [ ] **Step 4: Commit**

```bash
git add docs/spec.md docs/worklog/YYYY-MM-DD.md
git commit -m "Update spec status and worklog for session algorithm" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: push と PR は人間に確認してから行う**

ブランチ `feat/session-algorithm` を push し、`main` 宛ての PR を出してよいか、ユーザーに確認する。PR 本文には `.github/pull_request_template.md` を使い、worklog のセッションを書く。
