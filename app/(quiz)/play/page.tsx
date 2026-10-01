import type { Metadata } from "next";
import { PlayLoader } from "@/components/quiz/PlayLoader";

export const metadata: Metadata = {
  title: "クイズ",
};

export default function PlayPage() {
  return <PlayLoader />;
}
