import type { Ref } from "react";

interface ChoiceListProps {
  choices: string[];
  answerIndex: number;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onNext: () => void;
  nextLabel: string;
  nextRef: Ref<HTMLButtonElement>;
}

type ChoiceState = "idle" | "correct" | "wrong" | "dimmed";

const STATE_STYLES: Record<ChoiceState, string> = {
  idle: "border-zinc-500 bg-white text-zinc-900 hover:bg-zinc-100 active:bg-zinc-200 dark:border-zinc-400 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800",
  correct: "border-green-700 bg-green-700 text-white",
  wrong: "border-red-700 bg-red-700 text-white",
  dimmed: "border-zinc-300 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400",
};

// 色だけに頼らず、正誤をアイコンと文字でも示す（WCAG 1.4.1）
const STATE_BADGES: Partial<Record<ChoiceState, string>> = {
  correct: "✓ 正解",
  wrong: "✗ あなたの回答",
};

function stateOf(index: number, answerIndex: number, selectedIndex: number | null): ChoiceState {
  if (selectedIndex === null) return "idle";
  if (index === answerIndex) return "correct";
  if (index === selectedIndex) return "wrong";
  return "dimmed";
}

export function ChoiceList({
  choices,
  answerIndex,
  selectedIndex,
  onSelect,
  onNext,
  nextLabel,
  nextRef,
}: ChoiceListProps) {
  const answered = selectedIndex !== null;

  return (
    <div className="flex flex-col gap-2 px-4 pb-4 pt-2">
      <ul className="flex flex-col gap-2" aria-label="選択肢">
        {choices.map((choice, index) => {
          const state = stateOf(index, answerIndex, selectedIndex);
          const badge = STATE_BADGES[state];
          return (
            <li key={choice}>
              <button
                type="button"
                onClick={() => onSelect(index)}
                disabled={answered}
                className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-left text-base font-medium ${STATE_STYLES[state]}`}
              >
                <span>{choice}</span>
                {badge && <span className="shrink-0 text-sm font-bold">{badge}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {/* 回答前から場所を確保しておき、ボタンの出現で選択肢が押し上げられないようにする */}
      <button
        ref={nextRef}
        type="button"
        onClick={onNext}
        className={`min-h-12 w-full rounded-xl bg-zinc-900 px-4 py-3 text-base font-bold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 ${answered ? "" : "invisible"}`}
      >
        {nextLabel}
      </button>
    </div>
  );
}
