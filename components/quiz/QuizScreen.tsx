"use client";

import { useEffect, useRef, useState } from "react";
import type { PreparedQuestion } from "@/lib/quiz/shuffle";
import { ChoiceList } from "./ChoiceList";
import { QuestionArea } from "./QuestionArea";

interface QuizScreenProps {
  questions: PreparedQuestion[];
  onFinish: () => void;
}

export function QuizScreen({ questions, onFinish }: QuizScreenProps) {
  const [index, setIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const isFirstRender = useRef(true);

  const prepared = questions[index];
  const isLast = index === questions.length - 1;

  // 回答後はキーボードでそのまま次へ進めるようにし、次の問題ではスクリーンリーダーに問題文から読ませる
  useEffect(() => {
    if (selectedIndex !== null) nextRef.current?.focus();
  }, [selectedIndex]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [index]);

  function handleNext() {
    if (isLast) {
      onFinish();
      return;
    }
    setIndex(index + 1);
    setSelectedIndex(null);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col tall:h-dvh tall:min-h-0">
      <div className="flex-1 tall:min-h-0 tall:overflow-y-auto">
        <QuestionArea
          prepared={prepared}
          selectedIndex={selectedIndex}
          current={index + 1}
          total={questions.length}
          headingRef={headingRef}
        />
      </div>
      <ChoiceList
        choices={prepared.choices}
        answerIndex={prepared.answerIndex}
        selectedIndex={selectedIndex}
        onSelect={setSelectedIndex}
        onNext={handleNext}
        nextLabel={isLast ? "おわる" : "次の問題へ"}
        nextRef={nextRef}
      />
    </main>
  );
}
