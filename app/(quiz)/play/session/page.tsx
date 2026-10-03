import type { Metadata } from "next";
import { Suspense } from "react";
import { SessionPage } from "@/components/quiz/SessionPage";

export const metadata: Metadata = {
  title: "クイズ",
};

// 静的出力のビルドでは、useSearchParams を使うページを Suspense で囲まないと失敗する（Next.js 16 のドキュメント）
export default function PlaySessionPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-dvh w-full max-w-md items-center justify-center px-4 text-center">
          <p role="status">問題を読み込んでいます…</p>
        </main>
      }
    >
      <SessionPage />
    </Suspense>
  );
}
