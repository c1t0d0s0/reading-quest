import { describe, expect, it } from 'vitest';
import { dailyPassage, dailyUnits, interleave } from '../src/core/daily';
import { addDays } from '../src/core/date';
import { GRADES, type PassageMeta } from '../src/core/reading';
import { PASSAGES } from '../src/data/passages';

const meta = (id: string, genre: PassageMeta['genre'], part?: number): PassageMeta => ({
  id,
  grade: 3,
  title: id,
  author: 'Reading Quest',
  source: 'original',
  genre,
  chars: 1000,
  qtypes: [],
  ...(part ? { series: { id: 'g3-s', part, total: 3 } } : {}),
});

describe('今日のチャレンジの文章', () => {
  it('同じ日・同じ学年なら、いつも同じ文章', () => {
    for (const g of GRADES) expect(dailyPassage(PASSAGES, g, '2026-10-14')?.id).toBe(dailyPassage(PASSAGES, g, '2026-10-14')?.id);
  });

  it('学年の文章をすべて出しきるまで同じ文章は出ず、1 周は 30 日以上。となりの日に同じ文章が続くこともない (2 年分)', () => {
    for (const g of GRADES) {
      const n = PASSAGES.filter((p) => p.grade === g).length;
      expect(n, `${g}年`).toBeGreaterThanOrEqual(30);
      let prev = '';
      // 0 日目 (2026-01-01) から 1 周ずつ区切って数える
      for (let start = 0; start < 730; start += n) {
        const ids = Array.from({ length: n }, (_, i) => dailyPassage(PASSAGES, g, addDays('2026-01-01', start + i))!.id);
        expect(new Set(ids).size, `${g}年 ${start}日目から`).toBe(n);
        expect(ids[0], `${g}年 ${start}日目`).not.toBe(prev);
        prev = ids[ids.length - 1];
      }
    }
  });

  it('続きものは 1 回目から順に、つづけて出る (2 年分)', () => {
    for (const g of GRADES) {
      for (let day = 0; day < 730; day++) {
        const p = dailyPassage(PASSAGES, g, addDays('2026-01-01', day))!;
        if (!p.series) continue;
        const before = dailyPassage(PASSAGES, g, addDays('2026-01-01', day - 1))!;
        if (p.series.part === 1) expect(before.series?.id === p.series.id, p.id).toBe(false);
        else expect(before.series, p.id).toEqual({ ...p.series, part: p.series.part - 1 });
      }
    }
  });

  it('続きものは、まとめて 1 つの単位になる', () => {
    const units = dailyUnits([meta('g3-b', 'story', 2), meta('g3-a', 'story', 1), meta('g3-c', 'explain')], 3);
    expect(units.map((u) => u.map((p) => p.id))).toEqual([['g3-a', 'g3-b'], ['g3-c']]);
  });

  it('同じジャンルがなるべく続かないように並ぶ', () => {
    const items = [meta('a', 'story'), meta('b', 'story'), meta('c', 'story'), meta('d', 'explain'), meta('e', 'explain'), meta('f', 'folktale')];
    const order = interleave(items, (p) => p.genre).map((p) => p.genre);
    for (let i = 1; i < order.length; i++) expect(order[i], order.join(',')).not.toBe(order[i - 1]);
    expect(interleave(items, (p) => p.genre)).toHaveLength(items.length);
  });

  it('学年の文章がなければ undefined', () => {
    expect(dailyPassage([], 1, '2026-10-14')).toBeUndefined();
  });
});
