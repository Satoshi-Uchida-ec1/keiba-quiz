# ジャンル・難易度選択画面（P-03） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/play` にジャンル・難易度の選択画面を置き、選んだ条件を URL のクエリで `/play/session` の出題へ渡す。

**Architecture:** 条件の読み書きは純粋関数（`lib/quiz/request.ts`）にして単体テストする。選択画面（`SelectScreen`）は通常のリンクで `/play/session?genre=…&difficulty=…` へ進む。出題側は `useSearchParams` で条件を読み、`PlayLoader` が `buildSet` に渡す。補充が起きたときは出題の前に確認画面を挟む。

**Tech Stack:** TypeScript（strict）、Next.js 16（App Router、静的出力）、React 19、Tailwind CSS、Vitest 5（node 環境。DOM なし）

**Spec:** `docs/superpowers/specs/2026-10-03-genre-difficulty-select-design.md`（必ず先に読む）。仕様の正本は `docs/spec.md`。前提の実装は `docs/superpowers/plans/2026-10-03-session-algorithm.md`（`buildSet`・`SetRequest` など）

## Global Constraints

- `any` を使わない。型は `lib/types.ts` に置く（`GenreChoice`・`DifficultyChoice`・`SetRequest` は既にある）
- 新しい依存パッケージを入れない
- 1ファイル200行を超えたら分割を検討する
- コメントは「なぜ」だけ書く。既存コードのコメントは日本語
- 相対 import は拡張子 `.ts` 付き（例: `from "../types.ts"`）。コンポーネントからは `@/lib/...`（拡張子なし）
- テストは `*.test.ts` を対象ファイルの隣に置く。`describe`／`it` の説明は日本語
- `git add -A`／`git add .` を使わない。ステージするパスは明示する。コミットメッセージは英語で、末尾に `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` を付ける
- `main` に直接 push しない。作業ブランチは `feat/select-screen`
- WCAG 2.2 AA を目標にする: 色だけで情報を伝えない、タッチターゲット 44×44px 以上、キーボードだけで操作できる、横スクロールを出さない
- 出題画面・確認画面に、投げ銭など回答に関係ないものを置かない
- URL の形: `genre` は `1`〜`7` または `all`、`difficulty` は `easy`／`normal`／`hard`／`auto`。不正・欠け・複数指定は、その項目を「全ジャンル」「おまかせ」にする

## ファイル構成

| ファイル | 作成／変更 | 役割 |
| --- | --- | --- |
| `lib/quiz/request.ts` | 作成 | `DEFAULT_REQUEST`・`parseSetRequest`・`toQuery` |
| `lib/quiz/request.test.ts` | 作成 | 上の単体テスト |
| `components/quiz/SelectScreen.tsx` | 作成 | 選択画面（ラジオ2グループ＋「始める」リンク） |
| `components/quiz/SessionPage.tsx` | 作成 | URL から条件を読み、`PlayLoader` に渡す |
| `components/quiz/PlayLoader.tsx` | 変更 | 条件を props で受ける。確認画面と「条件を変える」を足す |
| `app/(quiz)/play/page.tsx` | 変更 | 選択画面を表示 |
| `app/(quiz)/play/session/page.tsx` | 作成 | `<Suspense>` で囲んで `SessionPage` を表示 |
| `docs/spec.md`・`docs/screens.md` | 変更 | P-03 の要点と状態（Task 4） |
| `docs/worklog/2026-10-03.md` | 変更 | セッション 4 を追記（Task 4） |

---

### Task 1: 条件の読み書き `request.ts`

**Files:**
- Create: `lib/quiz/request.ts`
- Test: `lib/quiz/request.test.ts`

**Interfaces:**
- Consumes: `DIFFICULTIES`・`GENRE_IDS`・`GenreChoice`・`DifficultyChoice`・`SetRequest`（`lib/types.ts`）
- Produces:
  - `DEFAULT_REQUEST: SetRequest`（`{ genre: "all", difficulty: "auto" }`）
  - `parseSetRequest(params: Pick<URLSearchParams, "getAll">): SetRequest`（`useSearchParams()` の戻り値をそのまま渡せる）
  - `toQuery(request: SetRequest): string`（`"genre=1&difficulty=easy"` の形。先頭に `?` を付けない）

- [ ] **Step 1: 失敗するテストを書く**

`lib/quiz/request.test.ts`:

```ts
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
```

- [ ] **Step 2: テストが失敗することを確かめる**

Run: `npx vitest run lib/quiz/request.test.ts`
Expected: FAIL（`./request.ts` を解決できない）

- [ ] **Step 3: 実装する**

`lib/quiz/request.ts`:

```ts
import {
  DIFFICULTIES,
  GENRE_IDS,
  type DifficultyChoice,
  type GenreChoice,
  type SetRequest,
} from "../types.ts";

export const DEFAULT_REQUEST: SetRequest = { genre: "all", difficulty: "auto" };

type Params = Pick<URLSearchParams, "getAll">;

// 同じキーが複数あるリンクは意図が読めないので、その項目は初期値に戻す
function single(params: Params, key: string): string | null {
  const values = params.getAll(key);
  return values.length === 1 ? values[0] : null;
}

function parseGenre(value: string | null): GenreChoice {
  return GENRE_IDS.find((id) => String(id) === value) ?? DEFAULT_REQUEST.genre;
}

function parseDifficulty(value: string | null): DifficultyChoice {
  return DIFFICULTIES.find((difficulty) => difficulty === value) ?? DEFAULT_REQUEST.difficulty;
}

/** リンクの打ち間違いでも必ず出題が始まるよう、不正な値は項目ごとに初期値にする */
export function parseSetRequest(params: Params): SetRequest {
  return {
    genre: parseGenre(single(params, "genre")),
    difficulty: parseDifficulty(single(params, "difficulty")),
  };
}

export function toQuery(request: SetRequest): string {
  return `genre=${request.genre}&difficulty=${request.difficulty}`;
}
```

- [ ] **Step 4: テストと型・lint が通ることを確かめる**

Run: `npx vitest run lib/quiz/request.test.ts`
Expected: PASS（7 tests）

Run: `npm run typecheck` → エラーなし
Run: `npm run lint` → エラーなし

- [ ] **Step 5: Commit**

```bash
git add lib/quiz/request.ts lib/quiz/request.test.ts
git commit -m "Add parsing and serialization of quiz set requests" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 選択画面と `/play/session`

**Files:**
- Create: `components/quiz/SelectScreen.tsx`
- Create: `components/quiz/SessionPage.tsx`
- Create: `app/(quiz)/play/session/page.tsx`
- Modify: `app/(quiz)/play/page.tsx`
- Modify: `components/quiz/PlayLoader.tsx`（条件を props で受ける）

**Interfaces:**
- Consumes: `DEFAULT_REQUEST`・`parseSetRequest`・`toQuery`（Task 1）。`GENRE_LABELS`・`DIFFICULTY_LABELS`（`@/lib/quiz/labels`）。`DIFFICULTIES`・`GENRE_IDS`・`GenreChoice`・`DifficultyChoice`・`SetRequest`（`@/lib/types`）
- Produces: `PlayLoader` の props `{ request: SetRequest }`

- [ ] **Step 1: 選択画面を作る**

`components/quiz/SelectScreen.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { DIFFICULTIES, GENRE_IDS, type DifficultyChoice, type GenreChoice } from "@/lib/types";
import { DIFFICULTY_LABELS, GENRE_LABELS } from "@/lib/quiz/labels";
import { DEFAULT_REQUEST, toQuery } from "@/lib/quiz/request";

interface Option<T extends string | number> {
  value: T;
  label: string;
}

const GENRE_OPTIONS: Option<GenreChoice>[] = [
  { value: "all", label: "全ジャンル" },
  ...GENRE_IDS.map((id) => ({ value: id, label: GENRE_LABELS[id] })),
];

const DIFFICULTY_OPTIONS: Option<DifficultyChoice>[] = [
  ...DIFFICULTIES.map((difficulty) => ({ value: difficulty, label: DIFFICULTY_LABELS[difficulty] })),
  { value: "auto", label: "おまかせ" },
];

const UNCHECKED =
  "border-zinc-500 bg-white text-zinc-900 hover:bg-zinc-100 dark:border-zinc-400 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800";
const CHECKED = "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900";

interface OptionGroupProps<T extends string | number> {
  name: string;
  legend: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  columns: 1 | 2;
}

// ラジオボタンを隠して見た目だけ作る。選択中は色に加えて ✓ でも示す（WCAG 1.4.1）
function OptionGroup<T extends string | number>({ name, legend, options, value, onChange, columns }: OptionGroupProps<T>) {
  return (
    <fieldset>
      <legend className="mb-2 text-lg font-bold">{legend}</legend>
      <div className={`grid gap-2 ${columns === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <label key={option.value} className="block">
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="peer sr-only"
              />
              <span
                className={`flex min-h-12 items-center gap-2 rounded-xl border-2 px-4 py-3 text-base font-medium peer-focus-visible:outline-4 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-700 dark:peer-focus-visible:outline-blue-300 ${checked ? CHECKED : UNCHECKED}`}
              >
                <span aria-hidden="true" className="w-4 shrink-0 font-bold">
                  {checked ? "✓" : ""}
                </span>
                {option.label}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function SelectScreen() {
  const [genre, setGenre] = useState<GenreChoice>(DEFAULT_REQUEST.genre);
  const [difficulty, setDifficulty] = useState<DifficultyChoice>(DEFAULT_REQUEST.difficulty);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <div className="flex flex-1 flex-col gap-6 px-4 pb-4 pt-6">
        <h1 className="text-xl font-bold">ジャンルと難易度を選ぶ</h1>
        <OptionGroup name="genre" legend="ジャンル" options={GENRE_OPTIONS} value={genre} onChange={setGenre} columns={1} />
        <OptionGroup
          name="difficulty"
          legend="難易度"
          options={DIFFICULTY_OPTIONS}
          value={difficulty}
          onChange={setDifficulty}
          columns={2}
        />
      </div>
      {/* 画面が縦に収まらなくても、親指の届く位置から始められるようにする */}
      <div className="sticky bottom-0 border-t border-zinc-300 bg-background px-4 py-3 dark:border-zinc-700">
        <Link
          href={`/play/session?${toQuery({ genre, difficulty })}`}
          className="flex min-h-12 w-full items-center justify-center rounded-xl bg-zinc-900 px-4 py-3 text-base font-bold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          始める
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: URL から条件を読むコンポーネントを作る**

`components/quiz/SessionPage.tsx`:

```tsx
"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { parseSetRequest } from "@/lib/quiz/request";
import { PlayLoader } from "./PlayLoader";

export function SessionPage() {
  const searchParams = useSearchParams();
  // 条件が変わらない限り同じオブジェクトを渡し、PlayLoader が問題を読み直さないようにする
  const request = useMemo(() => parseSetRequest(searchParams), [searchParams]);
  return <PlayLoader request={request} />;
}
```

- [ ] **Step 3: ルートを作る・直す**

`app/(quiz)/play/page.tsx` の全体を次にする。

```tsx
import type { Metadata } from "next";
import { SelectScreen } from "@/components/quiz/SelectScreen";

export const metadata: Metadata = {
  title: "ジャンル・難易度を選ぶ",
};

export default function SelectPage() {
  return <SelectScreen />;
}
```

`app/(quiz)/play/session/page.tsx`（新規）:

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { SessionPage } from "@/components/quiz/SessionPage";

export const metadata: Metadata = {
  title: "クイズ",
};

// 静的出力のビルドでは、useSearchParams を使うページを Suspense で囲まないと失敗する（Next.js 16 のドキュメント）
export default function PlaySessionPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-dvh w-full max-w-md items-center justify-center px-4 text-center">
          <p role="status">問題を読み込んでいます…</p>
        </main>
      }
    >
      <SessionPage />
    </Suspense>
  );
}
```

- [ ] **Step 4: `PlayLoader` が条件を props で受けるようにする**

`components/quiz/PlayLoader.tsx` を次のとおり変える（3 か所）。

(a) 型の import に `SetRequest` は既にある。`REQUEST` の定数と、その直前のコメントを削除する。

```tsx
// ジャンル・難易度選択（P-03）ができるまでは全ジャンル×おまかせで出題する
const REQUEST: SetRequest = { genre: "all", difficulty: "auto" };
```

(b) `Session` に `request` を足し、`nextSet` を条件から作るようにする。

```tsx
interface Session {
  pool: DeliveredQuestion[];
  store: ProgressStore;
  request: SetRequest;
}

async function nextSet({ pool, store, request }: Session): Promise<PreparedQuestion[]> {
  const progress = await store.load();
  return buildSet(pool, request, progress).questions.map((question) => prepareQuestion(question));
}
```

(c) コンポーネントの宣言と、読み込みの `useEffect` を変える。

```tsx
interface PlayLoaderProps {
  request: SetRequest;
}

export function PlayLoader({ request }: PlayLoaderProps) {
```

```tsx
  useEffect(() => {
    let cancelled = false;
    Promise.all([loadQuestions(), openProgressStore()])
      .then(async ([pool, store]) => {
        const session = { pool, store, request };
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
  }, [request]);
```

- [ ] **Step 5: テスト・型・lint・ビルド**

Run: `npm test` → 全件 PASS（49 tests）
Run: `npm run typecheck` → エラーなし
Run: `npm run lint` → エラーなし
Run: `npm run build`
Expected: 成功。ルート一覧に `/play` と `/play/session` が静的（`○`）で出る

- [ ] **Step 6: ブラウザで確かめる**

`preview_start`（name: `dev`）で開発サーバーを起動する。下書きは 10 問（easy 5・normal 5）。

1. `http://localhost:3000/play` を開く。「全ジャンル」と「おまかせ」に ✓ が付いている。そのまま「始める」を押すと `/play/session?genre=all&difficulty=auto` で 1/10 から出題が始まる
2. 戻って「簡単」を選んで「始める」。URL が `difficulty=easy` になり、最初の問題が「簡単」と表示される
3. `http://localhost:3000/play/session?genre=99&difficulty=zzz` を直接開く。エラーにならず、全ジャンル×おまかせで出題が始まる
4. `read_console_messages` でエラーがない

（特定ジャンルを選ぶと、下書きが少ないため別ジャンルから補充される。その確認画面は Task 3 で作るので、ここではまだ出ない）

- [ ] **Step 7: Commit**

```bash
git add components/quiz/SelectScreen.tsx components/quiz/SessionPage.tsx components/quiz/PlayLoader.tsx "app/(quiz)/play/page.tsx" "app/(quiz)/play/session/page.tsx"
git commit -m "Add genre and difficulty selection screen and move the quiz to /play/session" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: 補充の確認画面と「条件を変える」

**Files:**
- Modify: `components/quiz/PlayLoader.tsx`（全体を置き換え）

**Interfaces:**
- Consumes: `PlayLoader` の props `{ request: SetRequest }`（Task 2）。`buildSet` が返す `QuestionSet`（`questions`・`usedOtherGenres`）
- Produces: なし（画面の完成）

- [ ] **Step 1: `PlayLoader` を置き換える**

`components/quiz/PlayLoader.tsx` の全体を次にする。

```tsx
"use client";

import Link from "next/link";
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
  | { status: "notice"; questions: PreparedQuestion[]; round: number }
  | { status: "playing"; questions: PreparedQuestion[]; round: number }
  | { status: "finished"; total: number; round: number };

interface Session {
  pool: DeliveredQuestion[];
  store: ProgressStore;
  request: SetRequest;
}

interface PreparedSet {
  questions: PreparedQuestion[];
  usedOtherGenres: boolean;
}

async function nextSet({ pool, store, request }: Session): Promise<PreparedSet> {
  const progress = await store.load();
  const set = buildSet(pool, request, progress);
  return {
    questions: set.questions.map((question) => prepareQuestion(question)),
    usedOtherGenres: set.usedOtherGenres,
  };
}

// 別ジャンルから補充したときは、出題画面に何も足さず、出題の前に知らせる（spec §4）
function stateFor(set: PreparedSet, round: number): State {
  if (set.questions.length === 0) return { status: "empty" };
  if (set.usedOtherGenres) return { status: "notice", questions: set.questions, round };
  return { status: "playing", questions: set.questions, round };
}

const PRIMARY_BUTTON =
  "flex min-h-12 w-full items-center justify-center rounded-xl bg-zinc-900 px-4 py-3 font-bold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900";
const SECONDARY_LINK =
  "flex min-h-12 w-full items-center justify-center rounded-xl border-2 border-zinc-500 px-4 py-3 font-bold hover:bg-zinc-100 dark:border-zinc-400 dark:hover:bg-zinc-800";

interface PlayLoaderProps {
  request: SetRequest;
}

export function PlayLoader({ request }: PlayLoaderProps) {
  const [state, setState] = useState<State>({ status: "loading" });
  const sessionRef = useRef<Session | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadQuestions(), openProgressStore()])
      .then(async ([pool, store]) => {
        const session = { pool, store, request };
        sessionRef.current = session;
        const set = await nextSet(session);
        if (cancelled) return;
        setState(stateFor(set, 0));
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [request]);

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
    setState(stateFor(await nextSet(session), round + 1));
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
      {state.status === "notice" && (
        <>
          <p className="text-lg font-bold">このジャンルの問題が足りないため、他のジャンルからも出題します</p>
          <button
            type="button"
            onClick={() => setState({ status: "playing", questions: state.questions, round: state.round })}
            className={PRIMARY_BUTTON}
          >
            始める
          </button>
        </>
      )}
      {state.status === "finished" && (
        <>
          <p className="text-xl font-bold">全{state.total}問おわりました</p>
          <button type="button" onClick={() => void restart(state.round)} className={PRIMARY_BUTTON}>
            もう一度
          </button>
          <Link href="/play" className={SECONDARY_LINK}>
            条件を変える
          </Link>
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 2: テスト・型・lint**

Run: `npm test` → 全件 PASS（49 tests）
Run: `npm run typecheck` → エラーなし
Run: `npm run lint` → エラーなし

- [ ] **Step 3: ブラウザで確かめる**

`preview_start`（name: `dev`）。下書きは 10 問なので、特定のジャンルを選ぶと必ず別ジャンルから補充される。

1. `/play` で「血統」を選んで「始める」。確認画面「このジャンルの問題が足りないため、他のジャンルからも出題します」が出て、「始める」で 1/10 から出題が始まる
2. `/play` で「全ジャンル」＋「簡単」を選ぶ。確認画面は出ず、直接出題が始まる（全ジャンルのときは補充にならない）
3. 10 問回答して「もう一度」を押すと、同じ条件で新しいセットが始まる（URL は変わらない）
4. 終了画面の「条件を変える」を押すと `/play` に戻り、選択はまた初期値になっている
5. `resize_window` で 375×667 にして、`/play`（スクロールで全部の選択肢に届くこと。「始める」が画面下に固定されていること）、確認画面、出題画面（スクロールなしに収まること）、終了画面のスクリーンショットを撮る。横スクロールが出ていないことを `document.documentElement.scrollWidth > innerWidth` が `false` で確かめる
6. キーボードだけで操作する: `/play` で Tab と矢印キーでジャンル・難易度を変え、Tab で「始める」に移って Enter。フォーカスの枠が見える
7. `read_console_messages` でエラーがない
8. 確認が終わったら `resize_window` を `desktop` に戻す

- [ ] **Step 4: Commit**

```bash
git add components/quiz/PlayLoader.tsx
git commit -m "Show a notice before quizzes that borrow questions from other genres" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: spec の更新と worklog

**Files:**
- Modify: `docs/spec.md`（§2 の M-01・M-02 の状態、§3 の末尾に P-03 の節）
- Modify: `docs/screens.md`（P-03 の行）
- Modify: `docs/worklog/2026-10-03.md`（セッション 4 を追記）

**Interfaces:** なし

- [ ] **Step 1: spec §2 の状態を直す**

M-01 の行の状態の列（`未着手`）を `実装済み（2026-10-03 S4）` にする。M-02 の行の状態の列（`一部（おまかせの選び方のみ。選択画面は未着手）（2026-10-03 S3）`）を `実装済み（2026-10-03 S3・S4）` にする。M-14 の `一部（出題画面のみ）` は、選択画面でも 375px 幅で確認したので `一部（出題画面・選択画面）` にする。

- [ ] **Step 2: spec に P-03 の節を足す**

`docs/spec.md` の `レイアウト図は \`screens.md\`。` の行の後（`## 4. 出題アルゴリズム` の前）に、次を足す。

```markdown
### ジャンル・難易度選択（P-03）

- 1画面でジャンル（全ジャンル＋7ジャンル）と難易度（簡単・普通・難しい・おまかせ）を選び、「始める」で出題を始める。初期値は全ジャンル×おまかせ。前回の選択は覚えない
- 選んだ条件は URL のクエリで出題画面に渡す: `/play/session?genre=1〜7|all&difficulty=easy|normal|hard|auto`。不正・欠け・複数指定の値は、その項目を全ジャンル・おまかせにする
- 別ジャンルから補充したセットは、出題の前に確認画面で知らせる。出題画面には何も足さない
- 終了画面に「条件を変える」リンク（`/play` へ）がある。結果画面 M-06 は別機能
- 設計は `superpowers/specs/2026-10-03-genre-difficulty-select-design.md`（本人承認済み・メンター合意待ち）
```

- [ ] **Step 3: screens.md を直す**

`docs/screens.md` の P-03 の行の役割の列（`7ジャンル＋全ジャンルミックス、3難易度＋おまかせ`）の末尾に、`。1画面で選び、URL（/play/session?genre=…&difficulty=…）で出題へ渡す（spec §3）` を足す。

- [ ] **Step 4: 最終確認のコマンドを実行する**

Run: `npm test`、`npm run typecheck`、`npm run lint`、`npm run build`
Expected: すべて成功。出力の要点（テスト件数、build の成否、ルート一覧）を worklog に貼る

Run: `ls out/play`
Expected: `session.html` と `index.html`（または `play.html`）がある（`/play/session` が静的に生成されている）

- [ ] **Step 5: worklog を書く**

`docs/worklog/2026-10-03.md` に `## セッション 4` を追記する。書式は `docs/worklog/TEMPLATE.md`。実際に実行した結果だけを書く（推測で書かない）。必ず次を含める。

- 対象: P-03（M-01・M-02）。設計は `docs/superpowers/specs/2026-10-03-genre-difficulty-select-design.md`
- やったこと: Task 1〜4 のコミットのハッシュと要約
- 判断と理由: 仮説は「（本人記入）」の空欄にする。Q1（URL）・Q2（1画面）・Q3（確認画面）の選択、前回の選択を覚えない、不正値は初期値にする、を理由つきで書く。いずれも AI の推奨を本人が選んだ。このセッションを新しい会話に切り替えず同じ会話で続けたのは、本人の判断（CLAUDE.md を改訂した経緯も併記）
- 確認したこと: Step 4 の出力の要点。Task 2・3 のブラウザ確認の手順と結果（375×667、キーボード操作を含む）。確認できていない点があれば明記する
- [要確認]: PR #3 が未マージのためブランチを `feat/session-algorithm` から切った（マージ後にベースを `main` へ付け替える）。メンターに確認する事項（spec.md の合意、U-12・U-16・U-20 の決定）は引き続き
- 次にやること: M-06（結果画面）、M-07（先に U-13 を決める）、P-01（トップ。spec の機能一覧に入れるかの確認から）

- [ ] **Step 6: Commit**

```bash
git add docs/spec.md docs/screens.md docs/worklog/2026-10-03.md
git commit -m "Update spec status and worklog for the selection screen" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: push と PR は人間に確認してから行う**

ブランチ `feat/select-screen` を push し、PR を出してよいか、ユーザーに確認する。PR #3 が未マージなら、ベースを `feat/session-algorithm` にするか、PR #3 のマージを待つかも確認する。PR 本文には `.github/pull_request_template.md` を使い、worklog のセッション 4 を書く。
