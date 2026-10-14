import { normalizeStamps } from './rewards';
import type { OwnedCard, Progress, Settings, Snapshot } from './snapshot';

// 2 か所にある記録 (たとえば、この端末と Firestore) を 1 つに合わせる。
// どの関数も、同じものを 2 回合わせても変わらず、a と b を入れかえても同じ結果になる。
// そのため、何回やっても・どの順でやっても、記録がこわれたり二重にふえたりしない。

/** 決め手がないときに、いつも同じほうをえらぶための比べ方 */
const pickStable = <T>(a: T, b: T): T => (JSON.stringify(a) <= JSON.stringify(b) ? a : b);

const answered = (p: Progress) => p.answers.filter((a) => a !== null).length;

/**
 * 文章 1 つ分の記録: 読み直した回数の多いほう (新しく読み直したほう)。
 * 同じ回なら、終わっているほう、答えの多いほう、あとで保存したほう。
 */
export function mergeProgress(a: Progress, b: Progress): Progress {
  if (a.tries !== b.tries) return a.tries > b.tries ? a : b;
  if (a.done !== b.done) return a.done ? a : b;
  if (answered(a) !== answered(b)) return answered(a) > answered(b) ? a : b;
  if ((a.at ?? 0) !== (b.at ?? 0)) return (a.at ?? 0) > (b.at ?? 0) ? a : b;
  return pickStable(a, b);
}

/** カード: 両方を合わせる。同じカードは、払った額の小さいほう */
export function mergeCards(a: readonly OwnedCard[], b: readonly OwnedCard[]): OwnedCard[] {
  const paid = new Map<string, number>();
  for (const c of [...a, ...b]) paid.set(c.id, Math.min(c.paid, paid.get(c.id) ?? Infinity));
  return [...paid].map(([id, p]) => ({ id, paid: p })).sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
}

/** 使ったポイント: キーごとに、大きいほう */
export function mergeSpent(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) out[key] = Math.max(a[key] ?? 0, b[key] ?? 0);
  return out;
}

/**
 * はじめて解いたときの正解の数: 文章ごとに、小さいほう。
 * 2 台でそれぞれ「はじめて」解いたときも、ポイントが二重にふえたり、多いほうに書きかわったりしない。
 */
export function mergeScores(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) out[key] = Math.min(a[key] ?? Infinity, b[key] ?? Infinity);
  return out;
}

/** 学年と音: あとから変えたほう */
function mergeSettings(a: Settings, b: Settings): Settings {
  const [newer, older] =
    a.at !== b.at
      ? a.at > b.at
        ? [a, b]
        : [b, a]
      : JSON.stringify([a.grade, a.sound]) <= JSON.stringify([b.grade, b.sound])
        ? [a, b]
        : [b, a];
  return {
    // まだえらんでいない項目 (null) は、もう一方の値でおぎなう
    grade: newer.grade ?? older.grade,
    sound: newer.sound ?? older.sound,
    at: Math.max(a.at, b.at),
  };
}

export function mergeSnapshots(a: Snapshot, b: Snapshot): Snapshot {
  const progress: Record<string, Progress> = {};
  for (const id of [...new Set([...Object.keys(a.progress), ...Object.keys(b.progress)])].sort()) {
    const pa = a.progress[id];
    const pb = b.progress[id];
    progress[id] = pa && pb ? mergeProgress(pa, pb) : (pa ?? pb);
  }
  return {
    stamps: normalizeStamps([...a.stamps, ...b.stamps]),
    clears: [...new Set([...a.clears, ...b.clears])].sort(),
    scores: mergeScores(a.scores, b.scores),
    cards: mergeCards(a.cards, b.cards),
    spent: mergeSpent(a.spent, b.spent),
    settings: mergeSettings(a.settings, b.settings),
    progress,
  };
}

/** 記録の中身が同じか (ならび順のちがいは気にしない) */
export function sameSnapshot(a: Snapshot, b: Snapshot): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

export function sameSummary(a: Snapshot, b: Snapshot): boolean {
  return JSON.stringify({ ...canonical(a), progress: null }) === JSON.stringify({ ...canonical(b), progress: null });
}

function canonical(s: Snapshot): Snapshot {
  return mergeSnapshots(s, s);
}
