import type { ProgressStore } from "../types.ts";
import { createIndexedDbStore } from "./indexeddb.ts";
import { createMemoryStore } from "./memory.ts";
import { summarizeAnswers } from "./summarize.ts";

// ストレージは容量超過やプライベートモードで失敗しうる。進捗が残らなくても出題は続けられるようにする（CLAUDE.md ルール5）
export function withFallback(store: ProgressStore): ProgressStore {
  return {
    async load() {
      try {
        return await store.load();
      } catch {
        return summarizeAnswers([]);
      }
    },
    async recordAnswer(record) {
      try {
        await store.recordAnswer(record);
      } catch {
        // 進捗が1問ぶん残らないだけで、出題は続けられる
      }
    },
  };
}

export async function openProgressStore(): Promise<ProgressStore> {
  try {
    return withFallback(await createIndexedDbStore());
  } catch {
    return withFallback(createMemoryStore());
  }
}
