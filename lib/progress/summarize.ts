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
