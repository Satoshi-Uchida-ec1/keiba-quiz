"use client";

import { useEffect, useState } from "react";
import type { DeliveredQuestion } from "@/lib/types";
import { loadQuestions } from "@/lib/quiz/load";
import { prepareQuestion, shuffle, type PreparedQuestion } from "@/lib/quiz/shuffle";
import { QuizScreen } from "./QuizScreen";

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "empty" }
  | { status: "playing"; raw: DeliveredQuestion[]; questions: PreparedQuestion[]; round: number }
  | { status: "finished"; raw: DeliveredQuestion[]; round: number };

function prepareAll(raw: DeliveredQuestion[]): PreparedQuestion[] {
  return shuffle(raw).map((question) => prepareQuestion(question));
}

// 出題画面の動作確認用。セット管理と出題アルゴリズムは次の段階で置き換える
export function PlayLoader() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadQuestions()
      .then((raw) => {
        if (cancelled) return;
        setState(raw.length === 0 ? { status: "empty" } : { status: "playing", raw, questions: prepareAll(raw), round: 0 });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "playing") {
    return (
      <QuizScreen
        key={state.round}
        questions={state.questions}
        onFinish={() => setState({ status: "finished", raw: state.raw, round: state.round })}
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
          <p className="text-xl font-bold">全{state.raw.length}問おわりました</p>
          <button
            type="button"
            onClick={() =>
              setState({ status: "playing", raw: state.raw, questions: prepareAll(state.raw), round: state.round + 1 })
            }
            className="min-h-12 w-full rounded-xl bg-zinc-900 px-4 py-3 font-bold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
          >
            もう一度
          </button>
        </>
      )}
    </main>
  );
}
