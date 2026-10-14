import type { Grade } from './reading';

// ---- 手元の記録の形 ----

/** 文章 1 つ分の、さいごに読んだときの記録 */
export interface Progress {
  /** 選んだ選択肢 (choices の中の番号)。まだ答えていない問題は null */
  answers: (number | null)[];
  /** それぞれの問題が正解だったか。まだ答えていない問題は null */
  ok: (boolean | null)[];
  /** 全部の問題に答えたか */
  done: boolean;
  /** 何回目に読んでいるか (0 から)。選択肢の順番は、これで変わる */
  tries: number;
  /** さいごに保存した時刻 (ミリ秒)。2 か所の記録を合わせるときに使う */
  at?: number;
}

export interface OwnedCard {
  id: string;
  /** 交換したときに使ったポイント。あとで値段を変えても残高がずれないように残す */
  paid: number;
}

export interface Settings {
  grade: Grade | null;
  sound: boolean | null;
  /** 学年や音をさいごに変えた時刻 (ミリ秒) */
  at: number;
}

/** 1 人分の記録の全部。ログインなしの記録も、ログイン中の人の記録も、この形であつかう */
export interface Snapshot {
  stamps: string[];
  /** 終えた今日のチャレンジ (daily-YYYY-MM-DD) */
  clears: string[];
  /** 文章ごとの、はじめて解いたときの正解の数。ポイントはここから計算する */
  scores: Record<string, number>;
  cards: OwnedCard[];
  /** ポイントを使った分 (カード以外。今は使っていないが、学習アプリ共通の形なので残す) */
  spent: Record<string, number>;
  settings: Settings;
  progress: Record<string, Progress>;
}

export function emptySnapshot(): Snapshot {
  return {
    stamps: [],
    clears: [],
    scores: {},
    cards: [],
    spent: {},
    settings: { grade: null, sound: null, at: 0 },
    progress: {},
  };
}

/** 記録が 1 つでもあるか (設定だけのときは「ない」とみなす) */
export function hasRecords(s: Snapshot): boolean {
  return (
    s.stamps.length > 0 ||
    s.clears.length > 0 ||
    Object.keys(s.scores).length > 0 ||
    s.cards.length > 0 ||
    Object.keys(s.spent).length > 0 ||
    Object.values(s.progress).some((p) => p.done || p.answers.some((a) => a !== null))
  );
}

export const isGrade = (v: unknown): v is Grade => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 6;

// ---- Firestore に保存する形 (小学生向けの学習アプリで共通。Wordlynx と同じ) ----
//
//   users/{uid}                                その人の情報 (全アプリ共通)。名前やメールアドレスは入れない
//   users/{uid}/apps/{appId}                   アプリごとの記録のまとめ (AppDoc)
//   users/{uid}/apps/{appId}/progress/{itemId} 教材 1 つごとの途中経過 (ProgressDoc)
//
// Reading Quest の appId は "reading-quest"。

export const SCHEMA = 1;
export const APP_ID = 'reading-quest';

export interface UserDoc {
  schema: number;
  createdAt: number;
  updatedAt: number;
}

export interface AppDoc {
  schema: number;
  updatedAt: number;
  /** その日の目標を達成した日 (YYYY-MM-DD)。Reading Quest ではスタンプ */
  activeDays: string[];
  /** やりとげた教材の id。Reading Quest では終えた今日のチャレンジ */
  completed: string[];
  /** 手に入れたごほうび。Reading Quest ではヤマネコカード */
  inventory: Record<string, { paid: number }>;
  /** 使ったポイント */
  spent: Record<string, number>;
  /** アプリごとの設定。中身はアプリが決める */
  settings: Record<string, unknown>;
  /** Reading Quest だけのもの: 文章ごとの、はじめて解いたときの正解の数 */
  scores?: Record<string, number>;
}

export interface ProgressDoc {
  schema: number;
  updatedAt: number;
  status: 'playing' | 'done';
  /** 途中経過の中身。アプリが決める */
  data: Record<string, unknown>;
}

export function toAppDoc(s: Snapshot, now: number): AppDoc {
  return {
    schema: SCHEMA,
    updatedAt: now,
    activeDays: s.stamps,
    completed: s.clears,
    inventory: Object.fromEntries(s.cards.map((c) => [c.id, { paid: c.paid }])),
    spent: s.spent,
    settings: { grade: s.settings.grade, sound: s.settings.sound, at: s.settings.at },
    scores: s.scores,
  };
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const counts = (v: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  if (typeof v !== 'object' || v === null) return out;
  for (const [key, n] of Object.entries(v)) if (typeof n === 'number' && Number.isFinite(n) && n >= 0) out[key] = n;
  return out;
};

/** Firestore から読んだものは形がくずれているかもしれないので、1 つずつ確かめながらもどす */
export function fromAppDoc(doc: Partial<AppDoc> | null | undefined): Snapshot {
  const s = emptySnapshot();
  if (!doc) return s;
  s.stamps = strings(doc.activeDays);
  s.clears = strings(doc.completed);
  s.scores = counts(doc.scores);
  for (const [id, item] of Object.entries(doc.inventory ?? {})) {
    if (typeof item?.paid === 'number' && item.paid >= 0) s.cards.push({ id, paid: item.paid });
  }
  s.spent = Object.fromEntries(Object.entries(counts(doc.spent)).filter(([, n]) => n > 0));
  const st = doc.settings ?? {};
  s.settings = {
    grade: isGrade(st.grade) ? st.grade : null,
    sound: typeof st.sound === 'boolean' ? st.sound : null,
    at: typeof st.at === 'number' ? st.at : 0,
  };
  return s;
}

export function toProgressDoc(p: Progress, now: number): ProgressDoc {
  return {
    schema: SCHEMA,
    updatedAt: p.at ?? now,
    status: p.done ? 'done' : 'playing',
    data: { answers: p.answers, ok: p.ok, tries: p.tries },
  };
}

/** 保存されていた途中経過を確かめながらもどす。形がおかしければ null */
export function checkProgress(d: Record<string, unknown> | null | undefined, done: boolean, at?: number): Progress | null {
  if (!d || !Array.isArray(d.answers)) return null;
  const answers = d.answers.map((a) => (typeof a === 'number' && Number.isInteger(a) && a >= 0 && a < 4 ? a : null));
  const okRaw = Array.isArray(d.ok) ? d.ok : [];
  const ok = answers.map((a, i) => (a === null ? null : typeof okRaw[i] === 'boolean' ? (okRaw[i] as boolean) : null));
  return {
    answers,
    ok,
    done,
    tries: typeof d.tries === 'number' && d.tries >= 0 ? Math.floor(d.tries) : 0,
    ...(typeof at === 'number' ? { at } : {}),
  };
}

export function fromProgressDoc(doc: Partial<ProgressDoc> | null | undefined): Progress | null {
  return checkProgress(doc?.data, doc?.status === 'done', typeof doc?.updatedAt === 'number' ? doc.updatedAt : undefined);
}
