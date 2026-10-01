import type { DeliveredQuestion } from "../types.ts";

export type RandomSource = () => number;

/** 出題用に選択肢を並べ替えた問題。answerIndex は並べ替え後の位置 */
export interface PreparedQuestion {
  question: DeliveredQuestion;
  choices: string[];
  answerIndex: number;
}

export function shuffle<T>(items: readonly T[], random: RandomSource = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function prepareQuestion(
  question: DeliveredQuestion,
  random: RandomSource = Math.random,
): PreparedQuestion {
  const order = shuffle(
    question.choices.map((_, index) => index),
    random,
  );
  return {
    question,
    choices: order.map((index) => question.choices[index]),
    answerIndex: order.indexOf(question.answerIndex),
  };
}
