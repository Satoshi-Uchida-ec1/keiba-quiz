"use client";

import Link from "next/link";
import { useState } from "react";
import { DIFFICULTIES, GENRE_IDS, type DifficultyChoice, type GenreChoice } from "@/lib/types";
import { DIFFICULTY_LABELS, GENRE_LABELS } from "@/lib/quiz/labels";
import { DEFAULT_REQUEST, toQuery } from "@/lib/quiz/request";

interface Option<T extends string | number> {
  value: T;
  label: string;
}

const GENRE_OPTIONS: Option<GenreChoice>[] = [
  { value: "all", label: "全ジャンル" },
  ...GENRE_IDS.map((id) => ({ value: id, label: GENRE_LABELS[id] })),
];

const DIFFICULTY_OPTIONS: Option<DifficultyChoice>[] = [
  ...DIFFICULTIES.map((difficulty) => ({ value: difficulty, label: DIFFICULTY_LABELS[difficulty] })),
  { value: "auto", label: "おまかせ" },
];

const UNCHECKED =
  "border-zinc-500 bg-white text-zinc-900 hover:bg-zinc-100 dark:border-zinc-400 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800";
const CHECKED = "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900";

interface OptionGroupProps<T extends string | number> {
  name: string;
  legend: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  columns: 1 | 2;
}

// ラジオボタンを隠して見た目だけ作る。選択中は色に加えて ✓ でも示す（WCAG 1.4.1）
function OptionGroup<T extends string | number>({ name, legend, options, value, onChange, columns }: OptionGroupProps<T>) {
  return (
    <fieldset>
      <legend className="mb-2 text-lg font-bold">{legend}</legend>
      <div className={`grid gap-2 ${columns === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <label key={option.value} className="block">
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="peer sr-only"
              />
              <span
                className={`flex min-h-12 items-center gap-2 rounded-xl border-2 px-4 py-3 text-base font-medium peer-focus-visible:outline-4 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-700 dark:peer-focus-visible:outline-blue-300 ${checked ? CHECKED : UNCHECKED}`}
              >
                <span aria-hidden="true" className="w-4 shrink-0 font-bold">
                  {checked ? "✓" : ""}
                </span>
                {option.label}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function SelectScreen() {
  const [genre, setGenre] = useState<GenreChoice>(DEFAULT_REQUEST.genre);
  const [difficulty, setDifficulty] = useState<DifficultyChoice>(DEFAULT_REQUEST.difficulty);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <div className="flex flex-1 flex-col gap-6 px-4 pb-4 pt-6">
        <h1 className="text-xl font-bold">ジャンルと難易度を選ぶ</h1>
        <OptionGroup name="genre" legend="ジャンル" options={GENRE_OPTIONS} value={genre} onChange={setGenre} columns={1} />
        <OptionGroup
          name="difficulty"
          legend="難易度"
          options={DIFFICULTY_OPTIONS}
          value={difficulty}
          onChange={setDifficulty}
          columns={2}
        />
      </div>
      {/* 画面が縦に収まらなくても、親指の届く位置から始められるようにする */}
      <div className="sticky bottom-0 border-t border-zinc-300 bg-background px-4 py-3 dark:border-zinc-700">
        <Link
          href={`/play/session?${toQuery({ genre, difficulty })}`}
          className="flex min-h-12 w-full items-center justify-center rounded-xl bg-zinc-900 px-4 py-3 text-base font-bold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          始める
        </Link>
      </div>
    </main>
  );
}
