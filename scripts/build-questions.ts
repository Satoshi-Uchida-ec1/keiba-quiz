// data/questions/*.json（原本）を検証し、published の問題だけを public/questions/ に書き出す。
// --include-drafts を付けると未確認の問題も unverified 付きで書き出す（npm run dev 専用）
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GENRE_IDS, type DeliveredQuestion, type SourceQuestion } from "../lib/types.ts";
import { toPublicQuestion, validateQuestionSet } from "../lib/quiz/validate.ts";

const SOURCE_DIR = join(process.cwd(), "data", "questions");
const OUTPUT_DIR = join(process.cwd(), "public", "questions");
const includeDrafts = process.argv.includes("--include-drafts");

function loadRawQuestions(): { raws: unknown[]; errors: string[] } {
  const raws: unknown[] = [];
  const errors: string[] = [];

  for (const file of readdirSync(SOURCE_DIR).filter((name) => name.endsWith(".json")).sort()) {
    try {
      const parsed: unknown = JSON.parse(readFileSync(join(SOURCE_DIR, file), "utf-8"));
      if (Array.isArray(parsed)) {
        raws.push(...parsed);
      } else {
        errors.push(`${file}: 最上位は問題の配列にする`);
      }
    } catch (error) {
      errors.push(`${file}: JSON として読めない（${error instanceof Error ? error.message : String(error)}）`);
    }
  }
  return { raws, errors };
}

const { raws, errors } = loadRawQuestions();
const { questions, issues } = validateQuestionSet(raws);

if (errors.length > 0 || issues.length > 0) {
  for (const error of errors) console.error(`✗ ${error}`);
  for (const issue of issues) console.error(`✗ ${issue.id} ${issue.field}: ${issue.message}`);
  console.error(`\n問題データにエラーが ${errors.length + issues.length} 件あります。`);
  process.exit(1);
}

rmSync(OUTPUT_DIR, { recursive: true, force: true });
mkdirSync(OUTPUT_DIR, { recursive: true });

const delivered = includeDrafts ? questions : questions.filter((q) => q.status === "published");

function toDelivered(question: SourceQuestion): DeliveredQuestion {
  const pub = toPublicQuestion(question);
  return question.status === "published" ? pub : { ...pub, unverified: true };
}

// 問題が0件のジャンルも空配列で出力し、クライアントの取得が 404 にならないようにする
for (const genre of GENRE_IDS) {
  const items = delivered.filter((q) => q.genre === genre).map(toDelivered);
  writeFileSync(join(OUTPUT_DIR, `genre-${genre}.json`), JSON.stringify(items));
}

const counts = { draft: 0, review: 0, published: 0 };
for (const q of questions) counts[q.status] += 1;
console.log(
  `✓ 問題データ ${questions.length} 問（draft ${counts.draft} / review ${counts.review} / published ${counts.published}）` +
    ` → 配信 ${delivered.length} 問を public/questions/ に出力` +
    (includeDrafts ? "（開発用：未確認の問題を含む）" : ""),
);
