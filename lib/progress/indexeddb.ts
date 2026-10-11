import type { AnswerRecord, ProgressStore } from "../types.ts";
import { summarizeAnswers } from "./summarize.ts";

const DB_NAME = "keiba-quiz";
// ストアを足すときはバージョンを上げ、onupgradeneeded に既存データの移行を書く（data-schema.md）
const DB_VERSION = 1;
const ANSWERS = "answers";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ANSWERS)) {
        db.createObjectStore(ANSWERS, { autoIncrement: true }).createIndex("answeredAt", "answeredAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("別のタブが古いバージョンの DB を開いている"));
  });
}

export async function createIndexedDbStore(): Promise<ProgressStore> {
  if (typeof indexedDB === "undefined") throw new Error("IndexedDB を使えない環境");
  const db = await openDatabase();

  return {
    load() {
      return new Promise((resolve, reject) => {
        const request = db.transaction(ANSWERS, "readonly").objectStore(ANSWERS).index("answeredAt").getAll();
        request.onsuccess = () => {
          const records: AnswerRecord[] = request.result;
          resolve(summarizeAnswers(records));
        };
        request.onerror = () => reject(request.error);
      });
    },
    recordAnswer(record) {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(ANSWERS, "readwrite");
        transaction.objectStore(ANSWERS).add(record);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    },
  };
}
