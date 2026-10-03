"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { parseSetRequest } from "@/lib/quiz/request";
import { PlayLoader } from "./PlayLoader";

export function SessionPage() {
  const searchParams = useSearchParams();
  // 条件が変わらない限り同じオブジェクトを渡し、PlayLoader が問題を読み直さないようにする
  const request = useMemo(() => parseSetRequest(searchParams), [searchParams]);
  return <PlayLoader request={request} />;
}
