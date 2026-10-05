"use client";

import { useEffect, useRef, useState } from "react";
import type { DeliveredQuestion, ProgressStore, SessionResult, SetRequest } from "@/lib/types";
import { loadQuestions } from "@/lib/quiz/load";
import { summarizeSession } from "@/lib/quiz/result";
import { buildSet } from "@/lib/quiz/session";
import { prepareQuestion, type PreparedQuestion } from "@/lib/quiz/shuffle";
import { openProgressStore } from "@/lib/progress/store";
import { QuizScreen } from "./QuizScreen";
import { ResultScreen } from "./ResultScreen";

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "empty" }
  | { status: "notice"; questions: PreparedQuestion[]; round: number }
  | { status: "playing"; questions: PreparedQuestion[]; round: number }
  | { status: "finished"; result: SessionResult; round: number };

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
        onFinish={(answers) =>
          setState({ status: "finished", result: summarizeSession(state.questions, answers), round: state.round })
        }
      />
    );
  }

  if (state.status === "finished") {
    return <ResultScreen result={state.result} onRestart={() => void restart(state.round)} />;
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
    </main>
  );
}
