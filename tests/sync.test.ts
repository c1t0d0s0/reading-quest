import { beforeEach, describe, expect, it } from 'vitest';
import { Sync, type AuthPort, type Remote, type SyncHooks } from '../src/cloud/sync';
import { addDays, jstDate } from '../src/core/date';
import { mergeSnapshots } from '../src/core/merge';
import { emptySnapshot, type Progress, type Snapshot } from '../src/core/snapshot';
import {
  addDailyClear,
  addStamp,
  answer,
  balance,
  buyCard,
  currentUid,
  getCards,
  getClears,
  getGrade,
  getScores,
  getStamps,
  onStorageChange,
  rememberedUid,
  saveProgress,
  setGrade,
  startTry,
  statusOf,
  useStore,
} from '../src/core/storage';
import { CARDS } from '../src/data/cards';

// ---- 代用品 ----

/** 端末ごとの localStorage。current を入れかえると、別の端末になる */
let current = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => current.get(k) ?? null,
    setItem: (k: string, v: string) => void current.set(k, v),
    removeItem: (k: string) => void current.delete(k),
    key: (i: number) => [...current.keys()][i] ?? null,
    get length() {
      return current.size;
    },
  },
});

/** メモリ上の Firestore。fail を true にすると、通信できない状態になる */
class FakeCloud implements Remote {
  data = new Map<string, Snapshot>();
  fail = false;
  writes = 0;
  reads = 0;
  private check() {
    if (this.fail) throw new Error('offline');
  }
  private copy<T>(v: T): T {
    return JSON.parse(JSON.stringify(v)) as T;
  }
  async loadAll(uid: string) {
    this.check();
    this.reads++;
    const s = this.data.get(uid);
    return s ? this.copy(s) : null;
  }
  async loadSummary(uid: string) {
    this.check();
    this.reads++;
    const s = this.data.get(uid);
    return s ? { ...this.copy(s), progress: {} } : null;
  }
  async saveSummary(uid: string, snapshot: Snapshot) {
    this.check();
    this.writes++;
    const old = this.data.get(uid);
    this.data.set(uid, { ...this.copy(snapshot), progress: old?.progress ?? {} });
  }
  async saveProgress(uid: string, id: string, progress: Snapshot['progress'][string]) {
    this.check();
    this.writes++;
    const s = this.data.get(uid) ?? emptySnapshot();
    s.progress[id] = this.copy(progress);
    this.data.set(uid, s);
  }
  async deleteProgress(uid: string, id: string) {
    this.check();
    this.writes++;
    delete this.data.get(uid)?.progress[id];
  }
}

class FakeAuth implements AuthPort {
  private cb: (uid: string | null) => void = () => {};
  nextUid = 'alice';
  onUser(cb: (uid: string | null) => void) {
    this.cb = cb;
  }
  /** ページを開いたときに、ログインの状態が分かる */
  resolve(uid: string | null) {
    this.cb(uid);
  }
  async signIn() {
    this.cb(this.nextUid);
  }
  async signOut() {
    this.cb(null);
  }
}

interface Device {
  storage: Map<string, string>;
  auth: FakeAuth;
  sync: Sync;
  asked: number;
  dataChanged: number;
  answer: boolean;
}

function makeDevice(cloud: FakeCloud): Device {
  const d = { storage: new Map<string, string>(), auth: new FakeAuth(), asked: 0, dataChanged: 0, answer: true } as Device;
  const hooks: SyncHooks = {
    onStatus: () => {},
    onData: () => void d.dataChanged++,
    askMigrate: () => {
      d.asked++;
      return d.answer;
    },
  };
  d.sync = new Sync(cloud, d.auth, hooks, { debounceMs: 60_000, retryMs: 60_000 });
  return d;
}

/** その端末を手に取る (localStorage と、記録の場所と、書きかえの知らせ先を切りかえる) */
function use(d: Device): void {
  current = d.storage;
  useStore(d.sync.uid);
  d.sync.attach();
}

const done: Progress = { answers: [0, 1], ok: [true, false], done: true, tries: 0 };
const playing: Progress = { answers: [2, null], ok: [true, null], done: false, tries: 0 };
const today = jstDate();
const daysBefore = (n: number) => Array.from({ length: n }, (_, i) => addDays(today, -i));

/** 5 問の文章を読み終える。はじめの correct 問が正解 */
function read(id: string, correct: number): number {
  let p = startTry(id, 5);
  let points = 0;
  for (let i = 0; i < 5; i++) {
    const r = answer(id, p, i, i < correct ? 0 : 1, i < correct);
    p = r.progress;
    points += r.points;
  }
  return points;
}

let cloud: FakeCloud;
let a: Device;

beforeEach(() => {
  cloud = new FakeCloud();
  a = makeDevice(cloud);
  onStorageChange(null);
  use(a);
  a.sync.start();
});

describe('ログインしない人', () => {
  it('この端末だけに記録される (Firestore には何も送らない)', async () => {
    a.auth.resolve(null);
    await a.sync.flush();
    expect(a.sync.status).toBe('signed-out');
    addStamp(today);
    addDailyClear(today);
    read('g4-a', 5);
    await a.sync.flush();
    expect(cloud.writes).toBe(0);
    expect(cloud.reads).toBe(0);
    expect(a.sync.hasPending()).toBe(false);
    expect(currentUid()).toBeNull();
    expect(a.storage.has('readingquest:v1:stamps')).toBe(true);
    expect(balance()).toBe(20 + 20);
  });
});

describe('ログインして記録をうつす', () => {
  beforeEach(async () => {
    a.auth.resolve(null);
    await a.sync.flush();
    // ログインなしで読んだ記録
    for (const d of daysBefore(7)) {
      addStamp(d);
      addDailyClear(d);
    }
    read('g4-a', 5);
    read('g4-b', 3);
    saveProgress('g4-c', playing);
    expect(balance()).toBe(1000 + 7 * 20 + 32);
    expect(buyCard(CARDS[0])).toBe(true); // 40pt
  });

  it('「うつす」をえらぶと、Firestore に入り、端末のログインなしの記録は消える', async () => {
    await a.sync.signIn();
    await a.sync.flush();
    expect(a.asked).toBe(1);
    expect(a.sync.status).toBe('synced');
    expect(a.sync.uid).toBe('alice');

    const remote = cloud.data.get('alice')!;
    expect(remote.stamps).toHaveLength(7);
    expect(remote.clears).toHaveLength(7);
    expect(remote.scores).toEqual({ 'g4-a': 5, 'g4-b': 3 });
    expect(remote.cards).toEqual([{ id: 'rq01', paid: 40 }]);
    expect(remote.progress['g4-a'].done).toBe(true);
    expect(remote.progress['g4-c'].answers).toEqual([2, null]);

    // 画面は、その人の記録を見ている
    expect(currentUid()).toBe('alice');
    expect(balance()).toBe(1000 + 140 + 32 - 40);
    expect(statusOf('g4-a')).toBe('done');
    expect(statusOf('g4-c')).toBe('playing');
    // ログインなしの記録は残っていない (もう一度ログインしても、二重にうつらない)
    expect([...a.storage.keys()].filter((k) => k.startsWith('readingquest:v1:'))).toEqual([]);
    expect(rememberedUid()).toBe('alice');
  });

  it('「うつさない」をえらぶと、端末の記録はそのままで、アカウントの記録だけになる', async () => {
    a.answer = false;
    await a.sync.signIn();
    await a.sync.flush();
    expect(a.asked).toBe(1);
    expect(currentUid()).toBe('alice');
    expect(getStamps()).toEqual([]);
    expect(balance()).toBe(0);
    expect(cloud.data.get('alice')?.stamps ?? []).toEqual([]);
    // ログアウトすると、ログインなしの記録にもどる
    expect(await a.sync.signOut()).toBe('ok');
    await a.sync.flush();
    expect(currentUid()).toBeNull();
    expect(getStamps()).toHaveLength(7);
    expect(balance()).toBe(1000 + 140 + 32 - 40);
  });

  it('アカウントにすでに記録があるときは、両方を合わせる', async () => {
    cloud.data.set('alice', {
      ...emptySnapshot(),
      stamps: [addDays(today, -7), addDays(today, -8)],
      scores: { 'g4-a': 2, 'g4-d': 4 },
      cards: [{ id: 'rq02', paid: 80 }],
    });
    await a.sync.signIn();
    await a.sync.flush();
    expect(getStamps()).toHaveLength(9);
    // 同じ文章を両方で「はじめて」解いていたら、少ないほう
    expect(getScores()).toEqual({ 'g4-a': 2, 'g4-b': 3, 'g4-d': 4 });
    expect(getCards().map((c) => c.id).sort()).toEqual(['rq01', 'rq02']);
    // 9 日連続で 1000pt、今日のチャレンジ 7 回、正解 (2 + 3 + 4) × 4、カードに 40 + 80
    expect(balance()).toBe(1000 + 140 + 36 - 120);
    expect(cloud.data.get('alice')!.stamps).toHaveLength(9);
  });

  it('ページを開き直したとき (ログインが続いているとき) は、うつすかどうかを聞かない', async () => {
    a.answer = false;
    await a.sync.signIn();
    await a.sync.flush();
    expect(a.asked).toBe(1);
    // 同じ端末でページを開き直す: ログインの状態が、ボタンをおさずに分かる
    const again = makeDevice(cloud);
    again.storage = a.storage;
    use(again);
    useStore(rememberedUid()); // main.ts の restoreStore と同じ
    again.sync.start();
    again.auth.resolve('alice');
    await again.sync.flush();
    expect(again.asked).toBe(0);
    expect(again.sync.status).toBe('synced');
    // 写しがそのまま使われるので、画面のかき直しは起きない
    expect(again.dataChanged).toBe(0);
  });
});

describe('ブラウザを変えても記録が続く', () => {
  it('端末 A で読んだ記録が、端末 B でログインすると出てくる', async () => {
    await a.sync.signIn();
    await a.sync.flush();
    for (const d of daysBefore(7)) addStamp(d);
    addDailyClear(today);
    saveProgress('g3-x', playing);
    setGrade(3);
    expect(buyCard(CARDS[1])).toBe(true); // 80pt
    expect(a.sync.status).toBe('syncing');
    await a.sync.flush();
    expect(a.sync.status).toBe('synced');
    const onA = balance();

    const b = makeDevice(cloud);
    use(b);
    b.sync.start();
    b.auth.resolve(null);
    await b.sync.flush();
    expect(getStamps()).toEqual([]);
    await b.sync.signIn();
    await b.sync.flush();
    expect(b.asked).toBe(0); // B にはログインなしの記録がないので、聞かれない
    expect(getStamps()).toHaveLength(7);
    expect(balance()).toBe(onA);
    expect(getCards()).toEqual([{ id: 'rq02', paid: 80 }]);
    expect(statusOf('g3-x')).toBe('playing');
    expect(getGrade()).toBe(3);
    expect(b.dataChanged).toBeGreaterThan(0);
  });

  it('2 台で別々に読んでも、どちらの記録も残る', async () => {
    await a.sync.signIn();
    await a.sync.flush();
    const b = makeDevice(cloud);
    use(b);
    b.sync.start();
    await b.sync.signIn();
    await b.sync.flush();

    // B で文章を 2 つ読む
    expect(read('g4-b', 4)).toBe(16);
    expect(read('g4-c', 5)).toBe(20);
    // その間に、A で別の文章を読み、今日のチャレンジを終える (まだ B の変更を知らない)
    use(a);
    read('g4-a', 3);
    addDailyClear(today);
    addStamp(today);
    await a.sync.flush();
    use(b);
    await b.sync.flush();

    // B は、送るときに A の分を取りこんでいる
    expect(getScores()).toEqual({ 'g4-a': 3, 'g4-b': 4, 'g4-c': 5 });
    expect(getStamps()).toEqual([today]);
    expect(balance()).toBe(12 + 16 + 20 + 20);
    const remote = cloud.data.get('alice')!;
    expect(remote.scores).toEqual({ 'g4-a': 3, 'g4-b': 4, 'g4-c': 5 });
    expect(Object.keys(remote.progress).sort()).toEqual(['g4-a', 'g4-b', 'g4-c']);

    // A は、次に何かを送ったときに B の分を取りこむ
    use(a);
    expect(getScores()).toEqual({ 'g4-a': 3 });
    setGrade(5);
    await a.sync.flush();
    expect(getScores()).toEqual({ 'g4-a': 3, 'g4-b': 4, 'g4-c': 5 });
    expect(balance()).toBe(12 + 16 + 20 + 20);
  });

  it('同じ文章を 2 台で読み直したら、あとで読み直したほうが残る', async () => {
    await a.sync.signIn();
    await a.sync.flush();
    read('g4-a', 2);
    await a.sync.flush();
    const b = makeDevice(cloud);
    use(b);
    b.sync.start();
    await b.sync.signIn();
    await b.sync.flush();
    read('g4-a', 5); // B で読み直し (2 回目)
    await b.sync.flush();
    use(a);
    setGrade(4);
    await a.sync.flush();
    // まとめを送るときには、文章ごとの記録は取りこまない。ログインし直すと取りこむ
    await a.sync.signOut();
    await a.sync.flush();
    await a.sync.signIn();
    await a.sync.flush();
    expect(cloud.data.get('alice')!.progress['g4-a'].tries).toBe(1);
    expect(cloud.data.get('alice')!.progress['g4-a'].ok).toEqual([true, true, true, true, true]);
    // ポイントは、はじめて解いたときの分だけ
    expect(getScores()).toEqual({ 'g4-a': 2 });
  });
});

describe('通信できないとき', () => {
  it('手元の写しで読めて、つながったら送る', async () => {
    await a.sync.signIn();
    await a.sync.flush();
    cloud.fail = true;
    addStamp(today);
    addDailyClear(today);
    read('g4-a', 5);
    await a.sync.flush();
    expect(a.sync.status).toBe('offline');
    expect(a.sync.hasPending()).toBe(true);
    expect(balance()).toBe(40); // 手元では進んでいる
    expect(cloud.data.get('alice')?.clears ?? []).toEqual([]);

    cloud.fail = false;
    await a.sync.flush();
    expect(a.sync.status).toBe('synced');
    expect(a.sync.hasPending()).toBe(false);
    expect(cloud.data.get('alice')!.clears).toEqual([`daily-${today}`]);
    expect(cloud.data.get('alice')!.progress['g4-a'].done).toBe(true);
  });

  it('ログインした直後に通信できなくても、あとで記録がうつる (うつす前に、端末の記録は消さない)', async () => {
    a.auth.resolve(null);
    await a.sync.flush();
    read('g4-a', 1);
    read('g4-b', 2);
    cloud.fail = true;
    await a.sync.signIn();
    await a.sync.flush();
    expect(a.sync.status).toBe('offline');
    expect(a.storage.has('readingquest:v1:scores')).toBe(true); // まだ消していない
    cloud.fail = false;
    await a.sync.flush();
    expect(a.sync.status).toBe('synced');
    expect(cloud.data.get('alice')!.scores).toEqual({ 'g4-a': 1, 'g4-b': 2 });
    expect(getScores()).toEqual({ 'g4-a': 1, 'g4-b': 2 });
    expect(a.storage.has('readingquest:v1:scores')).toBe(false);
  });
});

describe('ログアウト', () => {
  it('この端末から、その人の写しが消える', async () => {
    await a.sync.signIn();
    await a.sync.flush();
    addDailyClear(today);
    saveProgress('g4-a', done);
    expect(await a.sync.signOut()).toBe('ok');
    await a.sync.flush();
    expect(a.sync.status).toBe('signed-out');
    expect(currentUid()).toBeNull();
    expect(rememberedUid()).toBeNull();
    expect([...a.storage.keys()].filter((k) => k.startsWith('readingquest:u:'))).toEqual([]);
    expect(getClears()).toEqual([]);
    // 送ってからログアウトしているので、Firestore には残っている
    expect(cloud.data.get('alice')!.clears).toEqual([`daily-${today}`]);
  });

  it('送れていない変更があるときは、たしかめてからでないとログアウトしない', async () => {
    await a.sync.signIn();
    await a.sync.flush();
    cloud.fail = true;
    addDailyClear(today);
    expect(await a.sync.signOut()).toBe('unsynced');
    expect(a.sync.uid).toBe('alice');
    expect(getClears()).toEqual([`daily-${today}`]); // まだ手元にある
    expect(await a.sync.signOut(true)).toBe('ok');
    await a.sync.flush();
    expect(currentUid()).toBeNull();
  });

  it('別の人がログインしても、前の人の記録は見えない', async () => {
    await a.sync.signIn();
    await a.sync.flush();
    addDailyClear(today);
    await a.sync.signOut();
    await a.sync.flush();
    a.auth.nextUid = 'bob';
    await a.sync.signIn();
    await a.sync.flush();
    expect(currentUid()).toBe('bob');
    expect(getClears()).toEqual([]);
    expect(cloud.data.get('alice')!.clears).toEqual([`daily-${today}`]);
    expect(cloud.data.get('bob')?.clears ?? []).toEqual([]);
  });
});

it('代用品の合わせ方が、本物の決まりと同じであること', () => {
  // FakeCloud は「書かれたものをそのまま持つ」だけで、合わせる処理は Sync の側にある
  const x = { ...emptySnapshot(), clears: ['a'] };
  const y = { ...emptySnapshot(), clears: ['b'] };
  expect(mergeSnapshots(x, y).clears).toEqual(['a', 'b']);
});
