import { daysBetween } from './date';
import type { Genre, Grade, PassageMeta } from './reading';
import { rngFromString, shuffle } from './rng';

/** この日を 0 日目として数える */
const EPOCH = '2026-01-01';

/**
 * 今日のチャレンジに出す単位。続きものは 1 回目から順にまとめて 1 つにし、つづけて何日かで出す
 * (2 回目だけがいきなり出ることはない)。それ以外の文章は 1 つずつ
 */
export function dailyUnits(passages: readonly PassageMeta[], grade: Grade): PassageMeta[][] {
  const units = new Map<string, PassageMeta[]>();
  const mine = passages.filter((p) => p.grade === grade).sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const p of mine) {
    const key = p.series?.id ?? p.id;
    units.set(key, [...(units.get(key) ?? []), p]);
  }
  return [...units.values()].map((u) => u.sort((a, b) => (a.series?.part ?? 0) - (b.series?.part ?? 0)));
}

/**
 * 同じジャンルが続かないように並べかえる。のこりの多いジャンルから、前とちがうものを順にとる
 * (同じ数なら、もとの順で先にあるほう)
 */
export function interleave<T>(items: readonly T[], genreOf: (item: T) => Genre): T[] {
  const buckets = new Map<Genre, T[]>();
  for (const item of items) buckets.set(genreOf(item), [...(buckets.get(genreOf(item)) ?? []), item]);
  const out: T[] = [];
  let prev: Genre | null = null;
  while (out.length < items.length) {
    const candidates = [...buckets].filter(([, list]) => list.length > 0);
    const pick =
      candidates.filter(([g]) => g !== prev).sort((a, b) => b[1].length - a[1].length)[0] ??
      candidates.sort((a, b) => b[1].length - a[1].length)[0];
    out.push(pick[1].shift()!);
    prev = pick[0];
  }
  return out;
}

/** 何周目かの、単位を出す順番 */
function cycleOrder(units: readonly PassageMeta[][], grade: Grade, cycle: number): PassageMeta[][] {
  return interleave(shuffle(units, rngFromString(`daily:${grade}:${cycle}`)), (u) => u[0].genre);
}

/**
 * その日のチャレンジの文章。学年ごとに、その学年の文章をすべて 1 回ずつ出しきるまで同じ文章は出ない。
 * 日付と学年だけで決まるので、同じ日・同じ学年なら、だれが開いても同じ文章になる。
 */
export function dailyPassage(passages: readonly PassageMeta[], grade: Grade, date: string): PassageMeta | undefined {
  const units = dailyUnits(passages, grade);
  const n = units.reduce((sum, u) => sum + u.length, 0);
  if (n === 0) return undefined;
  const day = daysBetween(EPOCH, date);
  const cycle = Math.floor(day / n);
  const pos = ((day % n) + n) % n;
  const order = cycleOrder(units, grade, cycle);
  // 周のさかいめで、前の周のさいごと同じ文章が続かないようにする
  if (order.length > 1) {
    const prev = cycleOrder(units, grade, cycle - 1);
    if (order[0] === prev[prev.length - 1]) [order[0], order[1]] = [order[1], order[0]];
  }
  return order.flat()[pos];
}
