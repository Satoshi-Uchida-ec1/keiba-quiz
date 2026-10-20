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
