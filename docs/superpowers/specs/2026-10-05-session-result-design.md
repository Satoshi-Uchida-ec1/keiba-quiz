# 設計: セッション結果画面（M-06 / P-06）

- 日付: 2026-10-05
- ブランチ: `feat/session-result`（`feat/select-screen` から分岐。`feat/select-screen` は PR 未提出）
- 状態: 本人承認済み（Q1・Q2・構成・設計案）・メンター合意待ち（spec.md 全体の合意も未）
- 対象: spec §2 の M-06、`screens.md` の P-06

## 1. 決めたこと

| # | 決定 | 理由 |
| --- | --- | --- |
| Q1 | 所要時間は「各問の回答時間（`durationMs`）の合計」。問題を表示してから回答するまでで、解説を読む時間は含まない | 解説を読むことが核なので、読んだぶん伸びる指標にしない。すでに計測している値で足りる。セット開始〜終了の経過時間は、離席で極端な値になる |
| Q2 | 間違えた問題の一覧は、問題文・正解の選択肢・要点解説（`explanationShort`）を常時表示する。「もっと詳しく」・誤答通報・自分が選んだ選択肢は出さない | 一覧からタップなしで要点まで読み返せる。選んだ選択肢は記録しておらず、保存項目を増やすと範囲が広がる。誤答通報は出題画面（M-11）にあり、導線が二重になる |
| — | 結果は `QuizScreen` が集め、`onFinish(results)` で渡す。集計は純関数 `summarizeSession` | 回答ごとの状態をすでに `QuizScreen` が持つ。純関数なので単体テストできる。`PlayLoader` の ref に貯める案は、「もう一度」でのリセットが要り出どころが2か所になる。IndexedDB から読み直す案は、非同期で、過去のセットの回答が混ざる |
| — | 結果は保存しない。リロードしたら結果画面は消える | U-16（途中離脱・リロードでセットを破棄）と同じ扱い |

## 2. 範囲

| 含める | 含めない（理由） |
| --- | --- |
| `QuizScreen` の `onFinish` に結果を渡す | 復習への導線（M-07。U-13 が未決） |
| `lib/quiz/result.ts`（`summarizeSession`）と単体テスト | 投げ銭リンク（S-09、フェーズ2。spec §2.2） |
| `ResultScreen`（`PlayLoader` の終了画面を置き換え） | 結果のシェア（S-02、フェーズ2） |
| 「もう一度」「条件を変える」（既存の導線を移す） | 結果の保存、成績の可視化（M-09） |

## 3. データ

`lib/types.ts` に追加:

```ts
/** 1問ぶんの結果。セット内でだけ使い、保存しない */
export interface SessionAnswer {
  questionId: string;
  correct: boolean;
  durationMs: number;
}

export interface MissedQuestion {
  question: DeliveredQuestion;
  /** シャッフル後の選択肢から取った、正解の文字 */
  correctChoice: string;
}

export interface SessionResult {
  total: number;
  correctCount: number;
  /** 各問の回答時間の合計 */
  totalDurationMs: number;
  /** 出題順 */
  missed: MissedQuestion[];
}
```

`lib/quiz/result.ts`:

- `summarizeSession(questions: PreparedQuestion[], answers: SessionAnswer[]): SessionResult`
- `total` は `questions.length`（10問未満のセットもありうるため、10 固定にしない）
- `missed` は `questions` の順にたどり、`answers` に不正解がある問題だけ入れる。`correctChoice` は `prepared.choices[prepared.answerIndex]`
- 回答のない問題（途中終了は起こらないが念のため）は、正解にも不正解にも数えず、`total` にだけ含める
- `formatDuration(ms: number): string`: 先に全体を秒へ四捨五入してから分と秒に分ける。1分未満は「23秒」、1分以上で端数がなければ「1分」、あれば「1分23秒」

## 4. 構成

| ファイル | 役割 |
| --- | --- |
| `lib/types.ts` | 上の型を追加 |
| `lib/quiz/result.ts`（新規） | `summarizeSession`・`formatDuration` |
| `components/quiz/QuizScreen.tsx` | 回答を `useRef` で貯め、最後の「おわる」で `onFinish(answers)` を呼ぶ。`onFinish: (answers: SessionAnswer[]) => void` に変える |
| `components/quiz/ResultScreen.tsx`（新規） | 結果画面 |
| `components/quiz/PlayLoader.tsx` | `finished` 状態に `SessionResult` を持たせ、`ResultScreen` を表示。「もう一度」の処理はここに残す。終了画面の記述を `ResultScreen` へ移して短くする |

## 5. 画面 `ResultScreen`

- 見出し（`h1`）: 「10問中7問正解」。表示時にフォーカスを移す（出題画面と同じ。スクリーンリーダーに結果から読ませる）
- 所要時間: 「回答にかかった時間 1分23秒」
- 間違えた問題（`ol`、出題順）。各項目は次の順:
  1. 問題文
  2. 「✗ 正解: ○○」（アイコン＋文字。色だけに頼らない）
  3. 要点解説
  4. 開発サーバーでは「未確認の下書き」バッジ（出題画面と同じ）
- 全問正解のときは、一覧の代わりに「全問正解！」を出す
- 「もう一度」（主ボタン）と「条件を変える」（`/play` へのリンク）を画面下に固定する。選択画面の「始める」と同じ作りで、一覧が長くなっても押せる
- 縦スクロールを許容する。横スクロールは出さない。タッチターゲットは 44px 以上、ボタンは 48px 以上
- 投げ銭・広告・トラッキングは置かない（CLAUDE.md の固有ルール 2）

## 6. テスト

`lib/quiz/result.test.ts`:

- 全問正解（`missed` が空、`correctCount` が `total`）
- 全問不正解
- 一部不正解（`missed` が出題順で、正解の選択肢の文字がシャッフル後の位置から取れている）
- 回答時間の合計
- 10問未満のセット（`total` が出題数）
- `formatDuration`: 0ms →「0秒」、59,400ms →「59秒」、59,500ms →「1分」、60,000ms →「1分」、83,000ms →「1分23秒」

コンポーネントのテストは作らない（Vitest は node 環境で DOM がなく、新しい依存パッケージも入れない）。

## 7. ブラウザでの確認（375×667 を含む）

下書き10問（easy 5・normal 5）を使う。

1. 全問正解 → 「10問中10問正解」「全問正解！」、一覧なし
2. 数問をわざと間違える → 間違えた問題が出題順に並び、正解・解説が正しい（問題データと突き合わせる）
3. 所要時間が、回答にかけた時間の体感と近く、解説を読んだ時間で伸びていない
4. 「もう一度」が同じ条件で新しいセットを始め、「条件を変える」で `/play` に戻る
5. 375×667 で横スクロールなし。ボタンが画面下に固定で、一覧が長くても押せる
6. キーボードだけで、結果の確認から「もう一度」まで操作できる。表示時にフォーカスが見出しにある
7. 結果画面でリロードすると、選択画面ではなく新しいセットの出題に戻る（`/play/session` の URL のまま）。結果は消える
8. コンソールエラーなし。`npm run build` が通る

## 8. 一緒に直すドキュメント

- `docs/spec.md`: §2 の M-06 の状態を更新。§3 に結果画面の節（所要時間の定義、一覧の内容、含めないもの）を足す。§3 の P-03 の節にある「結果画面 M-06 は別機能」の一文を直す
- `docs/screens.md`: P-06 の行に、今回作る範囲（復習導線・投げ銭は後）を追記
- `docs/worklog/2026-10-05.md`（新規）
