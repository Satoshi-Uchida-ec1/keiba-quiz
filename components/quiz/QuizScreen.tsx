"use client";

import { useEffect, useRef, useState } from "react";
import type { SessionAnswer } from "@/lib/types";
import type { PreparedQuestion } from "@/lib/quiz/shuffle";
import { ChoiceList } from "./ChoiceList";
import { QuestionArea } from "./QuestionArea";

interface QuizScreenProps {
  questions: PreparedQuestion[];
  onAnswer: (questionId: string, correct: boolean, durationMs: number) => void;
  onFinish: (answers: SessionAnswer[]) => void;
}

export function QuizScreen({ questions, onAnswer, onFinish }: QuizScreenProps) {
  const [index, setIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const isFirstRender = useRef(true);
  const shownAtRef = useRef(0);
  // 結果画面のために、このセットの回答を貯める。保存（onAnswer）とは別で、リロードで消えてよい
  const answersRef = useRef<SessionAnswer[]>([]);

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

  // 描画中に Date.now() を呼ばないため、表示時刻は effect で記録する
  useEffect(() => {
    shownAtRef.current = Date.now();
  }, [index]);

  function handleSelect(choiceIndex: number) {
    if (selectedIndex !== null) return;
    setSelectedIndex(choiceIndex);
    const correct = choiceIndex === prepared.answerIndex;
    const durationMs = Date.now() - shownAtRef.current;
    answersRef.current.push({ questionId: prepared.question.id, correct, durationMs });
    onAnswer(prepared.question.id, correct, durationMs);
  }

  function handleNext() {
    if (isLast) {
      onFinish(answersRef.current);
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
        onSelect={handleSelect}
        onNext={handleNext}
        nextLabel={isLast ? "おわる" : "次の問題へ"}
        nextRef={nextRef}
      />
    </main>
  );
}
