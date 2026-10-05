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
