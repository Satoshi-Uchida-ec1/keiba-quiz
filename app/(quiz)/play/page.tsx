import type { Metadata } from "next";
import { SelectScreen } from "@/components/quiz/SelectScreen";

export const metadata: Metadata = {
  title: "ジャンル・難易度を選ぶ",
};

export default function SelectPage() {
  return <SelectScreen />;
}
