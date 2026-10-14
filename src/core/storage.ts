import type { Grade } from './reading';
import { POINTS_PER_CORRECT, clearPoints, dailyClearId, earnedPoints, normalizeStamps, rewardFor, scorePoints, type StampReward } from './rewards';
import { checkProgress, emptySnapshot, isGrade, type OwnedCard, type Progress, type Snapshot } from './snapshot';

export type { OwnedCard, Progress } from './snapshot';

// 記録を置く場所。ログインしていない人の記録は GUEST_PREFIX の下。
// ログイン中の人の記録 (Firestore の写し) は、人ごとに別の場所に置き、ログアウトしたら消す。
const GUEST_PREFIX = 'readingquest:v1:';
const userPrefix = (uid: string) => `readingquest:u:${uid}:`;
const ACTIVE_UID_KEY = 'readingquest:auth-uid';
/** 文字の大きさ・たて書きなどの見え方。端末ごとの好みなので、記録とは別に置き、同期もしない */
const VIEW_KEY = 'readingquest:view';

let prefix = GUEST_PREFIX;
let listener: ((key: string) => void) | null = null;
let muted = false;

/** 読み書きする記録を切りかえる。uid が null ならログインなしの記録 */
export function useStore(uid: string | null): void {
  prefix = uid ? userPrefix(uid) : GUEST_PREFIX;
}

/** 今、読み書きしているのがだれの記録か。ログインなしの記録なら null */
export function currentUid(): string | null {
  return prefix === GUEST_PREFIX ? null : prefix.slice('readingquest:u:'.length, -1);
}

/** この端末で、さいごにログインしていた人。次に開いたとき、通信を待たずにその人の写しを出すために使う */
export function rememberedUid(): string | null {
  try {
    return localStorage.getItem(ACTIVE_UID_KEY);
  } catch {
    return null;
  }
}

export function rememberUid(uid: string | null): void {
  try {
    if (uid) localStorage.setItem(ACTIVE_UID_KEY, uid);
    else localStorage.removeItem(ACTIVE_UID_KEY);
  } catch {
    /* 無視 */
  }
}

/** 記録が書きかわったら知らせてもらう (Firestore に送るため)。key は「stamps」「progress:g4-gon-1」など */
export function onStorageChange(cb: ((key: string) => void) | null): void {
  listener = cb;
}

// localStorage が使えない環境 (プライベートブラウズなど) でも遊べるよう、失敗は無視する
function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(prefix + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(prefix + key, JSON.stringify(value));
  } catch {
    /* 保存できなくても続行 */
  }
  if (!muted) listener?.(key);
}

function removeKey(fullKey: string): void {
  try {
    localStorage.removeItem(fullKey);
  } catch {
    /* 無視 */
  }
}

/** 今の場所にあるキーの一覧 (prefix をのぞいた形) */
function keys(at: string = prefix): string[] {
  const out: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(at)) out.push(key.slice(at.length));
    }
  } catch {
    /* 無視 */
  }
  return out;
}

// ---- 設定 ----

/** えらんでいる学年。まだえらんでいなければ null */
export function getGrade(): Grade | null {
  const g = read<number>('grade');
  return isGrade(g) ? g : null;
}

export function setGrade(grade: Grade): void {
  write('settings-at', Date.now()); // 2 か所の記録を合わせるとき、あとから変えたほうを使う
  write('grade', grade);
}

/** 効果音を鳴らすかどうか。何もえらんでいなければ鳴らす */
export function getSound(): boolean {
  return read<boolean>('sound') !== false;
}

export function setSound(on: boolean): void {
  write('settings-at', Date.now());
  write('sound', on);
}

export interface ViewPrefs {
  /** たて書きで読む */
  tate: boolean;
  /** 文字の大きさ (0: ふつう, 1: 大きい, 2: とても大きい) */
  size: 0 | 1 | 2;
}

export function getView(): ViewPrefs {
  try {
    const v = JSON.parse(localStorage.getItem(VIEW_KEY) ?? '{}') as Partial<ViewPrefs>;
    return { tate: v.tate === true, size: v.size === 1 || v.size === 2 ? v.size : 0 };
  } catch {
    return { tate: false, size: 0 };
  }
}

export function setView(v: ViewPrefs): void {
  try {
    localStorage.setItem(VIEW_KEY, JSON.stringify(v));
  } catch {
    /* 無視 */
  }
}

// ---- 文章ごとの記録 ----

export function loadProgress(id: string): Progress | null {
  const saved = read<Progress>(`progress:${id}`);
  return saved ? checkProgress(saved as unknown as Record<string, unknown>, saved.done === true, saved.at) : null;
}

export function saveProgress(id: string, progress: Progress): void {
  write(`progress:${id}`, { ...progress, at: Date.now() });
}

export type Status = 'new' | 'playing' | 'done';

export function statusOf(id: string): Status {
  const p = loadProgress(id);
  if (!p) return 'new';
  if (p.done) return 'done';
  return p.answers.some((a) => a !== null) ? 'playing' : 'new';
}

/** その文章を読みはじめる (読み直す)。前の記録があれば、回数を 1 つふやして答えを消す */
export function startTry(id: string, questions: number): Progress {
  const before = loadProgress(id);
  const p: Progress = {
    answers: new Array(questions).fill(null),
    ok: new Array(questions).fill(null),
    done: false,
    tries: before ? before.tries + 1 : 0,
  };
  saveProgress(id, p);
  return p;
}

/**
 * 問題に答える。もどり値は、そのあとの記録と、全部答え終わったときにもらえたポイント
 * (その文章をはじめて解き終えたときだけ。2 回目からは 0)
 */
export function answer(id: string, p: Progress, index: number, choice: number, ok: boolean): { progress: Progress; points: number } {
  if (p.answers[index] !== null || p.done) return { progress: p, points: 0 };
  const next: Progress = { ...p, answers: p.answers.slice(), ok: p.ok.slice() };
  next.answers[index] = choice;
  next.ok[index] = ok;
  next.done = next.answers.every((a) => a !== null);
  saveProgress(id, next);
  let points = 0;
  if (next.done) {
    const scores = getScores();
    if (!(id in scores)) {
      const correct = next.ok.filter(Boolean).length;
      write('scores', { ...scores, [id]: correct });
      points = correct * POINTS_PER_CORRECT;
    }
  }
  return { progress: next, points };
}

/** 文章ごとの、はじめて解いたときの正解の数 */
export function getScores(): Record<string, number> {
  const saved = read<Record<string, number>>('scores');
  const out: Record<string, number> = {};
  for (const [id, n] of Object.entries(saved ?? {})) if (typeof n === 'number' && n >= 0) out[id] = n;
  return out;
}

/** 文章ごとの、さいごに読んだときの記録 (きろくの画面で使う) */
export function allProgress(): Record<string, Progress> {
  const out: Record<string, Progress> = {};
  for (const key of keys()) {
    if (!key.startsWith('progress:')) continue;
    const id = key.slice('progress:'.length);
    const p = loadProgress(id);
    if (p) out[id] = p;
  }
  return out;
}

// ---- スタンプ・ポイント・カード ----

/** スタンプが押された日の一覧 */
export function getStamps(): string[] {
  const saved = read<string[]>('stamps');
  return Array.isArray(saved) ? normalizeStamps(saved) : [];
}

/** その日のスタンプを押す。1 日に何回よんでも 1 個だけ */
export function addStamp(date: string): StampReward {
  const before = getStamps();
  const reward = rewardFor(before, date);
  if (reward.added) write('stamps', normalizeStamps([...before, date]));
  return reward;
}

/** 終えた今日のチャレンジ */
export function getClears(): string[] {
  const saved = read<string[]>('clears');
  return Array.isArray(saved) ? saved.filter((id) => typeof id === 'string') : [];
}

export function dailyDone(date: string): boolean {
  return getClears().includes(dailyClearId(date));
}

/** 今日のチャレンジを終えたことを記録する。もどり値は、今回もらえたポイント (2 回目からは 0) */
export function addDailyClear(date: string): number {
  const clears = getClears();
  const id = dailyClearId(date);
  if (clears.includes(id)) return 0;
  write('clears', [...clears, id].sort());
  return clearPoints(id);
}

export function getCards(): OwnedCard[] {
  const saved = read<OwnedCard[]>('cards');
  return Array.isArray(saved) ? saved.filter((c) => typeof c?.id === 'string' && c.paid >= 0) : [];
}

function getSpent(): Record<string, number> {
  const saved = read<Record<string, number>>('spent');
  const out: Record<string, number> = {};
  for (const [key, points] of Object.entries(saved ?? {})) if (typeof points === 'number' && points > 0) out[key] = points;
  return out;
}

/** 今つかえるポイント = 今日のチャレンジ・正解・スタンプでもらった分 − カードなどに使った分 */
export function balance(): number {
  return (
    getClears().reduce((sum, id) => sum + clearPoints(id), 0) +
    scorePoints(getScores()) +
    earnedPoints(getStamps()).total -
    getCards().reduce((sum, c) => sum + c.paid, 0) -
    Object.values(getSpent()).reduce((sum, n) => sum + n, 0)
  );
}

/** ポイントとカードを交換する。ポイントが足りないときや、もう持っているときは何もしない */
export function buyCard(card: { id: string; price: number }): boolean {
  const owned = getCards();
  if (owned.some((c) => c.id === card.id) || balance() < card.price) return false;
  write('cards', [...owned, { id: card.id, paid: card.price }]);
  return true;
}

/**
 * カードを値下げしたとき、前の高い値段で交換していた人に差額を返す。
 * 持っているカードの「払った額」を、今の値段まで下げる (上げることはしない)。何回よんでも結果は同じ。
 */
export function migrateCardPrices(cards: readonly { id: string; price: number }[]): void {
  const price = new Map(cards.map((c) => [c.id, c.price]));
  const owned = getCards();
  const adjusted = owned.map((c) => ({ ...c, paid: Math.min(c.paid, price.get(c.id) ?? c.paid) }));
  if (adjusted.some((c, i) => c.paid !== owned[i].paid)) write('cards', adjusted);
}

// ---- 記録をまるごと出し入れする (ログイン・Firestore との同期で使う) ----

/** 今の場所にある記録を、まるごと取り出す */
export function exportSnapshot(): Snapshot {
  const s = emptySnapshot();
  s.stamps = getStamps();
  s.clears = getClears().slice().sort();
  s.scores = getScores();
  s.cards = getCards();
  s.spent = getSpent();
  const sound = read<boolean>('sound');
  const at = read<number>('settings-at');
  s.settings = {
    grade: getGrade(),
    sound: typeof sound === 'boolean' ? sound : null,
    at: typeof at === 'number' ? at : 0,
  };
  s.progress = allProgress();
  return s;
}

/**
 * 今の場所の記録を、わたされた内容に入れかえる。
 * Firestore から取りこんだ結果を書くためのものなので、「書きかわった」という知らせは出さない。
 * keepProgress が true のときは、文章ごとの記録にはさわらない。
 */
export function importSnapshot(s: Snapshot, opts: { keepProgress?: boolean } = {}): void {
  muted = true;
  try {
    write('stamps', s.stamps);
    write('clears', s.clears);
    write('scores', s.scores);
    write('cards', s.cards);
    write('spent', s.spent);
    if (s.settings.grade !== null) write('grade', s.settings.grade);
    if (s.settings.sound !== null) write('sound', s.settings.sound);
    write('settings-at', s.settings.at);
    if (!opts.keepProgress) {
      for (const key of keys()) {
        if (key.startsWith('progress:') && !(key.slice('progress:'.length) in s.progress)) removeKey(prefix + key);
      }
      for (const [id, p] of Object.entries(s.progress)) write(`progress:${id}`, p);
    }
  } finally {
    muted = false;
  }
}

/** その人の記録 (uid が null ならログインなしの記録) を、この端末から消す */
export function clearStore(uid: string | null): void {
  const at = uid ? userPrefix(uid) : GUEST_PREFIX;
  for (const key of keys(at)) removeKey(at + key);
}
