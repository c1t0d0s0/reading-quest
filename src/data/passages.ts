import type { Grade, Passage, PassageMeta } from '../core/reading';
import index from './passages/index.json';

/** 全部の文章の一覧 (本文はふくまない) */
export const PASSAGES: readonly PassageMeta[] = index as PassageMeta[];

const byId = new Map(PASSAGES.map((p) => [p.id, p]));

export const metaOf = (id: string): PassageMeta | undefined => byId.get(id);

// 本文と問題は学年ごとのファイルに分けてあり、その学年の文章を開いたときにはじめて読みこむ
const loaders: Record<Grade, () => Promise<{ default: unknown }>> = {
  1: () => import('./passages/g1.json'),
  2: () => import('./passages/g2.json'),
  3: () => import('./passages/g3.json'),
  4: () => import('./passages/g4.json'),
  5: () => import('./passages/g5.json'),
  6: () => import('./passages/g6.json'),
};

const cache = new Map<Grade, Promise<Map<string, Passage>>>();

function gradeData(grade: Grade): Promise<Map<string, Passage>> {
  let p = cache.get(grade);
  if (!p) {
    p = loaders[grade]().then((m) => new Map((m.default as Passage[]).map((x) => [x.id, x])));
    // 読みこみに失敗したら、次はもう一度ためす
    p.catch(() => cache.delete(grade));
    cache.set(grade, p);
  }
  return p;
}

export async function loadPassage(id: string): Promise<Passage | undefined> {
  const meta = byId.get(id);
  if (!meta) return undefined;
  return (await gradeData(meta.grade)).get(id);
}

/** 続きものの次の回 */
export function nextPart(meta: PassageMeta): PassageMeta | undefined {
  if (!meta.series || meta.series.part >= meta.series.total) return undefined;
  return PASSAGES.find((p) => p.series?.id === meta.series!.id && p.series.part === meta.series!.part + 1);
}

/** 続きものの前の回 */
export function prevPart(meta: PassageMeta): PassageMeta | undefined {
  if (!meta.series || meta.series.part <= 1) return undefined;
  return PASSAGES.find((p) => p.series?.id === meta.series!.id && p.series.part === meta.series!.part - 1);
}
