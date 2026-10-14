import { beforeEach, describe, expect, it } from 'vitest';
import { addDays } from '../src/core/date';
import { DAILY_POINTS, POINTS_PER_CORRECT, currentRun, earnedPoints, monthView, rewardFor } from '../src/core/rewards';
import {
  addDailyClear,
  addStamp,
  answer,
  balance,
  buyCard,
  dailyDone,
  getCards,
  getGrade,
  getScores,
  getStamps,
  loadProgress,
  migrateCardPrices,
  setGrade,
  startTry,
  statusOf,
} from '../src/core/storage';
import { CARDS } from '../src/data/cards';
import { kanjiBeyond } from '../src/data/kanji';
import { PASSAGES } from '../src/data/passages';

/** start から n 日ぶんの連続した日付 */
const days = (start: string, n: number) => Array.from({ length: n }, (_, i) => addDays(start, i));

// テスト用の localStorage
const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  },
});
beforeEach(() => store.clear());

/** 5 問の文章を読み終える。はじめの correct 問が正解。もどり値はもらえたポイント */
function read(id: string, correct: number, questions = 5): number {
  let p = startTry(id, questions);
  let points = 0;
  for (let i = 0; i < questions; i++) {
    const r = answer(id, p, i, i < correct ? 0 : 1, i < correct);
    p = r.progress;
    points += r.points;
  }
  return points;
}

describe('ポイントの計算', () => {
  it('7 日連続するたびに 1000pt', () => {
    expect(earnedPoints(days('2026-10-05', 6)).total).toBe(0);
    expect(earnedPoints(days('2026-10-05', 7)).total).toBe(1000);
    expect(earnedPoints(days('2026-10-05', 13)).total).toBe(1000);
    expect(earnedPoints(days('2026-10-05', 14)).total).toBe(2000);
  });

  it('とぎれたら数え直す', () => {
    const gap = [...days('2026-10-05', 6), ...days('2026-10-12', 6)]; // 10/11 がぬけている
    expect(earnedPoints(gap).total).toBe(0);
    expect(earnedPoints([...gap, '2026-10-11']).total).toBe(1000); // うめると 13 日連続
    expect(earnedPoints([...days('2026-10-01', 7), ...days('2026-10-10', 7)]).total).toBe(2000);
  });

  it('1 か月すべてそろうと +5000pt (月ごとに数える)', () => {
    const october = days('2026-10-01', 31);
    expect(earnedPoints(october)).toEqual({ weeks: 4, months: ['2026-10'], total: 9000 });
    expect(earnedPoints(october.slice(1)).months).toEqual([]);
    expect(earnedPoints(october.slice(0, 30)).months).toEqual([]);
    expect(earnedPoints(days('2026-10-15', 31))).toEqual({ weeks: 4, months: [], total: 4000 });
  });

  it('月の長さがちがっても正しい', () => {
    expect(earnedPoints(days('2026-11-01', 30)).months).toEqual(['2026-11']);
    expect(earnedPoints(days('2026-02-01', 28)).months).toEqual(['2026-02']);
    expect(earnedPoints(days('2028-02-01', 28)).months).toEqual([]); // うるう年は 29 日まで
    expect(earnedPoints(days('2028-02-01', 29)).months).toEqual(['2028-02']);
  });

  it('つづいている日数', () => {
    const d = days('2026-10-05', 3);
    expect(currentRun(d, '2026-10-07')).toBe(3);
    expect(currentRun(d, '2026-10-08')).toBe(3); // 今日がまだでも、きのうまで続いている
    expect(currentRun(d, '2026-10-09')).toBe(0);
    expect(monthView(d, '2026-10').map((on, i) => (on ? i + 1 : 0)).filter(Boolean)).toEqual([5, 6, 7]);
  });

  it('スタンプを足したときにもらえる分', () => {
    const six = days('2026-10-05', 6);
    expect(rewardFor(six, '2026-10-11')).toEqual({ added: true, run: 7, weekPoints: 1000, monthPoints: 0 });
    expect(rewardFor(six, '2026-10-10')).toEqual({ added: false, run: 6, weekPoints: 0, monthPoints: 0 });
    expect(rewardFor(days('2026-02-01', 27), '2026-02-28')).toEqual({ added: true, run: 28, weekPoints: 1000, monthPoints: 5000 });
  });
});

describe('文章を読んでもらえるポイント', () => {
  it('正解 1 問で 4pt。はじめて読み終えたときにまとめてもらえる', () => {
    let p = startTry('g4-a', 5);
    for (let i = 0; i < 4; i++) {
      const r = answer('g4-a', p, i, 0, i !== 1);
      p = r.progress;
      expect(r.points).toBe(0); // とちゅうではまだもらえない
    }
    expect(statusOf('g4-a')).toBe('playing');
    const last = answer('g4-a', p, 4, 0, true);
    expect(last.points).toBe(4 * POINTS_PER_CORRECT);
    expect(statusOf('g4-a')).toBe('done');
    expect(getScores()).toEqual({ 'g4-a': 4 });
    expect(balance()).toBe(16);
  });

  it('読み直しても、ポイントはふえない (はじめの点数のまま)', () => {
    expect(read('g4-a', 2)).toBe(8);
    expect(read('g4-a', 5)).toBe(0);
    expect(getScores()).toEqual({ 'g4-a': 2 });
    expect(balance()).toBe(8);
    // 記録は、読み直したほうになる (選択肢の順番が変わるよう、回数もふえる)
    expect(loadProgress('g4-a')).toMatchObject({ tries: 1, done: true, ok: [true, true, true, true, true] });
  });

  it('同じ問題に 2 回は答えられない', () => {
    const p = startTry('g4-a', 2);
    const r1 = answer('g4-a', p, 0, 1, false);
    const r2 = answer('g4-a', r1.progress, 0, 0, true);
    expect(r2.progress.ok).toEqual([false, null]);
  });

  it('今日のチャレンジは 1 日 1 回 20pt。スタンプも 1 日 1 個', () => {
    expect(dailyDone('2026-10-09')).toBe(false);
    expect(addDailyClear('2026-10-09')).toBe(DAILY_POINTS);
    expect(addDailyClear('2026-10-09')).toBe(0);
    expect(dailyDone('2026-10-09')).toBe(true);
    expect(addStamp('2026-10-09').added).toBe(true);
    expect(addStamp('2026-10-09').added).toBe(false);
    expect(getStamps()).toEqual(['2026-10-09']);
    expect(balance()).toBe(20);
  });

  it('学年は、えらぶまで null', () => {
    expect(getGrade()).toBeNull();
    setGrade(3);
    expect(getGrade()).toBe(3);
  });
});

describe('カードとの交換', () => {
  it('ポイントが足りれば交換でき、残高がへる', () => {
    days('2026-10-03', 7).forEach((d) => addStamp(d)); // 1000pt
    const card = CARDS[4];
    expect(card.price).toBe(800);
    expect(buyCard(card)).toBe(true);
    expect(balance()).toBe(200);
    expect(buyCard(card)).toBe(false); // もう持っている
    expect(buyCard(CARDS[3])).toBe(false); // 500pt には足りない
    expect(buyCard(CARDS[1])).toBe(true);
    expect(getCards()).toEqual([
      { id: card.id, paid: 800 },
      { id: CARDS[1].id, paid: 80 },
    ]);
  });

  it('今日のチャレンジを 2 回すれば、1 枚目のカード (40pt) と交換できる', () => {
    addDailyClear('2026-10-09');
    expect(buyCard(CARDS[0])).toBe(false);
    addDailyClear('2026-10-10');
    expect(buyCard(CARDS[0])).toBe(true);
    expect(balance()).toBe(0);
  });

  it('値下げ前に高い値段で交換していた人には、差額がもどる', () => {
    days('2026-10-03', 14).forEach((d) => addStamp(d)); // 2000pt
    store.set('readingquest:v1:cards', JSON.stringify([{ id: 'rq01', paid: 100 }, { id: 'rq02', paid: 1000 }]));
    expect(balance()).toBe(900);
    migrateCardPrices(CARDS);
    expect(getCards()).toEqual([{ id: 'rq01', paid: 40 }, { id: 'rq02', paid: 80 }]);
    expect(balance()).toBe(1880);
  });
});

describe('カード', () => {
  it('20 種類で、id と名前が重複しない。Wordlynx のカードとも id がちがう', () => {
    expect(CARDS).toHaveLength(20);
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(20);
    expect(new Set(CARDS.map((c) => c.name)).size).toBe(20);
    for (const c of CARDS) expect(c.id).toMatch(/^rq\d{2}$/);
  });

  it('値段は安い順にだんだん高くなり、合計は 28,420pt', () => {
    const prices = CARDS.map((c) => c.price);
    expect(prices).toEqual([40, 80, 300, 500, 800, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2200, 2400, 2600, 3000]);
    expect(TOTAL).toBe(28420);
  });

  it('見た目がすべてちがう', () => {
    expect(new Set(CARDS.map((c) => JSON.stringify([c.look, c.bg]))).size).toBe(20);
  });

  it('名前の漢字は 3 年生まで', () => {
    for (const c of CARDS) expect(kanjiBeyond(c.name, 3), c.name).toEqual([]);
  });
});

// ---- カードの値段のバランス ----
// ポイントのもらい方から、「何日目に何枚持てるか」を計算して確かめる

const TOTAL = CARDS.reduce((sum, c) => sum + c.price, 0);

/** 安い順に買っていったとき、points で何枚持てるか */
function affordable(points: number): number {
  let left = points;
  let count = 0;
  for (const card of CARDS) {
    if (left < card.price) break;
    left -= card.price;
    count++;
  }
  return count;
}

/** start から n 日、今日のチャレンジを毎日した人が、n 日目までにもらうポイント (文章の正解の分はのぞく) */
const dailyOnly = (start: string, n: number) => earnedPoints(days(start, n)).total + n * DAILY_POINTS;
/** 全部の文章を読んで、全問正解したときのポイント */
const ALL_PASSAGES = PASSAGES.reduce((sum, p) => sum + p.qtypes.length * POINTS_PER_CORRECT, 0);

describe('カードの値段のバランス', () => {
  it('今日のチャレンジを毎日する人は、全部まちがえても、はじめの 5 枚を 2 週間以内に手に入れられる', () => {
    const owned = (day: number) => affordable(dailyOnly('2026-10-16', day));
    expect(owned(1)).toBe(0);
    expect(owned(2)).toBe(1);
    expect(owned(7)).toBe(4);
    expect(owned(14)).toBe(5);
  });

  it('そのあとは、1 枚ごとに少しずつ時間がかかる', () => {
    // 月そろいの 5000pt が入らない、いちばんおそい場合で数える
    const slow = (n: number) => n * DAILY_POINTS + Math.floor(n / 7) * 1000;
    const dayOf = (count: number) => {
      let day = 1;
      while (affordable(slow(day)) < count) day++;
      return day;
    };
    const gaps = Array.from({ length: 15 }, (_, i) => dayOf(i + 6) - dayOf(i + 5)); // 6〜20 枚目
    for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(7);
    const average = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(average(gaps.slice(10))).toBeGreaterThan(average(gaps.slice(0, 5)));
  });

  it('全部の文章を全問正解しても、今日のチャレンジを 2 か月以上つづけないと全部はそろわない', () => {
    // 毎日の文章も全問正解 (1 日 20pt 多い) として、いちばん早い場合を数える
    let fastest = Infinity;
    let start = '2027-01-01';
    for (let i = 0; i < 366; i++) {
      let n = 1;
      while (dailyOnly(start, n) + n * 20 + ALL_PASSAGES < TOTAL) n++;
      fastest = Math.min(fastest, n);
      start = addDays(start, 1);
    }
    expect(fastest).toBeGreaterThanOrEqual(60);
  }, 60_000);
});
