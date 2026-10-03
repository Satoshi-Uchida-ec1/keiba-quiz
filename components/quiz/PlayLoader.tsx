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
  request: SetRequest;
}

async function nextSet({ pool, store, request }: Session): Promise<PreparedQuestion[]> {
  const progress = await store.load();
  return buildSet(pool, request, progress).questions.map((question) => prepareQuestion(question));
}

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
