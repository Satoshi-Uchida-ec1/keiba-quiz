import {
  DIFFICULTIES,
  type DeliveredQuestion,
  type Difficulty,
  type GenreChoice,
  type Progress,
  type QuestionSet,
  type ReviewCandidates,
  type SetRequest,
} from "../types.ts";
import { shuffle, type RandomSource } from "./shuffle.ts";

export const SET_SIZE = 10;

/** おまかせで各難易度から取る問題数。合計は SET_SIZE */
export const AUTO_QUOTA: Record<Difficulty, number> = { easy: 3, normal: 4, hard: 3 };

/** 1セットに混ぜる復習問題の上限（spec §4 手順3） */
export const REVIEW_MAX = 3;

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

const matchesGenre = (genre: GenreChoice, question: DeliveredQuestion) =>
  genre === "all" || question.genre === genre;

/** 復習問題を選ぶ。箱1を先に、足りなければ箱2から。選んだジャンルの外からは選ばない（U-13） */
function pickReview(
  byId: ReadonlyMap<string, DeliveredQuestion>,
  genre: GenreChoice,
  review: ReviewCandidates,
  random: RandomSource,
): DeliveredQuestion[] {
  // 問題データにない ID（削除・非公開・欠番）は捨てる（data-schema.md）
  const usable = (ids: readonly string[]) =>
    ids.flatMap((id) => {
      const question = byId.get(id);
      return question && matchesGenre(genre, question) ? [question] : [];
    });
  return [...shuffle(usable(review.box1), random), ...shuffle(usable(review.box2), random)].slice(0, REVIEW_MAX);
}

function tiersFor({ genre, difficulty }: SetRequest): Tier[] {
  const inGenre = (q: DeliveredQuestion) => matchesGenre(genre, q);
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
  const byId = new Map(pool.map((q) => [q.id, q]));
  const recent = new Set(progress.recentIds);
  const picked: DeliveredQuestion[] = [];
  const pickedIds = new Set<string>();
  const add = (question: DeliveredQuestion) => {
    picked.push(question);
    pickedIds.add(question.id);
  };

  // 復習は直近30問の除外を受けない。間違えた問題は直近30問に入っているので、受けると戻れない（spec §4 手順3）
  pickReview(byId, request.genre, progress.review, random).forEach(add);

  for (const tier of tiersFor(request)) {
    // 復習で選んだ問題もその段の枠に数える。数えないと、おまかせで復習が入るたびに最後の段が削られて偏る
    const room = Math.min(tier.limit - picked.filter(tier.match).length, SET_SIZE - picked.length);
    if (room <= 0) continue;
    const candidates = pool.filter((q) => tier.match(q) && !pickedIds.has(q.id) && !recent.has(q.id));
    const unseen = candidates.filter((q) => !progress.answeredIds.has(q.id));
    const seen = candidates.filter((q) => progress.answeredIds.has(q.id));
    [...shuffle(unseen, random), ...shuffle(seen, random)].slice(0, room).forEach(add);
  }

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
