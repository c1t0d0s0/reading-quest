# Reading Quest

小学 1〜6 年生が、長い文章を読んで 4 択の問題に答え、長文読解に慣れていく Web アプリです。
サーバーは不要で、ビルドした静的ファイルを置くだけで動きます。

- 学年は 1〜6 年。ホームでえらぶと、その学年が次からも出る (ほかの学年の文章も「文章の一覧」から読める)
- 文章は全部で 192 (各学年 32)、問題は 926 問。青空文庫の作品 (著作権の切れたもの) と、このアプリのために書いた物語・説明文
- 1 つの文章に 5 問 (1・2 年は 3〜5 問)。答えると、赤ペンのまるやばつ、解説、本文の「手がかり」の部分に黄色のマーカーが出る
- 今日のチャレンジ: 学年ごとに、日本時間の日付から毎日 1 つ。その学年の文章を全部出しきるまで (32 日) 同じ文章は出ない。同じ日・同じ学年なら、だれが開いても同じ文章
- 選択肢の順番は、読み直すたびに変わる (答えの位置をおぼえてしまわないように)
- 本文は、国語のテストと同じく縦書きで出す (横書きにも切りかえられ、えらんだ向きはその端末で覚えておく)。問題と選択肢は横書き。文字の大きさも変えられる
- 広い画面では本文と問題を左右にならべる。縦書きのときは本文が右、問題が左 (テスト用紙と同じ)
- きろく: 問題のタイプ (内容・理由・気持ち・言葉の意味・指示語・つなぎ言葉・要旨・組み立て・表現) ごとの正答率と、にがてなタイプ。ホームの「おすすめ」は、まだ読んでいない文章から、にがてなタイプの問題がある文章をえらぶ
- スタンプカードと、Reading Quest でしか手に入らないヤマネコのカード (20 種類)
- 記録はブラウザ (localStorage) に保存。Google でログインすると Firestore に保存され、ほかのブラウザや端末でも同じ記録で続けられる (ログインは任意)

## 使い方

```sh
npm install
npm run dev       # 開発サーバー
npm test          # テスト (文章と問題の検査をふくむ)
npm run build     # dist/ に静的ファイルを出力
npm run preview   # ビルド結果の確認
npm run passages  # content/ の文章から src/data/passages/*.json を作り直す
```

## スタンプ・ポイント・ヤマネコカード

- 文章を読み終えると、正解 1 問につき 4pt (5 問全部で 20pt)。その文章をはじめて読んだときだけ (読み直しても増えない)
- 今日のチャレンジを読み終えると、点数に関係なくスタンプが 1 個と 20pt (1 日 1 回。学年を変えても 1 日 1 個)
- 7 日連続するたびに 1000pt (とぎれたら数え直し)
- その月の 1 日から末日まで全部そろうと、さらに 5000pt (月ごとに数える)
- カードは 40pt から 3000pt までの 20 枚で、合計 28,420pt (Wordlynx と同じ値段の並び)。持っていないカードは裏向きで、必要な pt だけが見える
  - 今日のチャレンジを毎日する人は、全部まちがえても、はじめの 5 枚を 2 週間以内に手に入れられる
  - 全部集めるには、少なくとも 3 か月の連続がいる
  - 値段を変えるときは、`tests/rewards.test.ts` の「カードの値段のバランス」が通ることを確かめる

ポイントは合計を保存せず、スタンプの日付と、文章ごとの「はじめて読んだときの正解の数」から毎回計算します (`src/core/rewards.ts`)。
カードの種類と値段は `src/data/cards.ts`、絵柄の部品は `src/ui/lynx.ts` にあります。カードの id (`rq01`〜`rq20`) は Wordlynx のカードとはちがいます。

### カードのデザインを確認するページ

`npm run dev` を実行して `http://localhost:5173/cards.html` を開くと、全部のカードの表と裏面を一覧できます。
このページは開発用で、`npm run build` の出力には入りません。遊ぶ人の記録は読みも書きもしません。

記録は端末のブラウザごとに保存されます (ログインしない場合)。ブラウザのデータを消すと、スタンプもカードも消えます。
日付は端末の時計 (日本時間に換算) で決まります。

## 文章を足す

文章は `content/g1/`〜`content/g6/` に、1 つの文章を 1 つのファイルで書きます。
`npm run passages` で `src/data/passages/` の JSON (ふりがな付き) を作り直し、`npm test` で検査します。
JSON を作り直し忘れると、テストが失敗します。

```
id: g4-gon-1
title: ごん狐（一）
author: 新美南吉
source: aozora
url: https://www.aozora.gr.jp/cards/000121/card628.html
genre: story
series: gon 1/3
---
これは、{私|わたし}が小さいときに、村の{茂平|もへい}というおじいさんからきいたお話です。
（本文。1 行が 1 段落。見出しは「## 一」）
---
? content
ごんは、どんなきつねでしたか。
- 村の人たちと仲よしの、やさしいきつね
* ひとりぼっちで、いたずらばかりする小ぎつね
- 家族といっしょに森でくらす、おとなのきつね
- 中山さまのお城でかわれている、かしこいきつね
> ごんは、一人ぼっちの小狐で
= 本文に「ごんは、一人ぼっちの小狐で」「いたずらばかりしました」と書いてあります。
```

ヘッダーには、ほかに `note:` (外字を直したことなど、画面に出す注記) と `ruby:` (その文章だけで使う読み。`鰻=うなぎ, 菜種殻=なたねがら`) を書けます。

- `id` は `g学年-英小文字と数字`。いちど公開した id は変えない (記録が id にひもづいている)
- `source` は `aozora` (青空文庫。`url` に図書カードの URL) か `original` (このアプリのために書いたもの。`author: Reading Quest`)
- `genre` は `story` (物語)、`explain` (説明文)、`essay` (随筆)、`folktale` (昔話)、`poem` (詩)、`biography` (伝記)
- 長い作品は分けて `series: 名前 回/全部の回数` を付ける。今日のチャレンジでは 1 回目から順に、つづけて出る
- 問題は `? タイプ` (`content`, `reason`, `feeling`, `vocab`, `reference`, `connective`, `main-idea`, `structure`, `expression`)、問題文、選択肢 4 つ (正解は `*`)、`>` 手がかり (本文の 1 つの段落にそのまま出てくる文字)、`=` 解説
- 選択肢は、正解だけが長かったり短かったりしないようにする。テストは、学年ごとに「正解がいちばん長い問題」「正解がいちばん短い問題」がそれぞれ 35% 以下であることを確かめる

### ふりがな

- その学年でまだ習わない漢字には、`npm run passages` が自動でふりがなを付ける (形態素解析は kuromoji)。配当漢字は `src/data/kanji.ts`
- 原文のふりがなは `{漢字|かんじ}` と書く。自動の読みがまちがうときや読めないときは、その文章のヘッダーの `ruby:` か、どの文章でも使う `content/readings.txt` に「漢字=よみ」と書く (送りがなをふくめてもよい: `据って=すわって`)
- 読めない漢字があると `npm run passages` が警告を出し、テストも失敗する

### 長さのめやす (テストで確かめる)

| 学年 | 本文の字数 |
|---|---|
| 1 年 | 250〜850 |
| 2 年 | 400〜1,100 |
| 3 年 | 700〜1,650 |
| 4 年 | 1,000〜2,200 |
| 5 年 | 1,300〜2,900 |
| 6 年 | 1,600〜3,900 |

### 青空文庫の作品を使うとき

1. 著作権が切れているか確かめる。図書カードの「作品データ」に**「著作権存続」と書かれていない**こと (作者が 1967 年以前に亡くなっている作品だけが対象)。翻訳作品は、翻訳者の著作権も切れていること
2. 新字新仮名の版をえらぶ
3. 下書きを作る:

   ```sh
   npm run aozora -- https://www.aozora.gr.jp/cards/000121/card628.html > draft.txt
   ```

   ふりがなは `{漢字|かんじ}`、見出しは `## 一` の形になります。外字 (画像の字) は `※〔…〕` のまま残るので、手で常用漢字に直し、`note:` に書きます
4. 学年に合わせて抜き出し、長ければ `series` で分ける。原文の言葉は変えない (外字を直すときと、今では使わない差別的な言葉を言いかえるときだけ。そのときは `note:` に書く)
5. 子どもに向かない内容 (残酷な場面がおもな作品、大人向けの恋愛など) は使わない

画面では、本文の下に「出典: 作者『作品名』(青空文庫)」と図書カードへのリンクを出します。

## 公開 (GitHub Pages)

`main` ブランチに push すると、GitHub Actions (`.github/workflows/deploy.yml`) がテストとビルドを行い、
GitHub Pages に公開します。テストが失敗したときは公開されません。

はじめに一度だけ、GitHub のリポジトリで Settings → Pages → Build and deployment の
Source を「GitHub Actions」にしておきます。

## ログインと記録の保存 (Firebase)

Google でログインした人の記録は Firebase の Firestore に保存し、どのブラウザでも同じ記録で続けられます。
ログインしない人は、そのブラウザの localStorage だけに保存します。
**Firebase の設定を入れていないビルドでは、ログインの入り口は出ず、Firebase のコードも読みこまれません。**

Wordlynx と同じ Firebase プロジェクトを使えます。保存先は `users/{uid}/apps/reading-quest` で、Wordlynx の記録 (`apps/wordlynx`) とはまざりません。

### 仕組み

- 画面はいつも手元 (localStorage) の記録を読み書きする (`src/core/storage.ts`)
- ログイン中は、手元の記録を「Firestore の写し」としてあつかい、書きかわった分を少しまとめてから Firestore に送る (`src/cloud/sync.ts`)
- ログインしたとき・ページを開いたときは、Firestore の記録と手元の写しを**合わせて**、両方に書く
- 合わせ方は `src/core/merge.ts` に 1 つにまとめてある。何回合わせても同じ結果になるので、2 台で別々に読んでも、
  通信に失敗してやり直しても、記録が消えたり二重にふえたりしない

  | 記録 | 合わせ方 |
  |---|---|
  | スタンプの日付、今日のチャレンジを終えた日 | 両方を合わせた集合 |
  | はじめて読んだときの正解の数 (ポイントのもと) | 文章ごとに、少ないほう (ポイントが二重にふえない) |
  | 持っているカード | 両方を合わせる (同じカードは払った額の小さいほう) |
  | 文章ごとの答え | 読み直した回数の多いほう。同じ回なら、終わっているほう、答えの多いほう |
  | 学年・音 | あとから変えたほう |

- 手元の記録は人ごとに分ける。ログインなしの記録は `readingquest:v1:…`、ログイン中の人の写しは `readingquest:u:<uid>:…`。
  **ログアウトすると、その人の写しは端末から消す** (きょうだいで 1 台を使っても、記録がまざらない)
- ログインしたとき、その端末にログインなしの記録があれば、アカウントにうつすかどうかを聞く。
  うつした記録は端末のログインなしの場所から消す (二重にうつらないように)
- 通信できないときも手元の写しで続けられ、つながったときに送る

### Firestore の形 (小学生向けの学習アプリで共通)

Wordlynx と同じ形です。型は `src/core/snapshot.ts` にあります。

```
users/{uid}                                   その人の情報 (全アプリ共通)
  schema: 1, createdAt, updatedAt             ※ 名前・メールアドレス・写真は保存しない

users/{uid}/apps/reading-quest                アプリごとの記録のまとめ
  schema: 1, updatedAt
  activeDays: string[]                        スタンプを押した日
  completed:  string[]                        今日のチャレンジを終えた日 (daily-YYYY-MM-DD)
  inventory:  { [cardId]: { paid: number } }  ヤマネコカード
  spent:      { [key]: number }               使ったポイント (カードの値下げの差額の調整)
  settings:   { grade, sound, at }            学年と音
  scores:     { [passageId]: number }         はじめて読んだときの正解の数

users/{uid}/apps/reading-quest/progress/{passageId}   文章 1 つごとの答え
  schema: 1, updatedAt
  status: "playing" | "done"
  data: { answers, ok, tries }                えらんだ選択肢、正解だったか、何回目か
```

ポイントの残高は保存しません。読み書きできるのはログインしている本人だけです (`firestore.rules`)。

### Firebase の準備

1. [Firebase コンソール](https://console.firebase.google.com/) でプロジェクトを作り、ウェブアプリを登録する (Wordlynx と同じプロジェクトでよい)
2. Authentication → ログイン方法 で **Google** を有効にする。設定 → 承認済みドメイン に、公開先のドメインを足す
3. Firestore Database を作り、ルールに `firestore.rules` の内容を設定する
4. ウェブアプリの設定値のうち 4 つを入れる
   - 手元: `config.js` に書く (`config.example.js` をコピー)

     ```js
     const FIREBASE_API_KEY = '…';
     const FIREBASE_AUTH_DOMAIN = '….firebaseapp.com';
     const FIREBASE_PROJECT_ID = '…';
     const FIREBASE_APP_ID = '…';
     ```

   - GitHub Pages: リポジトリの Settings → Secrets and variables → Actions → Variables に、同じ 4 つの名前で登録する

   環境変数があればそれを使い、なければ `config.js` の値を使います。4 つのうち一部だけを入れると、ビルドがエラーになります。
   これらの値は公開されてもよいものです (記録を守るのはルールのほうです)。

### ログインできないとき

ログインに失敗すると、ボタンの下に「ログインできませんでした。(auth/…)」と、Firebase のエラーの名前が出ます。

| エラーの名前 | 原因 | 直し方 |
|---|---|---|
| `auth/configuration-not-found` | そのプロジェクトで Authentication がまだ始まっていない | Firebase コンソール → Authentication → 「始める」をおし、ログイン方法で Google を有効にする |
| `auth/operation-not-allowed` | Google でのログインが有効になっていない | Authentication → ログイン方法 → Google を有効にして保存する |
| `auth/unauthorized-domain` | 開いているサイトのドメインが登録されていない | Authentication → 設定 → 承認済みドメイン に、公開先のドメイン (手元なら `localhost`) を足す |
| `auth/popup-blocked` | ブラウザがログインの画面 (ポップアップ) を止めた | ブラウザでこのサイトのポップアップをゆるす |
| `auth/invalid-api-key` など | 設定値がまちがっている | 4 つの値を、コンソールの「ウェブアプリの設定」からコピーし直す |

### 知っておくこと

- 13 歳未満の子どもの Google アカウントは、保護者の管理 (ファミリー リンク) が前提です。保護者のアカウントでログインして使うこともできます
- 通信ができないままログインが切れた場合など、送れていなかった変更は失われることがあります

### エミュレーターで動かす (開発用)

本物の Firebase を使わずに、手元でログインと保存をためせます (Java が必要)。

```sh
npx firebase-tools emulators:start --only auth,firestore --project demo-reading-quest
FIREBASE_API_KEY=x FIREBASE_AUTH_DOMAIN=localhost FIREBASE_PROJECT_ID=demo-reading-quest FIREBASE_APP_ID=x FIREBASE_EMULATOR=1 npm run dev
```

## アクセス解析 (Google のタグ)

ID を設定したときだけ、Google のタグをページに埋め込みます。設定しなければ何も埋め込みません。
ID が `GTM-…` なら Google タグ マネージャー、`G-…` なら Google アナリティクス (gtag.js) のタグになります。

- 手元: `config.js` に `const GTM_ID = 'G-XXXXXXXXXX';` のように書く
- GitHub Pages: リポジトリの Variables に `GTM_ID` を登録する

## 構成

- `content/` 文章と問題 (人が書くもの)。`content/readings.txt` はふりがなの読みの指定
- `scripts/` 青空文庫からの下書き (`aozora.ts`)、文章の JSON への変換とふりがな付け (`build-passages.ts`, `passages-lib.ts`)
- `src/data/passages/` 変換した文章 (`index.json` は一覧、`g1.json`〜`g6.json` は本文と問題。学年ごとに必要になったときに読みこむ)
- `src/core/reading.ts` 文章と問題の型、ふりがなの書き方、選択肢の並べかえ、採点
- `src/core/daily.ts` 今日のチャレンジの文章のえらび方 (日付と学年だけで決まる)
- `src/core/stats.ts` 問題のタイプごとの正答率と、おすすめのえらび方
- `src/core/merge.ts`, `src/core/snapshot.ts` 記録を合わせる決まりと、Firestore に保存する形
- `src/ui/` ホーム、読む画面、文章の一覧、きろく、スタンプ、カード
- `src/cloud/` ログインと Firestore との同期 (Firebase に依存するのは `firebase.ts` だけ)
- `tests/` 文章と問題の検査、ふりがな、2 年分の今日のチャレンジ、ポイントとカード、記録の合わせ方と同期
