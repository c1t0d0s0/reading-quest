import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { GRADES, isHeading, plain, segments, type Passage } from '../src/core/reading';
import { kanjiBeyond } from '../src/data/kanji';
import { outputs } from '../scripts/build-passages';
import { buildAll } from '../scripts/passages-lib';

// content/ の文章と問題が、決まりどおりに書けているかを確かめる (文章を足したら npm test)

/** 学年ごとの本文の長さのめやす (字数。ふりがな・空白はのぞく) */
export const LENGTH: Record<number, [number, number]> = {
  1: [250, 850],
  2: [400, 1100],
  3: [700, 1650],
  4: [1000, 2200],
  5: [1300, 2900],
  6: [1600, 3900],
};
/** 学年ごとの、文章の数の下限 */
const MIN_PER_GRADE = 30;

let passages: Passage[] = [];
let warnings: string[] = [];

beforeAll(async () => {
  ({ passages, warnings } = await buildAll());
}, 60_000);

const each = (fn: (p: Passage) => void) => () => {
  for (const p of passages) fn(p);
};

describe('書き出した JSON', () => {
  it('content/ と合っている (合っていなければ npm run passages)', () => {
    for (const [name, text] of Object.entries(outputs(passages))) {
      const file = fileURLToPath(new URL(`../src/data/passages/${name}`, import.meta.url));
      expect(readFileSync(file, 'utf8') === text, `${name} が古い`).toBe(true);
    }
  });

  it('ふりがなの読みがすべて決まっている', () => {
    expect(warnings).toEqual([]);
  });
});

describe('文章', () => {
  it(`どの学年にも ${MIN_PER_GRADE} 以上ある`, () => {
    for (const g of GRADES) expect(passages.filter((p) => p.grade === g).length, `${g}年`).toBeGreaterThanOrEqual(MIN_PER_GRADE);
  });

  it('id が重ならない', () => {
    expect(new Set(passages.map((p) => p.id)).size).toBe(passages.length);
  });

  it('題名が重ならない (同じ学年の中で)', () => {
    for (const g of GRADES) {
      const titles = passages.filter((p) => p.grade === g).map((p) => p.title);
      expect(titles.filter((t, i) => titles.indexOf(t) !== i), `${g}年`).toEqual([]);
    }
  });

  it(
    '本文の長さが学年のめやすに入っている',
    each((p) => {
      const [min, max] = LENGTH[p.grade];
      expect(p.chars, `${p.id} (${p.chars}字)`).toBeGreaterThanOrEqual(min);
      expect(p.chars, `${p.id} (${p.chars}字)`).toBeLessThanOrEqual(max);
    }),
  );

  it(
    '青空文庫の文章には図書カードの URL があり、自作の文章にはない',
    each((p) => {
      if (p.source === 'aozora') expect(p.url, p.id).toMatch(/^https:\/\/www\.aozora\.gr\.jp\/cards\/\d+\/card\d+\.html$/);
      else {
        expect(p.url, p.id).toBeUndefined();
        expect(p.author, p.id).toBe('Reading Quest');
      }
    }),
  );

  it('続きものは 1 回目から順にそろっている', () => {
    const series = new Map<string, Passage[]>();
    for (const p of passages) if (p.series) series.set(p.series.id, [...(series.get(p.series.id) ?? []), p]);
    for (const [id, parts] of series) {
      const total = parts[0].series!.total;
      expect(parts.map((p) => p.series!.total), id).toEqual(parts.map(() => total));
      expect(parts.map((p) => p.series!.part).sort((a, b) => a - b), id).toEqual(Array.from({ length: total }, (_, i) => i + 1));
      expect(new Set(parts.map((p) => p.author)).size, id).toBe(1);
    }
  });

  it(
    'その学年で習わない漢字には、すべてふりがながある',
    each((p) => {
      const texts = [...p.body, ...p.questions.flatMap((q) => [q.text, ...q.choices, q.explain])];
      for (const t of texts) {
        const bare = segments(t)
          .filter((s) => !s.ruby)
          .map((s) => s.text)
          .join('');
        expect(kanjiBeyond(bare, p.grade), `${p.id}: ${plain(t).slice(0, 30)}`).toEqual([]);
      }
    }),
  );
});

describe('問題', () => {
  it(
    '1・2 年は 3〜5 問、3 年からは 5 問',
    each((p) => {
      if (p.grade <= 2) {
        expect(p.questions.length, p.id).toBeGreaterThanOrEqual(3);
        expect(p.questions.length, p.id).toBeLessThanOrEqual(5);
      } else expect(p.questions.length, p.id).toBe(5);
    }),
  );

  it(
    '選択肢は 4 つで、同じものがなく、正解が 1 つ',
    each((p) => {
      p.questions.forEach((q, i) => {
        expect(q.choices, `${p.id} 問${i + 1}`).toHaveLength(4);
        expect(new Set(q.choices.map(plain)).size, `${p.id} 問${i + 1}`).toBe(4);
        expect(q.answer, `${p.id} 問${i + 1}`).toBeGreaterThanOrEqual(0);
        expect(q.answer, `${p.id} 問${i + 1}`).toBeLessThan(4);
      });
    }),
  );

  it(
    '手がかりの文字が、本文の 1 つの段落にそのまま出てくる',
    each((p) => {
      const paras = p.body.filter((b) => !isHeading(b)).map(plain);
      p.questions.forEach((q, i) => {
        for (const line of q.evidence.split('\n')) {
          expect(
            paras.some((para) => para.includes(line)),
            `${p.id} 問${i + 1}: 「${line}」が本文にない`,
          ).toBe(true);
        }
      });
    }),
  );

  it(
    '同じ文章の中で、問題文が重ならない',
    each((p) => {
      const texts = p.questions.map((q) => plain(q.text));
      expect(new Set(texts).size, p.id).toBe(texts.length);
    }),
  );

  it('正解が「いちばん長い選択肢」や「いちばん短い選択肢」ばかりにならない (長さで当てられないように)', () => {
    for (const g of GRADES) {
      const qs = passages.filter((p) => p.grade === g).flatMap((p) => p.questions);
      if (qs.length === 0) continue;
      const only = (pick: (lens: number[]) => number) =>
        qs.filter((q) => {
          const lens = q.choices.map((c) => plain(c).length);
          return lens[q.answer] === pick(lens) && lens.filter((n) => n === lens[q.answer]).length === 1;
        }).length;
      // 4 つの中からでたらめに決まるなら 25% くらいになる
      const longest = only((lens) => Math.max(...lens));
      const shortest = only((lens) => Math.min(...lens));
      expect(longest / qs.length, `${g}年 いちばん長い: ${longest}/${qs.length}`).toBeLessThanOrEqual(0.35);
      expect(shortest / qs.length, `${g}年 いちばん短い: ${shortest}/${qs.length}`).toBeLessThanOrEqual(0.35);
    }
  });

  it('問題のタイプがかたよらない (学年ごとに、5 種類以上のタイプがある)', () => {
    for (const g of GRADES) {
      const types = new Set(passages.filter((p) => p.grade === g).flatMap((p) => p.qtypes));
      if (types.size === 0) continue;
      expect(types.size, `${g}年`).toBeGreaterThanOrEqual(5);
    }
  });
});
