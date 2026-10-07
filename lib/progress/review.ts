import type { AnswerRecord, ReviewCandidates } from "../types.ts";

/** 箱2の問題が候補に戻るまでに、ほかの問題へ回答する数（U-13）。直近30問（RECENT_LIMIT）とは別の意味なので別の定数にする */
export const REVIEW_INTERVAL = 30;

type BoxState = { box: 1 } | { box: 2; correctAt: number };

/** records は古い順 */
export function computeReviewCandidates(records: readonly AnswerRecord[]): ReviewCandidates {
  const states = new Map<string, BoxState>();
  records.forEach((record, index) => {
    const state = states.get(record.questionId);
    if (!record.correct) states.set(record.questionId, { box: 1 });
    else if (state?.box === 1) states.set(record.questionId, { box: 2, correctAt: index });
    else if (state?.box === 2) states.delete(record.questionId);
  });

  const box1: string[] = [];
  const box2: string[] = [];
  for (const [questionId, state] of states) {
    if (state.box === 1) box1.push(questionId);
    // 箱2の問題は最後の正解のあとに自分では回答されていない（されると状態が変わる）ので、そのあとの回答はすべてほかの問題
    else if (records.length - 1 - state.correctAt >= REVIEW_INTERVAL) box2.push(questionId);
  }
  return { box1, box2 };
}
