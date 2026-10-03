import type { AnswerRecord, ProgressStore } from "../types.ts";
import { summarizeAnswers } from "./summarize.ts";

export function createMemoryStore(initial: readonly AnswerRecord[] = []): ProgressStore {
  const records = [...initial];
  return {
    async load() {
      return summarizeAnswers(records);
    },
    async recordAnswer(record) {
      records.push(record);
    },
  };
}
