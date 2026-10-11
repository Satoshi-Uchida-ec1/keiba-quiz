import Link from "next/link";
import { SITE_DESCRIPTION, SITE_NAME, SITE_NOTE } from "@/lib/site";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <div className="flex flex-1 flex-col justify-center gap-4 px-4 py-6">
        <h1 className="text-3xl font-bold">{SITE_NAME}</h1>
        <p className="text-lg">{SITE_DESCRIPTION}</p>
        <p className="text-base text-zinc-700 dark:text-zinc-300">{SITE_NOTE}</p>
      </div>
      {/* 選択画面と同じく、親指の届く位置に置く */}
      <div className="px-4 pb-6">
        <Link
          href="/play"
          className="flex min-h-12 w-full items-center justify-center rounded-xl bg-zinc-900 px-4 py-3 text-base font-bold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          今すぐ遊ぶ
        </Link>
      </div>
    </main>
  );
}
