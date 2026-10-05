# セッション結果画面（M-06 / P-06） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 10問のセットが終わったら、正答数・回答時間の合計・間違えた問題の一覧（問題文・正解・要点解説）を出す結果画面を表示する。

**Architecture:** 集計は純関数（`lib/quiz/result.ts` の `summarizeSession`・`formatDuration`）にして単体テストする。`QuizScreen` が回答を貯め、最後の「おわる」で `onFinish(answers)` に渡す。`PlayLoader` が集計して `ResultScreen` を表示する。結果は保存しない。

**Tech Stack:** TypeScript（strict）、Next.js 16（App Router、静的出力）、React 19、Tailwind CSS、Vitest 5（node 環境。DOM なし）

**Spec:** `docs/superpowers/specs/2026-10-05-session-result-design.md`（必ず先に読む）。仕様の正本は `docs/spec.md`。前提の実装: `docs/superpowers/plans/2026-10-03-genre-difficulty-select.md`（`PlayLoader`・`SetRequest`）

## Global Constraints

- `any` を使わない。型は `lib/types.ts` に置く
- 新しい依存パッケージを入れない
- 1ファイル200行を超えたら分割を検討する
- コメントは「なぜ」だけ書く。既存コードのコメントは日本語
- 相対 import は拡張子 `.ts` 付き（例: `from "../types.ts"`）。コンポーネントからは `@/lib/...`（拡張子なし）
- テストは `*.test.ts` を対象ファイルの隣に置く。`describe`／`it` の説明は日本語
- `git add -A`／`git add .` を使わない。ステージするパスは明示する。コミットメッセージは英語で、末尾に `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` を付ける
- `main` に直接 push しない。作業ブランチは `feat/session-result`
- WCAG 2.2 AA を目標にする: 色だけで情報を伝えない、タッチターゲット 44×44px 以上、キーボードだけで操作できる、横スクロールを出さない
- 結果画面に、投げ銭・広告・トラッキング・復習への導線（M-07 は U-13 が未決）・シェア（S-02）を置かない
- 所要時間は「各問の回答時間（`durationMs`）の合計」。解説を読む時間は含まない
- 結果は保存しない。リロードしたら結果画面は消える（U-16）
- 仕様に書かれていない振る舞いは実装で埋めず、`[要確認]` として worklog に記録して報告する

## ファイル構成

| ファイル | 作成／変更 | 役割 |
| --- | --- | --- |
| `lib/types.ts` | 変更 | `SessionAnswer`・`MissedQuestion`・`SessionResult` を追加 |
| `lib/quiz/result.ts` | 作成 | `summarizeSession`・`formatDuration` |
| `lib/quiz/result.test.ts` | 作成 | 上の単体テスト |
| `components/quiz/QuizScreen.tsx` | 変更 | 回答を貯め、`onFinish(answers)` で渡す |
| `components/quiz/ResultScreen.tsx` | 作成 | 結果画面 |
| `components/quiz/PlayLoader.tsx` | 変更 | 集計して `ResultScreen` を表示。終了画面の記述を移す |
| `docs/spec.md`・`docs/screens.md` | 変更 | M-06 の状態と結果画面の要点（Task 3） |
| `docs/worklog/2026-10-05.md` | 変更 | セッションを追記（Task 3） |

---

### Task 1: 集計の純関数（型・`summarizeSession`・`formatDuration`）

**Files:**
- Modify: `lib/types.ts`（末尾に追記）
- Create: `lib/quiz/result.ts`
- Test: `lib/quiz/result.test.ts`

**Interfaces:**
- Consumes: `PreparedQuestion`（`lib/quiz/shuffle.ts`。`{ question: DeliveredQuestion; choices: string[]; answerIndex: number }`。`choices`・`answerIndex` はシャッフル後）
- Produces:
  - `SessionAnswer`・`MissedQuestion`・`SessionResult`（`lib/types.ts`）
  - `summarizeSession(questions: readonly PreparedQuestion[], answers: readonly SessionAnswer[]): SessionResult`
  - `formatDuration(ms: number): string`

- [ ] **Step 1: 失敗するテストを書く**

`lib/quiz/result.test.ts` を作る:

```ts
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
```

- [ ] **Step 2: テストが失敗することを確かめる**

Run: `npx vitest run lib/quiz/result.test.ts`
Expected: FAIL（`./result.ts` が見つからない旨のエラー）

- [ ] **Step 3: 型を追加する**

`lib/types.ts` の末尾（`ProgressStore` の後）に追記する:

```ts

/** 1問ぶんの結果。セット内でだけ使い、保存しない */
export interface SessionAnswer {
  questionId: string;
  correct: boolean;
  durationMs: number;
}

export interface MissedQuestion {
  question: DeliveredQuestion;
  /** シャッフル後の選択肢から取った、正解の文字 */
  correctChoice: string;
}

export interface SessionResult {
  total: number;
  correctCount: number;
  /** 各問の回答時間の合計。解説を読む時間は含まない */
  totalDurationMs: number;
  /** 出題順 */
  missed: MissedQuestion[];
}
```

- [ ] **Step 4: 実装する**

`lib/quiz/result.ts` を作る:

```ts
import type { MissedQuestion, SessionAnswer, SessionResult } from "../types.ts";
import type { PreparedQuestion } from "./shuffle.ts";

export function summarizeSession(
  questions: readonly PreparedQuestion[],
  answers: readonly SessionAnswer[],
): SessionResult {
  const answerById = new Map(answers.map((answer) => [answer.questionId, answer]));
  const missed: MissedQuestion[] = [];
  let correctCount = 0;

  // 出題順にたどることで、間違えた問題を回答順ではなく出題順に並べる
  for (const prepared of questions) {
    const answer = answerById.get(prepared.question.id);
    if (!answer) continue;
    if (answer.correct) {
      correctCount++;
    } else {
      missed.push({ question: prepared.question, correctChoice: prepared.choices[prepared.answerIndex] });
    }
  }

  return {
    total: questions.length,
    correctCount,
    totalDurationMs: answers.reduce((sum, answer) => sum + answer.durationMs, 0),
    missed,
  };
}

// 分と秒に分ける前に秒へ丸める。59.5 秒が「59分60秒」のような表示にならないようにするため
export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}秒`;
  return seconds === 0 ? `${minutes}分` : `${minutes}分${seconds}秒`;
}
```

- [ ] **Step 5: テストが通ることを確かめる**

Run: `npx vitest run lib/quiz/result.test.ts`
Expected: PASS（6 tests）

Run: `npm run typecheck`
Expected: エラーなし

- [ ] **Step 6: コミット**

```bash
git add lib/types.ts lib/quiz/result.ts lib/quiz/result.test.ts
git commit -m "Add summarizeSession and formatDuration for the result screen

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 結果画面と出題からのつなぎ込み

**Files:**
- Modify: `components/quiz/QuizScreen.tsx`
- Create: `components/quiz/ResultScreen.tsx`
- Modify: `components/quiz/PlayLoader.tsx`

**Interfaces:**
- Consumes（Task 1）: `SessionAnswer`・`SessionResult`（`@/lib/types`）、`summarizeSession`・`formatDuration`（`@/lib/quiz/result`）
- Produces:
  - `QuizScreen` の `onFinish: (answers: SessionAnswer[]) => void`
  - `ResultScreen`: props は `{ result: SessionResult; onRestart: () => void }`

- [ ] **Step 1: `QuizScreen` が回答を貯めて渡すようにする**

`components/quiz/QuizScreen.tsx` を変更する。

import と props の型:

```tsx
// 変更前
import type { PreparedQuestion } from "@/lib/quiz/shuffle";
import { ChoiceList } from "./ChoiceList";
import { QuestionArea } from "./QuestionArea";

interface QuizScreenProps {
  questions: PreparedQuestion[];
  onAnswer: (questionId: string, correct: boolean, durationMs: number) => void;
  onFinish: () => void;
}
```

```tsx
// 変更後
import type { SessionAnswer } from "@/lib/types";
import type { PreparedQuestion } from "@/lib/quiz/shuffle";
import { ChoiceList } from "./ChoiceList";
import { QuestionArea } from "./QuestionArea";

interface QuizScreenProps {
  questions: PreparedQuestion[];
  onAnswer: (questionId: string, correct: boolean, durationMs: number) => void;
  onFinish: (answers: SessionAnswer[]) => void;
}
```

`shownAtRef` の宣言の次の行に ref を足す:

```tsx
  const shownAtRef = useRef(0);
  // 結果画面のために、このセットの回答を貯める。保存（onAnswer）とは別で、リロードで消えてよい
  const answersRef = useRef<SessionAnswer[]>([]);
```

`handleSelect` と `handleNext`:

```tsx
// 変更前
  function handleSelect(choiceIndex: number) {
    if (selectedIndex !== null) return;
    setSelectedIndex(choiceIndex);
    onAnswer(prepared.question.id, choiceIndex === prepared.answerIndex, Date.now() - shownAtRef.current);
  }

  function handleNext() {
    if (isLast) {
      onFinish();
      return;
    }
```

```tsx
// 変更後
  function handleSelect(choiceIndex: number) {
    if (selectedIndex !== null) return;
    setSelectedIndex(choiceIndex);
    const correct = choiceIndex === prepared.answerIndex;
    const durationMs = Date.now() - shownAtRef.current;
    answersRef.current.push({ questionId: prepared.question.id, correct, durationMs });
    onAnswer(prepared.question.id, correct, durationMs);
  }

  function handleNext() {
    if (isLast) {
      onFinish(answersRef.current);
      return;
    }
```

- [ ] **Step 2: `ResultScreen` を作る**

`components/quiz/ResultScreen.tsx` を作る:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { SessionResult } from "@/lib/types";
import { formatDuration } from "@/lib/quiz/result";

interface ResultScreenProps {
  result: SessionResult;
  onRestart: () => void;
}

export function ResultScreen({ result, onRestart }: ResultScreenProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // 結果から読ませるため、表示時に見出しへフォーカスを移す（出題画面と同じ）
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <div className="flex flex-1 flex-col gap-6 px-4 pb-4 pt-6">
        <div className="flex flex-col gap-1">
          <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold">
            {result.total}問中{result.correctCount}問正解
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">回答にかかった時間 {formatDuration(result.totalDurationMs)}</p>
        </div>

        {result.missed.length === 0 ? (
          <p className="text-xl font-bold text-green-700 dark:text-green-400">
            <span aria-hidden="true">✓ </span>全問正解！
          </p>
        ) : (
          <section aria-labelledby="missed-heading" className="flex flex-col gap-3">
            <h2 id="missed-heading" className="text-lg font-bold">
              間違えた問題（{result.missed.length}問）
            </h2>
            <ol className="flex flex-col gap-3">
              {result.missed.map(({ question, correctChoice }) => (
                <li key={question.id} className="flex flex-col gap-2 rounded-lg border border-zinc-300 p-3 dark:border-zinc-700">
                  {question.unverified && (
                    <span className="self-start rounded border border-amber-700 px-1.5 text-sm text-amber-800 dark:border-amber-400 dark:text-amber-300">
                      未確認の下書き
                    </span>
                  )}
                  <p className="font-medium leading-relaxed">{question.question}</p>
                  <p className="font-bold">
                    <span aria-hidden="true">✗ </span>正解: {correctChoice}
                  </p>
                  <p className="leading-relaxed">{question.explanationShort}</p>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
      {/* 一覧が長くなっても、親指の届く位置から次へ進めるようにする */}
      <div className="sticky bottom-0 flex flex-col gap-2 border-t border-zinc-300 bg-background px-4 py-3 dark:border-zinc-700">
        <button
          type="button"
          onClick={onRestart}
          className="flex min-h-12 w-full items-center justify-center rounded-xl bg-zinc-900 px-4 py-3 font-bold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          もう一度
        </button>
        <Link
          href="/play"
          className="flex min-h-12 w-full items-center justify-center rounded-xl border-2 border-zinc-500 px-4 py-3 font-bold hover:bg-zinc-100 dark:border-zinc-400 dark:hover:bg-zinc-800"
        >
          条件を変える
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: `PlayLoader` から `ResultScreen` を使う**

`components/quiz/PlayLoader.tsx` を変更する。

import（`Link` は使わなくなるので消し、型と関数を足す）:

```tsx
// 変更前
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { DeliveredQuestion, ProgressStore, SetRequest } from "@/lib/types";
import { loadQuestions } from "@/lib/quiz/load";
import { buildSet } from "@/lib/quiz/session";
import { prepareQuestion, type PreparedQuestion } from "@/lib/quiz/shuffle";
import { openProgressStore } from "@/lib/progress/store";
import { QuizScreen } from "./QuizScreen";
```

```tsx
// 変更後
import { useEffect, useRef, useState } from "react";
import type { DeliveredQuestion, ProgressStore, SessionResult, SetRequest } from "@/lib/types";
import { loadQuestions } from "@/lib/quiz/load";
import { summarizeSession } from "@/lib/quiz/result";
import { buildSet } from "@/lib/quiz/session";
import { prepareQuestion, type PreparedQuestion } from "@/lib/quiz/shuffle";
import { openProgressStore } from "@/lib/progress/store";
import { QuizScreen } from "./QuizScreen";
import { ResultScreen } from "./ResultScreen";
```

`State` の `finished`:

```tsx
// 変更前
  | { status: "finished"; total: number; round: number };
```

```tsx
// 変更後
  | { status: "finished"; result: SessionResult; round: number };
```

`SECONDARY_LINK` 定数（`ResultScreen` に移ったので）を削除する:

```tsx
// 削除
const SECONDARY_LINK =
  "flex min-h-12 w-full items-center justify-center rounded-xl border-2 border-zinc-500 px-4 py-3 font-bold hover:bg-zinc-100 dark:border-zinc-400 dark:hover:bg-zinc-800";
```

`playing` の描画の `onFinish`、その後に `finished` の描画を足す:

```tsx
// 変更前
        onFinish={() => setState({ status: "finished", total: state.questions.length, round: state.round })}
      />
    );
  }
```

```tsx
// 変更後
        onFinish={(answers) =>
          setState({ status: "finished", result: summarizeSession(state.questions, answers), round: state.round })
        }
      />
    );
  }

  if (state.status === "finished") {
    return <ResultScreen result={state.result} onRestart={() => void restart(state.round)} />;
  }
```

下の `<main>` 内の終了画面の記述を削除する:

```tsx
// 削除
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
```

- [ ] **Step 4: 静的検査とテスト**

Run: `npm run typecheck`
Expected: エラーなし

Run: `npm run lint`
Expected: エラーなし（`Link` や `SECONDARY_LINK` の未使用の警告が出たら、消し忘れ）

Run: `npm test`
Expected: Test Files 8 passed, Tests 55 passed

Run: `npm run build`
Expected: 成功。`/`, `/_not-found`, `/play`, `/play/session` を静的生成

- [ ] **Step 5: ブラウザで確認する（375×667 を含む）**

`preview_start`（`name: "dev"`）で開発サーバーを起動し、`/play/session?genre=all&difficulty=auto` を開く。下書き10問（easy 5・normal 5）が出る。次を1つずつ確認し、結果を控える（Task 3 の worklog に書く）。

1. 全問正解: 10問すべて正解を選ぶ → 「10問中10問正解」「全問正解！」が出て、一覧は出ない
2. 数問間違える: 3問を間違えて回答（「おわる」まで進む）→ 「10問中7問正解」、「間違えた問題（3問）」。出題順に並び、各項目の「正解」と解説が `data/questions/` の問題データと一致する（1問は実際にデータと突き合わせる）
3. 所要時間: 解説を読むために回答後に10秒以上止まってから進めても、「回答にかかった時間」が伸びない
4. 「もう一度」が同じ条件で新しいセットを始める（URL は変わらず 1/10 から）。結果画面の「条件を変える」で `/play` に戻る
5. 375×667（`resize_window` の `mobile` は 375×812 なので、`width: 375, height: 667` を指定）: 横スクロールなし（`document.documentElement.scrollWidth <= window.innerWidth`）。一覧が長くても「もう一度」「条件を変える」が画面下に固定で見える。ボタンの高さが 48px 以上
6. キーボード: 結果画面の表示直後にフォーカスが見出しにある（`document.activeElement` が `h1`）。Tab で「もう一度」→「条件を変える」に移り、Enter で操作できる
7. 結果画面でリロード → 選択画面ではなく `/play/session` の新しいセットの 1/10 に戻る
8. コンソールエラーなし（`read_console_messages`）

確認が終わったらビューポートを `desktop` に戻す。

- [ ] **Step 6: コミット**

```bash
git add components/quiz/QuizScreen.tsx components/quiz/ResultScreen.tsx components/quiz/PlayLoader.tsx
git commit -m "Show a result screen with score, answer time and missed questions

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: ドキュメントと worklog

**Files:**
- Modify: `docs/spec.md`
- Modify: `docs/screens.md`
- Modify: `docs/worklog/2026-10-05.md`（セッション 1 は設計と計画のセッションとして記録済み。実装のセッションを「セッション 2」として追記）

- [ ] **Step 1: `docs/spec.md` を更新する**

§2.1 の M-06 の行:

```md
<!-- 変更前 -->
| M-06 | セッション結果 | 1セット10問の正答数・所要時間・間違えた問題の一覧 | 未着手 |
<!-- 変更後 -->
| M-06 | セッション結果 | 1セット10問の正答数・所要時間・間違えた問題の一覧 | 実装済み（2026-10-05 S2） |
```

M-14 の行の状態を「一部（出題画面・選択画面・結果画面）」に変える。

§3 の P-03 の節にある次の1行を直す:

```md
<!-- 変更前 -->
- 終了画面に「条件を変える」リンク（`/play` へ）がある。結果画面 M-06 は別機能
<!-- 変更後 -->
- セット終了後は結果画面（下記）に進み、そこに「条件を変える」リンク（`/play` へ）がある
```

P-03 の節の後（§4 の前）に節を足す:

```md
### セッション結果（P-06）

- セット終了後に表示する。結果は保存せず、リロードすると消える（U-16）
- 見出しは「N問中M問正解」、続けて「回答にかかった時間」。所要時間は各問の回答時間（問題を表示してから回答するまで）の合計で、解説を読む時間は含めない
- 間違えた問題を出題順に並べ、問題文・正解の選択肢・要点解説を常時表示する。「もっと詳しく」・誤答通報・自分が選んだ選択肢は出さない。全問正解のときは一覧の代わりに「全問正解！」
- 「もう一度」（同じ条件で新しいセット）と「条件を変える」（`/play` へ）を画面下に固定する
- 復習への導線（M-07、U-13 が未決）・投げ銭リンク（S-09）・結果のシェア（S-02）は置かない
- 設計は `superpowers/specs/2026-10-05-session-result-design.md`（本人承認済み・メンター合意待ち）
```

- [ ] **Step 2: `docs/screens.md` を更新する**

画面一覧の P-06 の行の末尾に、今回の範囲を足す:

```md
<!-- 変更前 -->
| P-06 | セッション結果 | 正答数、所要時間、間違えた問題一覧、復習への導線。最下部に控えめな投げ銭リンク（S-09） |
<!-- 変更後 -->
| P-06 | セッション結果 | 正答数、所要時間、間違えた問題一覧、復習への導線。最下部に控えめな投げ銭リンク（S-09）。MVP で作るのは正答数・所要時間（回答時間の合計）・間違えた問題一覧・「もう一度」「条件を変える」まで（spec §3）。復習導線は M-07（U-13 未決）、投げ銭リンクは S-09 で足す |
```

- [ ] **Step 3: worklog を書く**

`docs/worklog/2026-10-05.md` に「セッション 2」を追記する。書式は `docs/worklog/TEMPLATE.md`。次を含める:

- 対象: M-06 セッション結果画面の実装。計画 `docs/superpowers/plans/2026-10-05-session-result.md` の Task 1〜3
- やったこと: Task ごとのコミットハッシュ（`git log --oneline -5` で確認して書く）
- 判断と理由: 計画どおり実装したか、変えた点はあるか。変えた点は理由も。コードを計画からそのまま採用した箇所と、理解の度合いは本人が確認することを書く。仮説（本人記入）の欄は空欄でよい
- 確認したこと: Task 1・2 で実際に実行したコマンドと出力の該当行（`npm test` の件数、`typecheck`・`lint`・`build` の結果）。Task 2 Step 5 の1〜8の結果。確認していない点（ダークモード、文字拡大・横向き、スクリーンリーダー、本番ビルドを配信した状態での動作）
- [要確認]: M-06 の仕様（所要時間の定義・一覧の内容）のメンター合意。PR の順序（`feat/select-screen` の PR を先に出すか）。実装中に見つけた仕様の穴があれば追記
- 次にやること: `feat/select-screen` と `feat/session-result` の PR を出す（人間の確認後。ベースブランチの扱いを確認）。M-07（先に U-13 を決める）、P-01（トップ。spec の機能一覧に入れるかの確認から）

- [ ] **Step 4: 確認してコミット**

Run: `npm run typecheck && npm run lint && npm test`
Expected: エラーなし。Test Files 8 passed, Tests 55 passed

```bash
git add docs/spec.md docs/screens.md docs/worklog/2026-10-05.md
git commit -m "Update spec status and worklog for the session result screen

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
