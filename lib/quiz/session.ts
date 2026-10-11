import {
  DIFFICULTIES,
  type DeliveredQuestion,
  type Difficulty,
  type Progress,
  type QuestionSet,
  type SetRequest,
} from "../types.ts";
import { shuffle, type RandomSource } from "./shuffle.ts";

export const SET_SIZE = 10;

/** おまかせで各難易度から取る問題数。合計は SET_SIZE */
export const AUTO_QUOTA: Record<Difficulty, number> = { easy: 3, normal: 4, hard: 3 };

const ADJACENT: Record<Difficulty, readonly Difficulty[]> = {
  easy: ["normal"],
  normal: ["easy", "hard"],
  hard: ["normal"],
};

/** 補充の段。上の段から順に、limit 問まで取る */
interface Tier {
  match: (question: DeliveredQuestion) => boolean;
  limit: number;
}

function tiersFor({ genre, difficulty }: SetRequest): Tier[] {
  const inGenre = (q: DeliveredQuestion) => genre === "all" || q.genre === genre;
  const sameGenre: Tier = { match: inGenre, limit: SET_SIZE };
  const anyGenre: Tier = { match: () => true, limit: SET_SIZE };

  if (difficulty === "auto") {
    const quotas = DIFFICULTIES.map((d) => ({
      match: (q: DeliveredQuestion) => inGenre(q) && q.difficulty === d,
      limit: AUTO_QUOTA[d],
    }));
    return [...quotas, sameGenre, anyGenre];
  }
  return [
    { match: (q) => inGenre(q) && q.difficulty === difficulty, limit: SET_SIZE },
    { match: (q) => inGenre(q) && ADJACENT[difficulty].includes(q.difficulty), limit: SET_SIZE },
    sameGenre,
    anyGenre,
  ];
}

function arrange(questions: DeliveredQuestion[], request: SetRequest, random: RandomSource) {
  const shuffled = shuffle(questions, random);
  if (request.difficulty !== "auto") return shuffled;
  // 初心者が序盤でつまずかないよう、おまかせは易しい順に出す（sort は安定なので同じ難易度内はランダムのまま）
  return shuffled.sort((a, b) => DIFFICULTIES.indexOf(a.difficulty) - DIFFICULTIES.indexOf(b.difficulty));
}

export function buildSet(
  pool: readonly DeliveredQuestion[],
  request: SetRequest,
  progress: Progress,
  random: RandomSource = Math.random,
): QuestionSet {
  const recent = new Set(progress.recentIds);
  const picked: DeliveredQuestion[] = [];
  const pickedIds = new Set<string>();
  const add = (question: DeliveredQuestion) => {
    picked.push(question);
    pickedIds.add(question.id);
  };

  for (const tier of tiersFor(request)) {
    const room = Math.min(tier.limit, SET_SIZE - picked.length);
    if (room <= 0) continue;
    const candidates = pool.filter((q) => tier.match(q) && !pickedIds.has(q.id) && !recent.has(q.id));
    const unseen = candidates.filter((q) => !progress.answeredIds.has(q.id));
    const seen = candidates.filter((q) => progress.answeredIds.has(q.id));
    [...shuffle(unseen, random), ...shuffle(seen, random)].slice(0, room).forEach(add);
  }

  const byId = new Map(pool.map((q) => [q.id, q]));
  for (const id of progress.recentIds) {
    if (picked.length >= SET_SIZE) break;
    const question = byId.get(id);
    if (question && !pickedIds.has(id)) add(question);
  }

  return {
    questions: arrange(picked, request, random),
    usedOtherGenres: request.genre !== "all" && picked.some((q) => q.genre !== request.genre),
  };
}
