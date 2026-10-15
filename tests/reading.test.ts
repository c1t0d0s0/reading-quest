import { describe, expect, it } from 'vitest';
import { choiceOrder, countChars, plain, score, segments } from '../src/core/reading';
import { recommend, typeStats, weakest } from '../src/core/stats';
import { alignRuby, parseFile } from '../scripts/passages-lib';
import { rubyHtml, tcyHtml } from '../src/ui/dom';
import type { PassageMeta } from '../src/core/reading';

describe('たて書きの半角英数字', () => {
  it('1〜2 文字だけを 1 字分に立てる。3 文字以上はそのまま', () => {
    expect(tcyHtml('N極とS極')).toBe('<span class="tcy">N</span>極と<span class="tcy">S</span>極');
    expect(tcyHtml('8の字、12月')).toBe('<span class="tcy">8</span>の字、<span class="tcy">12</span>月');
    expect(tcyHtml('2014年の RESTAURANT')).toBe('2014年の RESTAURANT');
  });

  it('HTML の特別な文字は、包む前にこわさない', () => {
    expect(tcyHtml('A&B "C"')).toBe('<span class="tcy">A</span>&amp;<span class="tcy">B</span> &quot;<span class="tcy">C</span>&quot;');
  });

  it('ふりがなの中はさわらない。横書き用 (upright なし) は今までどおり', () => {
    expect(rubyHtml('{磁石|じしゃく}のN', true)).toBe('<ruby>磁石<rt>じしゃく</rt></ruby>の<span class="tcy">N</span>');
    expect(rubyHtml('{磁石|じしゃく}のN')).toBe('<ruby>磁石<rt>じしゃく</rt></ruby>のN');
  });
});

describe('ふりがな', () => {
  it('{漢字|かんじ} を分ける', () => {
    expect(segments('むかし{狐|きつね}が いた')).toEqual([{ text: 'むかし' }, { text: '狐', ruby: 'きつね' }, { text: 'が いた' }]);
    expect(plain('{小狐|こぎつね}の{穴|あな}')).toBe('小狐の穴');
    expect(countChars(['## 一', '{狐|きつね}が いた。'])).toBe(5);
  });

  it('読みを、漢字の部分にだけ付ける', () => {
    expect(alignRuby('食べる', 'タベル', 1)).toBe('{食|た}べる');
    expect(alignRuby('取り組む', 'トリクム', 1)).toBe('{取|と}り{組|く}む');
    expect(alignRuby('取り組む', 'トリクム', 2)).toBe('{取|と}り組む'); // 組は 2 年で習う
    expect(alignRuby('狐', 'キツネ', 6)).toBe('{狐|きつね}');
    expect(alignRuby('食べる', 'ノム', 1)).toBeNull();
  });
});

describe('選択肢の順番', () => {
  it('同じ seed なら同じ順番。4 つの並べかえになっている', () => {
    expect(choiceOrder('g4-a:0', 1)).toEqual(choiceOrder('g4-a:0', 1));
    expect([...choiceOrder('g4-a:0', 1)].sort()).toEqual([0, 1, 2, 3]);
  });

  it('読み直すたびに (seed が変わると) 正解の位置が変わりやすい', () => {
    const positions = Array.from({ length: 200 }, (_, t) => choiceOrder(`g4-a:${t}`, 0).indexOf(0));
    const counts = [0, 1, 2, 3].map((i) => positions.filter((p) => p === i).length);
    for (const n of counts) expect(n).toBeGreaterThan(30);
  });

  it('正解の数を数える', () => {
    const q = { type: 'content' as const, text: '', choices: ['a', 'b', 'c', 'd'], evidence: '', explain: '' };
    expect(score({ questions: [{ ...q, answer: 1 }, { ...q, answer: 2 }] }, [1, 0])).toBe(1);
  });
});

describe('content/ の書式', () => {
  const ok = `id: g1-test
title: テスト
author: Reading Quest
source: original
genre: story
---
いぬが はしった。
---
? content
だれが はしりましたか。
* いぬ
- ねこ
- とり
- うし
> いぬが はしった。
= いぬと 書いてあります。
`;

  it('読める', () => {
    const d = parseFile('x.txt', ok);
    expect(d.header.id).toBe('g1-test');
    expect(d.body).toEqual(['いぬが はしった。']);
    expect(d.questions).toEqual([
      { type: 'content', text: 'だれが はしりましたか。', choices: ['いぬ', 'ねこ', 'とり', 'うし'], answer: 0, evidence: 'いぬが はしった。', explain: 'いぬと 書いてあります。' },
    ]);
  });

  it('まちがいがあれば、ファイル名と行を知らせる', () => {
    expect(() => parseFile('x.txt', ok.replace('- うし\n', ''))).toThrow(/x\.txt:\d+: 選択肢は 4 つ/);
    expect(() => parseFile('x.txt', ok.replace('* いぬ', '- いぬ'))).toThrow(/正解/);
    expect(() => parseFile('x.txt', ok.replace('? content', '? unknown'))).toThrow(/タイプ「unknown」/);
    expect(() => parseFile('x.txt', ok.replace('> いぬが はしった。\n', ''))).toThrow(/手がかり/);
  });
});

describe('苦手なタイプとおすすめ', () => {
  const m = (id: string, qtypes: PassageMeta['qtypes'], extra: Partial<PassageMeta> = {}): PassageMeta => ({
    id,
    grade: 3,
    title: id,
    author: 'Reading Quest',
    source: 'original',
    genre: 'story',
    chars: 900,
    qtypes,
    ...extra,
  });
  const metas = [
    m('g3-a', ['content', 'reason', 'reason', 'feeling', 'vocab']),
    m('g3-b', ['content', 'content', 'feeling', 'feeling', 'vocab']),
    m('g3-c', ['reason', 'reason', 'reason', 'content', 'vocab']),
    m('g3-s1', ['content', 'content', 'content', 'content', 'content'], { series: { id: 'g3-s', part: 1, total: 2 } }),
    m('g3-s2', ['content', 'content', 'content', 'content', 'content'], { series: { id: 'g3-s', part: 2, total: 2 } }),
  ];
  const byId = (id: string) => metas.find((x) => x.id === id);

  it('タイプごとに正答率を数え、7 割より低いいちばん苦手なタイプを見つける', () => {
    const stats = typeStats(
      {
        'g3-a': { answers: [0, 1, 1, 0, 0], ok: [true, false, false, true, true], done: true, tries: 0 },
        'g3-b': { answers: [0, 0, 0, 0, 0], ok: [true, true, true, true, true], done: true, tries: 0 },
        'g3-c': { answers: [1, 0, 1, null, null], ok: [false, true, false, null, null], done: false, tries: 0 },
      },
      byId,
    );
    const reason = stats.find((s) => s.type === 'reason')!;
    expect(reason).toEqual({ type: 'reason', answered: 5, correct: 1 });
    expect(weakest(stats)?.type).toBe('reason');
  });

  it('続きものの次の回 → 苦手なタイプが多い文章 → まだ読んでいない文章 の順にすすめる', () => {
    const read = new Set(['g3-s1']);
    expect(recommend(metas, 3, (id) => read.has(id), 'reason')?.id).toBe('g3-s2');
    read.add('g3-s2');
    expect(recommend(metas, 3, (id) => read.has(id), 'reason')?.id).toBe('g3-c');
    expect(recommend(metas, 3, (id) => read.has(id), undefined)?.id).toBe('g3-a');
    expect(recommend(metas, 3, () => true, undefined)).toBeUndefined();
    // 前の回を読んでいない続きものは、2 回目からはすすめない
    expect(recommend([metas[4]], 3, () => false, undefined)).toBeUndefined();
  });
});
