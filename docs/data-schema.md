# データ設計

## 問題データ（questions）

MVPでは静的JSONとして配信する。1ファイルにまとめず、ジャンル単位で分割して必要な分だけ取得する。

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| id | string | ● | 一意ID。例 g2-0001 |
| genre | enum | ● | 1〜7のジャンルID（`content-rules.md` 参照） |
| difficulty | enum | ● | easy / normal / hard |
| question | string | ● | 問題文。原則60字以内 |
| choices | string[] | ● | 選択肢4つ。表示時にシャッフル |
| answerIndex | number | ● | 正解のインデックス |
| explanationShort | string | ● | 要点1〜2文。回答直後に常時表示 |
| explanationLong | string | | 詳細解説。折りたたみで展開 |
| tags | string[] | | 絞り込み・記事紐付け用 |
| source | string | ● | 事実確認に使った一次情報のメモ（内部管理用、非公開） |
| isTimeSensitive | boolean | ● | 時事問題フラグ |
| asOf | date | | 「〇年時点」の基準日 |
| updatedAt | date | ● | 最終更新日 |
| status | enum | ● | draft / review / published |
| relatedArticleId | string | | 紐づく解説記事 |
| imageRef | string | | 権利処理済み画像への参照。MVPでは未使用 |
| eloRating | number | | 適応型出題用。フェーズ2で使用 |

`source` は公開しない。誤答通報があったときに一次情報まで遡るための内部メモ。

### サンプル

```json
{
  "id": "g2-0002",
  "genre": 2,
  "difficulty": "normal",
  "question": "日本の中央競馬でグレード制が導入されたのは何年？",
  "choices": ["1974年", "1984年", "1994年", "2004年"],
  "answerIndex": 1,
  "explanationShort": "1984年にG1・G2・G3の格付けが導入された。",
  "explanationLong": "それ以前は八大競走という区分が使われていた。",
  "tags": ["グレード制", "競馬史"],
  "source": "（一次情報の確認元をここに記録）",
  "isTimeSensitive": false,
  "updatedAt": "2026-09-22",
  "status": "published"
}
```

## ユーザー進捗（ローカル保存）

MVPはアカウントを作らず IndexedDB に保存する。localStorage は容量と構造化データの扱いで不利なので、
進捗本体は IndexedDB、軽量な設定値のみ localStorage とする。

| キー | 内容 |
| --- | --- |
| answers | 問題IDごとの解答履歴（正誤、日時、所要時間） |
| reviewQueue | 復習キュー。問題IDとLeitnerのボックス番号 |
| stats | ジャンル別・難易度別の集計値（履歴から再計算可能なキャッシュ） |
| profile | 初期難易度設定、オンボーディング完了フラグ |
| settings | 音のON/OFF、タイマーのON/OFF |
| seenRecently | 直近に出題した問題IDのリングバッファ（重複回避用） |

データリセット機能を設定画面（P-11）に置き、いつでも全消去できるようにする。

ストレージ操作は必ず try/catch で囲むこと。プライベートモードや容量超過で失敗しうる。
取得できなかった場合も画面が壊れないようにする。

## 出題アルゴリズム（MVP）

1. 選択されたジャンル・難易度で候補を絞り込む
2. `reviewQueue` の問題を優先度高で混ぜる（1セット10問中、最大3問まで）
3. `seenRecently` に含まれる問題を除外する
4. 残りから重み付きランダムで選ぶ（未出題の問題の重みを高くする）
5. 候補が枯渇したら `seenRecently` の古いものから解放する

### フェーズ2：適応型出題

Elo方式の能力推定を加える。ユーザーの推定能力に近い難易度の問題を選ぶことで、退屈と挫折の両方を避ける。

事前キャリブレーションが不要なので、IRT（項目反応理論）より個人開発に向く。
有効化の閾値は、各問題に数十件の回答データが溜まった時点。それまでは手動の難易度タグで運用する。

## 解説記事（articles）

| フィールド | 説明 |
| --- | --- |
| id | 記事ID |
| title | タイトル |
| genre | 関連ジャンル |
| body | 本文（Markdown） |
| tags | 紐づく問題を引くためのタグ |
| publishedAt / updatedAt | 公開日・更新日 |

記事は静的生成し、クローラーがテキストを読める形で配信する。
これがAdSense審査とSEOの両方の前提になる。

## DB移行の判断基準

静的JSONで足りなくなる閾値は、問題数5,000問超、またはユーザー投稿を受け入れる判断をしたとき。
それまではJSON + CDNのほうが低コストで速い。
