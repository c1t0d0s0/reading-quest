import { describe, expect, it } from 'vitest';
import { mergeCards, mergeProgress, mergeScores, mergeSnapshots, mergeSpent, sameSnapshot } from '../src/core/merge';
import { clearPoints, earnedPoints, scorePoints } from '../src/core/rewards';
import {
  emptySnapshot,
  fromAppDoc,
  fromProgressDoc,
  hasRecords,
  toAppDoc,
  toProgressDoc,
  type Progress,
  type Snapshot,
} from '../src/core/snapshot';

const snap = (part: Partial<Snapshot>): Snapshot => ({ ...emptySnapshot(), ...part });
/** 「o」は正解、「x」はまちがい、「_」はまだ答えていない問題 */
const prog = (marks: string, part: Partial<Progress> = {}): Progress => {
  const ok = [...marks].map((m) => (m === '_' ? null : m === 'o'));
  return { answers: ok.map((o) => (o === null ? null : o ? 0 : 1)), ok, done: !marks.includes('_'), tries: 0, ...part };
};
/** 残高の計算 (storage.ts の balance と同じ式) */
const balance = (s: Snapshot) =>
  s.clears.reduce((sum, id) => sum + clearPoints(id), 0) +
  scorePoints(s.scores) +
  earnedPoints(s.stamps).total -
  s.cards.reduce((sum, c) => sum + c.paid, 0) -
  Object.values(s.spent).reduce((a, b) => a + b, 0);

describe('2 か所の記録を合わせる', () => {
  it('スタンプと今日のチャレンジは、両方を合わせた集合になる', () => {
    const a = snap({ stamps: ['2026-10-01', '2026-10-02'], clears: ['daily-2026-10-01', 'daily-2026-10-02'] });
    const b = snap({ stamps: ['2026-10-02', '2026-10-03'], clears: ['daily-2026-10-03', 'daily-2026-10-02'] });
    const m = mergeSnapshots(a, b);
    expect(m.stamps).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
    expect(m.clears).toEqual(['daily-2026-10-01', 'daily-2026-10-02', 'daily-2026-10-03']);
  });

  it('はじめて解いたときの正解の数は、文章ごとに少ないほう (ポイントが二重にふえない)', () => {
    expect(mergeScores({ a: 5, b: 3 }, { a: 2, c: 4 })).toEqual({ a: 2, b: 3, c: 4 });
    expect(mergeScores({ a: 0 }, {})).toEqual({ a: 0 });
  });

  it('カードは両方を合わせ、同じカードは払った額の小さいほう', () => {
    expect(mergeCards([{ id: 'rq01', paid: 100 }, { id: 'rq03', paid: 300 }], [{ id: 'rq01', paid: 40 }, { id: 'rq02', paid: 80 }])).toEqual([
      { id: 'rq01', paid: 40 },
      { id: 'rq02', paid: 80 },
      { id: 'rq03', paid: 300 },
    ]);
  });

  it('使ったポイントは、キーごとに大きいほう (二重に数えない)', () => {
    expect(mergeSpent({ x: 20, y: 10 }, { x: 30, z: 10 })).toEqual({ x: 30, y: 10, z: 10 });
  });

  it('文章ごとの記録は、読み直した回数の多いほうを優先する', () => {
    const first = prog('ooooo', { tries: 0, at: 9 });
    const again = prog('x____', { tries: 1, at: 3 });
    expect(mergeProgress(first, again)).toBe(again);
    expect(mergeProgress(again, first)).toBe(again);
  });

  it('同じ回なら、終わっているほう、答えの多いほう', () => {
    const done = prog('oox', { at: 1 });
    const playing = prog('o__', { at: 9 });
    expect(mergeProgress(done, playing)).toBe(done);
    expect(mergeProgress(playing, done)).toBe(done);
    const more = prog('ox_', { at: 1 });
    const less = prog('o__', { at: 9 });
    expect(mergeProgress(less, more)).toBe(more);
  });

  it('学年と音は、あとから変えたほう。まだえらんでいない項目はおぎなう', () => {
    const a = snap({ settings: { grade: 2, sound: null, at: 10 } });
    const b = snap({ settings: { grade: 5, sound: false, at: 5 } });
    expect(mergeSnapshots(a, b).settings).toEqual({ grade: 2, sound: false, at: 10 });
    expect(mergeSnapshots(b, a).settings).toEqual({ grade: 2, sound: false, at: 10 });
  });
});

describe('合わせる処理の性質', () => {
  // 2 台で別々に読んだ、少しずつちがう記録
  const a = snap({
    stamps: ['2026-10-01', '2026-10-02', '2026-10-03'],
    clears: ['daily-2026-10-01'],
    scores: { 'g3-a': 5, 'g3-b': 2 },
    cards: [{ id: 'rq01', paid: 40 }],
    settings: { grade: 3, sound: true, at: 10 },
    progress: { 'g3-a': prog('ooooo', { at: 3 }), 'g3-b': prog('oxx__', { at: 4 }) },
  });
  const b = snap({
    stamps: ['2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'],
    clears: ['daily-2026-10-07'],
    scores: { 'g3-b': 4, 'g3-c': 3 },
    cards: [{ id: 'rq01', paid: 40 }, { id: 'rq02', paid: 80 }],
    spent: { x: 10 },
    settings: { grade: 4, sound: false, at: 20 },
    progress: { 'g3-b': prog('oxxo_', { at: 2 }), 'g3-c': prog('o____', { at: 5, tries: 2 }) },
  });
  const c = snap({ stamps: ['2026-09-30'], scores: { 'g3-c': 1 }, spent: { x: 30 }, progress: { 'g3-c': prog('ooo', { at: 1, tries: 1 }) } });

  it('同じものを 2 回合わせても変わらない', () => {
    const once = mergeSnapshots(a, b);
    expect(sameSnapshot(mergeSnapshots(once, b), once)).toBe(true);
    expect(sameSnapshot(mergeSnapshots(once, a), once)).toBe(true);
    expect(sameSnapshot(mergeSnapshots(a, a), a)).toBe(true);
  });

  it('入れかえても、合わせる順を変えても、同じ結果になる', () => {
    expect(sameSnapshot(mergeSnapshots(a, b), mergeSnapshots(b, a))).toBe(true);
    const x = mergeSnapshots(mergeSnapshots(a, b), c);
    const y = mergeSnapshots(a, mergeSnapshots(b, c));
    const z = mergeSnapshots(mergeSnapshots(c, a), b);
    expect(sameSnapshot(x, y)).toBe(true);
    expect(sameSnapshot(x, z)).toBe(true);
  });

  it('合わせたあとの残高は、二重にふえない', () => {
    const m = mergeSnapshots(a, b);
    // スタンプは 10/1〜10/7 の 7 日連続で 1000pt。今日のチャレンジ 2 回で 40pt。正解は (5 + 2 + 3) × 4
    expect(earnedPoints(m.stamps).total).toBe(1000);
    expect(balance(m)).toBe(1000 + 40 + 40 - (40 + 80) - 10);
    // 何回合わせても同じ
    expect(balance(mergeSnapshots(mergeSnapshots(m, a), b))).toBe(balance(m));
  });

  it('空の記録と合わせても変わらない', () => {
    expect(sameSnapshot(mergeSnapshots(a, emptySnapshot()), a)).toBe(true);
    expect(hasRecords(emptySnapshot())).toBe(false);
    expect(hasRecords(snap({ settings: { grade: 1, sound: true, at: 5 } }))).toBe(false); // 設定だけ
    expect(hasRecords(snap({ progress: { x: prog('___') } }))).toBe(false); // 何も答えていない
    expect(hasRecords(snap({ progress: { x: prog('o__') } }))).toBe(true);
    expect(hasRecords(a)).toBe(true);
  });
});

describe('Firestore の形との変換', () => {
  const s = snap({
    stamps: ['2026-10-01'],
    clears: ['daily-2026-10-01'],
    scores: { 'g1-a': 3 },
    cards: [{ id: 'rq01', paid: 40 }],
    settings: { grade: 2, sound: false, at: 7 },
  });

  it('学習アプリ共通の名前で保存する', () => {
    const doc = toAppDoc(s, 1234);
    expect(doc).toEqual({
      schema: 1,
      updatedAt: 1234,
      activeDays: ['2026-10-01'],
      completed: ['daily-2026-10-01'],
      inventory: { rq01: { paid: 40 } },
      spent: {},
      settings: { grade: 2, sound: false, at: 7 },
      scores: { 'g1-a': 3 },
    });
    // 名前やメールアドレスにあたる項目はない
    expect(JSON.stringify(doc)).not.toMatch(/email|name|photo/i);
  });

  it('保存して読みもどすと、元の記録になる', () => {
    expect(sameSnapshot(fromAppDoc(toAppDoc(s, 1)), s)).toBe(true);
    const p = prog('ox_', { tries: 2, at: 99 });
    const doc = toProgressDoc(p, 1);
    expect(doc).toMatchObject({ schema: 1, status: 'playing', updatedAt: 99 });
    expect(fromProgressDoc(doc)).toEqual(p);
    expect(toProgressDoc(prog('oo'), 5)).toMatchObject({ status: 'done', updatedAt: 5 });
  });

  it('形がくずれたデータを読んでも、こわれない', () => {
    expect(sameSnapshot(fromAppDoc(null), emptySnapshot())).toBe(true);
    const broken = fromAppDoc({
      activeDays: 'x',
      completed: [1, 'daily-2026-10-01'],
      inventory: { rq01: { paid: -5 }, rq02: null },
      spent: { a: 'b' },
      scores: { a: -1, b: 'x', c: 2 },
      settings: { grade: 9 },
    } as never);
    expect(broken.stamps).toEqual([]);
    expect(broken.clears).toEqual(['daily-2026-10-01']);
    expect(broken.cards).toEqual([]);
    expect(broken.spent).toEqual({});
    expect(broken.scores).toEqual({ c: 2 });
    expect(broken.settings.grade).toBeNull();
    expect(fromProgressDoc({ status: 'done' })).toBeNull();
    expect(fromProgressDoc({ data: { answers: 'x' } } as never)).toBeNull();
    expect(fromProgressDoc({ status: 'done', data: { answers: [7, 1], ok: ['y', true], tries: -1 } } as never)).toEqual({
      answers: [null, 1],
      ok: [null, true],
      done: true,
      tries: 0,
    });
  });
});
