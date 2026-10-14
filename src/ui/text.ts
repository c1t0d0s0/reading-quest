import type { Genre, Grade, QType } from '../core/reading';
import { DAILY_POINTS, MONTH_POINTS, POINTS_PER_CORRECT, WEEK_LENGTH, WEEK_POINTS } from '../core/rewards';

const pt = (n: number) => `${n.toLocaleString('ja-JP')}pt`;

/**
 * 画面の文言。1 年生も読むので、漢字は 2 年生までに習うものだけを使い、
 * 文節ごとに空白を入れる (分かち書き)。ふりがなは {漢字|かんじ} と書ける。
 */
export const T = {
  brand: 'Reading Quest',
  lead: 'お話や 説明文を 読んで、4つの 中から こたえを えらぼう。',
  gradeLabel: (g: Grade) => `${g}年生`,
  gradeTitle: '学年',
  gradeNote: 'えらんだ 学年の 文章が、今日の チャレンジに 出るよ。',
  gradeAsk: 'なん年生か えらんでね',

  daily: '今日の チャレンジ',
  dateLabel: (month: number, day: number, weekday: number) => `${month}月${day}日（${'日月火水木金土'[weekday]}）`,
  dailyNote: (done: boolean, run: number) =>
    done
      ? run > 1
        ? `おわったよ。${run}日 つづいているよ。`
        : 'おわったよ。あしたも 新しい 文章が 出るよ。'
      : run > 0
        ? `${run}日 つづけて チャレンジ中。今日も 読んでみよう。`
        : '毎日 1つ、新しい 文章が 出るよ。',
  start: 'はじめる',
  resume: 'つづきから',
  review: 'ふりかえる',
  again: 'もういちど 読む',

  recommendTitle: 'つぎに 読む 文章',
  recommendWeak: (type: string) => `「${type}」の 問題が 多い 文章だよ。`,
  recommendNext: 'つづきの お話だよ。',
  recommendAny: 'まだ 読んでいない 文章だよ。',
  recommendAllRead: 'この 学年の 文章は 全部 読んだよ。すごい！ほかの 学年の 文章も 読んでみよう。',
  libraryLink: '文章の 一らん',
  recordLink: 'きろく',

  genre: {
    story: 'ものがたり',
    folktale: 'むかし話',
    explain: '説明文',
    essay: 'ずいひつ',
    biography: '{伝記|でんき}',
    poem: '{詩|し}',
  } satisfies Record<Genre, string>,
  qtype: {
    content: '書いてある こと',
    reason: 'わけ',
    feeling: '気もち',
    reference: '「それ」が さすもの',
    vocab: '言葉の いみ',
    connective: 'つなぎ言葉',
    expression: 'たとえ・あらわし方',
    'main-idea': 'いちばん 言いたい こと',
    structure: 'じゅんじょ・組み立て',
  } satisfies Record<QType, string>,
  chars: (n: number) => `${n.toLocaleString('ja-JP')}字`,
  questions: (n: number) => `${n}問`,
  part: (part: number, total: number) => `${part}／${total}`,
  original: 'Reading Quest オリジナル',
  aozora: '青空文庫',
  sourceLabel: '出てん',

  // 一らん
  libraryTitle: '文章の 一らん',
  filterAll: 'すべて',
  filterUnread: 'まだ 読んでいない',
  filterRead: '読んだ',
  readCount: (read: number, total: number) => `読んだ 文章 ${read} / ${total}`,
  emptyList: 'あてはまる 文章は ありません。',
  statusNew: 'まだ',
  statusPlaying: 'とちゅう',
  statusDone: (correct: number, total: number) => `${correct}/${total}`,

  // 読む画面
  bodyTitle: '本文',
  questionsTitle: '問題',
  qnum: (n: number, total: number) => `問${n}／${total}`,
  correct: 'せいかい！',
  wrong: 'ざんねん',
  answerIs: (label: string) => `こたえは ${label}`,
  evidenceShow: '本文で たしかめる',
  explainTitle: 'かいせつ',
  progress: (answered: number, total: number) => `${answered} / ${total}問`,
  toQuestions: '問題へ すすむ',
  toBody: '本文に もどる',
  viewTate: 'たて書き',
  viewYoko: 'よこ書き',
  viewSize: '字の 大きさ',
  viewSizes: ['ふつう', '大きい', 'もっと大きい'],
  readFirst: '本文を さいごまで 読んでから、問題に こたえよう。こまったら、本文に もどって たしかめよう。',
  loading: '読みこみ中…',
  loadFailed: '文章を 読みこめませんでした。つうしんを たしかめて、もういちど ためしてね。',
  retry: 'もういちど ためす',
  notFound: 'その 文章は 見つかりませんでした。',
  previousPart: '前の 回',
  nextPart: 'つぎの 回を 読む',
  restartConfirm: 'こたえを 全部 けして、さいしょから 読みなおしますか？（ポイントは はじめの 1回だけ もらえます）',

  // おわったとき
  resultPerfect: 'ぜんもん せいかい！',
  resultGood: 'よく できました',
  resultTry: 'おつかれさま',
  resultScore: (correct: number, total: number) => `${total}問中 ${correct}問 せいかい`,
  resultAdvice: (correct: number, total: number) =>
    correct === total
      ? '本文を しっかり 読めているね。'
      : correct * 2 >= total
        ? 'まちがえた 問題は、本文の 黄色い ところを 読みなおしてみよう。'
        : 'あわてず、もういちど 本文を 読んでから ふりかえってみよう。',
  rewardCorrect: (n: number) => `せいかい ${n}問 ＋${pt(n * POINTS_PER_CORRECT)}`,
  rewardDaily: `今日の チャレンジ ＋${pt(DAILY_POINTS)}`,
  rewardWeek: (run: number) => `${run}日 つづいた！ ＋${pt(WEEK_POINTS)}`,
  rewardMonth: (month: number) => `${month}月の スタンプが 全部 そろった！ ＋${pt(MONTH_POINTS)}`,
  rewardNone: 'ポイントは はじめて 読んだ ときだけ もらえるよ。',
  stampDone: 'スタンプを おしたよ',
  seeAnswers: 'こたえを 見る',
  goHome: 'ホームに もどる',

  // スタンプ・ポイント・カード
  stampTitle: 'スタンプカード',
  stampMonth: (month: number) => `${month}月`,
  stampDayLabel: (day: number, stamped: boolean) => `${day}日${stamped ? ' スタンプ あり' : ''}`,
  stampRun: (run: number, left: number) =>
    run > 0 ? `${run}日 つづいているよ。あと ${left}日で ${pt(WEEK_POINTS)}。` : '今日の チャレンジを おえると、スタンプを 1こ おせるよ。',
  stampRule: `今日の チャレンジを おえると ${pt(DAILY_POINTS)}。文章を はじめて 読んだ ときは、せいかい 1問ごとに ${pt(POINTS_PER_CORRECT)}。今日の チャレンジを ${WEEK_LENGTH}日 つづけるたびに ${pt(WEEK_POINTS)}、1日から 月の さいごの 日まで 全部 そろうと、さらに ${pt(MONTH_POINTS)}。`,
  points: (n: number) => pt(n),
  pointsLabel: 'もっている ポイント',
  seeCards: 'カードを 見る',
  seeStamps: 'スタンプカードを 見る',
  rewardLinks: 'スタンプカードと ヤマネコカード',
  cardsTitle: 'ヤマネコカード',
  cardsLead: 'ポイントを ためて、Reading Quest だけの ヤマネコの カードを あつめよう。',
  cardsOwned: (n: number, total: number) => `${n} / ${total}まい`,
  cardGet: 'ゲットする',
  cardShort: (n: number) => `あと ${pt(n)}`,
  cardConfirm: (price: number) => `${pt(price)}を つかって、この カードを ゲットしますか？`,
  cardBackLabel: (price: number) => `まだ もっていない カード。${pt(price)}で ゲットできる`,

  // きろく
  recordTitle: 'きろく',
  recordRead: '読んだ 文章',
  recordChars: '読んだ 字の 数',
  recordStreak: 'つづいている 日数',
  recordDays: (n: number) => `${n}日`,
  recordCount: (n: number) => `${n}こ`,
  recordTypes: '問題の タイプごとの せいかいの わりあい',
  recordTypesNote: '文章ごとに、さいごに 読んだ ときの こたえで 数えます。読みなおして せいかいすると、わりあいも 上がります。',
  recordNone: 'まだ こたえた 問題が ありません。',
  recordRate: (correct: number, answered: number) => `${correct} / ${answered}問`,
  recordWeak: (type: string) => `「${type}」の 問題が にがてみたい。つぎに 読む 文章で、れんしゅう しよう。`,
  recordNoWeak: 'にがてな タイプは 見つかって いないよ。この ちょうし！',
  recordByGrade: '学年ごとの 読んだ 文章',

  howto: 'あそびかた',
  howtoItems: [
    '文章を 読んで、問題の こたえを 4つの 中から えらびます。',
    'こたえると すぐに せいかいが 分かります。本文の 中の、こたえの 手がかりに 黄色い しるしが つきます。',
    '文字の 大きさや、たて書き・よこ書きを えらべます。',
    '今日の チャレンジは 毎日 かわります。おえると スタンプが もらえます。',
    'ポイントを ためて、ヤマネコカードと こうかんしよう。',
  ],
  soundOn: '音：オン',
  soundOff: '音：オフ',

  // ログインと記録の保存 (保護者がすることも多いが、子どもにも読める表記にする)
  accountTitle: 'きろくの ほぞん',
  accountNote: 'Googleで ログインすると、ほかの ブラウザや たんまつでも 同じ きろくで 読めます。ログインしなくても つかえます。',
  signIn: 'Googleで ログイン',
  signedIn: 'ログイン中',
  signOut: 'ログアウト',
  syncLoading: 'たしかめています…',
  syncSaving: 'ほぞん中…',
  syncSaved: 'ほぞんずみ',
  syncOffline: 'まだ ほぞんできていません。つながったら ほぞんします。',
  askMigrate:
    'この たんまつの きろくを アカウントに うつしますか？\n\n「OK」… うつす (アカウントの きろくと 合わせます)\n「キャンセル」… うつさない (たんまつの きろくは そのまま のこります)',
  signOutUnsynced: 'まだ ほぞんできていない きろくが あります。今 ログアウトすると、その 分は なくなります。ログアウトしますか？',
  signInFailed: 'ログインできませんでした。もういちど ためしてください。',
};

export type Text = typeof T;
