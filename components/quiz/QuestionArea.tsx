import type { Ref } from "react";
import type { PreparedQuestion } from "@/lib/quiz/shuffle";
import { DIFFICULTY_LABELS, GENRE_LABELS } from "@/lib/quiz/labels";
import { buildReportUrl } from "@/lib/quiz/report";

interface QuestionAreaProps {
  prepared: PreparedQuestion;
  selectedIndex: number | null;
  current: number;
  total: number;
  headingRef: Ref<HTMLHeadingElement>;
}

export function QuestionArea({ prepared, selectedIndex, current, total, headingRef }: QuestionAreaProps) {
  const { question } = prepared;
  const answered = selectedIndex !== null;
  const correct = selectedIndex === prepared.answerIndex;
  const reportUrl = buildReportUrl(question.id);

  return (
    <div className="flex flex-col gap-3 px-4 pt-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
        <span className="font-bold text-zinc-900 dark:text-zinc-50">
          {current} / {total}
        </span>
        <span>{GENRE_LABELS[question.genre]}</span>
        <span>{DIFFICULTY_LABELS[question.difficulty]}</span>
        {question.unverified && (
          <span className="rounded border border-amber-700 px-1.5 text-amber-800 dark:border-amber-400 dark:text-amber-300">
            未確認の下書き
          </span>
        )}
      </div>

      <h1
        ref={headingRef}
        tabIndex={-1}
        className={answered ? "text-sm text-zinc-600 dark:text-zinc-400" : "text-xl font-bold leading-relaxed"}
      >
        {question.question}
      </h1>

      {/* 結果をスクリーンリーダーにも伝えるため、領域は回答前から置いておく */}
      <div aria-live="polite">
        {answered && (
          <div className="flex flex-col gap-2">
            <p
              className={`text-xl font-bold ${correct ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}
            >
              <span aria-hidden="true">{correct ? "✓ " : "✗ "}</span>
              {correct ? "正解！" : "不正解"}
            </p>
            <p className="leading-relaxed">{question.explanationShort}</p>
          </div>
        )}
      </div>

      {answered && question.explanationLong && (
        <details className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700">
          <summary className="min-h-11 cursor-pointer py-2 font-medium">もっと詳しく</summary>
          <p className="pb-2 leading-relaxed">{question.explanationLong}</p>
        </details>
      )}

      {answered && reportUrl && (
        <a
          href={reportUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center self-start text-sm text-zinc-600 underline dark:text-zinc-400"
        >
          この問題の誤りを報告する
        </a>
      )}
    </div>
  );
}
