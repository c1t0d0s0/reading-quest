import type { Grade, PassageMeta, QType } from './reading';
import { QTYPES } from './reading';
import type { Progress } from './snapshot';

export interface TypeStat {
  type: QType;
  answered: number;
  correct: number;
}

/**
 * 問題のタイプごとの正答率。文章ごとに、さいごに読んだときの答えで数える
 * (読み直して正解できるようになれば、苦手ではなくなる)
 */
export function typeStats(progress: Record<string, Progress>, metaOf: (id: string) => PassageMeta | undefined): TypeStat[] {
  const stats = new Map<QType, TypeStat>(QTYPES.map((t) => [t, { type: t, answered: 0, correct: 0 }]));
  for (const [id, p] of Object.entries(progress)) {
    const meta = metaOf(id);
    if (!meta) continue;
    p.ok.forEach((ok, i) => {
      const type = meta.qtypes[i];
      if (ok === null || !type) return;
      const s = stats.get(type)!;
      s.answered++;
      if (ok) s.correct++;
    });
  }
  return [...stats.values()];
}

/** 苦手なタイプ: 5 問以上答えていて、正答率がいちばん低いもの (7 割以上なら苦手とはいわない) */
export function weakest(stats: readonly TypeStat[]): TypeStat | undefined {
  return stats
    .filter((s) => s.answered >= 5 && s.correct / s.answered < 0.7)
    .sort((a, b) => a.correct / a.answered - b.correct / b.answered || b.answered - a.answered)[0];
}

/**
 * 次に読む文章のおすすめ。
 * 1. 読みかけの続きもの (前の回を終えていて、まだ読んでいない回)
 * 2. まだ読んでいない文章のうち、苦手なタイプの問題が多いもの
 * 3. まだ読んでいない文章
 * どれも、えらんでいる学年の中から。全部読んでいたら undefined
 */
export function recommend(
  passages: readonly PassageMeta[],
  grade: Grade,
  isRead: (id: string) => boolean,
  weak: QType | undefined,
  exclude: readonly string[] = [],
): PassageMeta | undefined {
  const mine = passages.filter((p) => p.grade === grade && !exclude.includes(p.id));
  const unread = mine.filter((p) => !isRead(p.id));
  const continuing = unread.find(
    (p) => p.series && p.series.part > 1 && mine.some((q) => q.series?.id === p.series!.id && q.series.part === p.series!.part - 1 && isRead(q.id)),
  );
  if (continuing) return continuing;
  // 続きものの 2 回目より後は、前の回を読んでからにする
  const startable = unread.filter((p) => !p.series || p.series.part === 1);
  if (weak) {
    const count = (p: PassageMeta) => p.qtypes.filter((t) => t === weak).length;
    const best = [...startable].sort((a, b) => count(b) - count(a))[0];
    if (best && count(best) > 0) return best;
  }
  return startable[0];
}
