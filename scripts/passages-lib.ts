// content/ に書いた文章と問題を読み、ふりがなを付けて、アプリで使う形にする。
// build-passages.ts (JSON を書き出す) と tests/passages.test.ts (中身の検査) の両方から使う。
//
// 書式 (1 ファイル 1 文章。くわしくは README の「文章を足す」):
//
//   id: g3-gon-1
//   title: ごんぎつね（一）
//   author: 新美南吉
//   source: aozora                 (自作なら original)
//   url: https://www.aozora.gr.jp/cards/000121/card628.html
//   genre: story
//   series: gon 1/3                (続きもののときだけ)
//   note: 一部をはぶいています       (なくてもよい)
//   ruby: 兵十=ひょうじゅう, 弥助=やすけ   (自動のふりがながまちがうときの読み。なくてもよい)
//   ---
//   本文 (1 行 1 段落。「## 」で始まる行は小見出し。ふりがなは {漢字|かんじ})
//   ---
//   ? reason
//   問題文
//   - まちがいの選択肢
//   * 正解の選択肢
//   - まちがいの選択肢
//   - まちがいの選択肢
//   > 本文の中の手がかり (本文にそのまま出てくる文字)
//   = 解説

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import kuromoji from 'kuromoji';
import { GENRES, QTYPES, countChars, plain, segments, type Genre, type Grade, type Passage, type QType, type Question } from '../src/core/reading';
import { isKanji, learnedBy } from '../src/data/kanji';

export const CONTENT_DIR = fileURLToPath(new URL('../content', import.meta.url));

export interface Draft {
  file: string;
  header: Record<string, string>;
  body: string[];
  questions: Question[];
}

/** content/ の 1 ファイルを読む。書式がまちがっていたら、ファイル名と行をそえて投げる */
export function parseFile(file: string, text: string): Draft {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const fail = (line: number, msg: string): never => {
    throw new Error(`${file}:${line + 1}: ${msg}`);
  };
  const header: Record<string, string> = {};
  let i = 0;
  for (; i < lines.length && lines[i].trim() !== '---'; i++) {
    if (!lines[i].trim()) continue;
    const m = lines[i].match(/^([a-z]+):\s*(.*)$/);
    if (!m) fail(i, `見出しの行は「名前: 値」の形にしてください`);
    header[m![1]] = m![2].trim();
  }
  if (i >= lines.length) fail(i, '「---」がありません');
  const body: string[] = [];
  for (i++; i < lines.length && lines[i].trim() !== '---'; i++) {
    const line = lines[i].trim();
    if (line) body.push(line);
  }
  if (i >= lines.length) fail(i, '本文のあとの「---」がありません');

  const questions: Question[] = [];
  let q: (Question & { line: number }) | null = null;
  const finish = () => {
    if (!q) return;
    if (!q.text) fail(q.line, '問題文がありません');
    if (q.choices.length !== 4) fail(q.line, `選択肢は 4 つにしてください (${q.choices.length} こ)`);
    if (q.answer < 0) fail(q.line, '正解の選択肢 (「* 」で始まる行) がありません');
    if (!q.evidence) fail(q.line, '手がかり (「> 」で始まる行) がありません');
    if (!q.explain) fail(q.line, '解説 (「= 」で始まる行) がありません');
    const { line: _line, ...rest } = q;
    questions.push(rest);
  };
  for (i++; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith('? ')) {
      finish();
      const type = line.slice(2).trim() as QType;
      if (!QTYPES.includes(type)) fail(i, `問題のタイプ「${type}」はありません (${QTYPES.join(', ')})`);
      q = { type, text: '', choices: [], answer: -1, evidence: '', explain: '', line: i };
      continue;
    }
    if (!q) fail(i, '問題は「? タイプ」の行から始めてください');
    const cur = q!;
    if (line.startsWith('- ') || line.startsWith('* ')) {
      if (line[0] === '*') {
        if (cur.answer >= 0) fail(i, '正解が 2 つあります');
        cur.answer = cur.choices.length;
      }
      cur.choices.push(line.slice(2).trim());
    } else if (line.startsWith('> ')) {
      cur.evidence = cur.evidence ? `${cur.evidence}\n${line.slice(2).trim()}` : line.slice(2).trim();
    } else if (line.startsWith('= ')) {
      cur.explain = cur.explain ? `${cur.explain}${line.slice(2).trim()}` : line.slice(2).trim();
    } else if (cur.choices.length === 0) {
      cur.text = cur.text ? `${cur.text}${line}` : line;
    } else {
      fail(i, `この行の意味が分かりません: ${line}`);
    }
  }
  finish();
  return { file, header, body, questions };
}

// ---- ふりがな ----

type Tokenizer = kuromoji.Tokenizer<kuromoji.IpadicFeatures>;
let tokenizerPromise: Promise<Tokenizer> | null = null;

export function getTokenizer(): Promise<Tokenizer> {
  tokenizerPromise ??= new Promise((resolve, reject) => {
    const dicPath = fileURLToPath(new URL('../node_modules/kuromoji/dict', import.meta.url));
    kuromoji.builder({ dicPath }).build((err, tokenizer) => (err ? reject(err) : resolve(tokenizer)));
  });
  return tokenizerPromise;
}

const toHiragana = (s: string) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const needsRuby = (s: string, grade: number) => [...s].some((ch) => isKanji(ch) && !learnedBy(ch, grade));
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 言葉 (surface) と、その読み (ひらがな) から、漢字の部分にだけふりがなを付ける。
 * 「食べる」「たべる」→「{食|た}べる」。合わせられないときは null
 */
export function alignRuby(surface: string, reading: string, grade: number): string | null {
  const runs = surface.match(/[\p{Script=Han}々]+|[^\p{Script=Han}々]+/gu) ?? [];
  const pattern = runs.map((r) => (isKanji(r[0]) ? '(.+?)' : escapeRe(toHiragana(r)))).join('');
  const m = toHiragana(reading).match(new RegExp(`^${pattern}$`, 'u'));
  if (!m) return null;
  let g = 1;
  return runs.map((r) => (isKanji(r[0]) ? (needsRuby(r, grade) ? `{${r}|${m[g++]}}` : (g++, r)) : r)).join('');
}

export interface RubyContext {
  grade: number;
  /** 読みが決まっている言葉 (原文のふりがなや、ruby: で書いたもの)。2 字以上のものだけ */
  known: Map<string, string>;
  warnings: string[];
}

/** まだふりがなのない部分に、その学年で習わない漢字のふりがなを付ける */
export function annotate(text: string, ctx: RubyContext, tokenizer: Tokenizer): string {
  return segments(text)
    .map((seg) => (seg.ruby ? `{${seg.text}|${seg.ruby}}` : annotatePlain(seg.text, ctx, tokenizer)))
    .join('');
}

function annotatePlain(text: string, ctx: RubyContext, tokenizer: Tokenizer): string {
  if (!needsRuby(text, ctx.grade)) return text;
  // 読みの決まっている言葉を先にあてはめる (長いものから)
  const bases = [...ctx.known.keys()].filter((b) => text.includes(b)).sort((a, b) => b.length - a.length);
  if (bases.length > 0) {
    const re = new RegExp(bases.map(escapeRe).join('|'), 'g');
    let out = '';
    let last = 0;
    for (const m of text.matchAll(re)) {
      out += annotateTokens(text.slice(last, m.index), ctx, tokenizer);
      // 送りがなをふくめて書いた読み (暖く=あたたかく) は、漢字の部分にだけふりがなを付ける
      const reading = ctx.known.get(m[0])!;
      out += needsRuby(m[0], ctx.grade) ? (alignRuby(m[0], reading, ctx.grade) ?? `{${m[0]}|${reading}}`) : m[0];
      last = m.index + m[0].length;
    }
    return out + annotateTokens(text.slice(last), ctx, tokenizer);
  }
  return annotateTokens(text, ctx, tokenizer);
}

function annotateTokens(text: string, ctx: RubyContext, tokenizer: Tokenizer): string {
  if (!needsRuby(text, ctx.grade)) return text;
  return tokenizer
    .tokenize(text)
    .map((t) => {
      if (!needsRuby(t.surface_form, ctx.grade)) return t.surface_form;
      const reading = t.reading && t.reading !== '*' ? t.reading : '';
      const ruby = reading ? alignRuby(t.surface_form, reading, ctx.grade) : null;
      if (ruby === null) {
        ctx.warnings.push(`読みが分かりません: ${t.surface_form} (${text})`);
        return t.surface_form;
      }
      return ruby;
    })
    .join('');
}

// ---- 文章 1 つを組み立てる ----

const GRADE_FROM_ID = /^g([1-6])-[a-z0-9-]+$/;

export async function buildPassage(draft: Draft, globalReadings: Map<string, string>): Promise<{ passage: Passage; warnings: string[] }> {
  const { header: h, file } = draft;
  const fail = (msg: string): never => {
    throw new Error(`${file}: ${msg}`);
  };
  for (const key of ['id', 'title', 'author', 'source', 'genre']) if (!h[key]) fail(`「${key}:」がありません`);
  const grade = Number(h.id.match(GRADE_FROM_ID)?.[1] ?? fail('id は「g学年-英小文字と数字」の形にしてください')) as Grade;
  if (!GENRES.includes(h.genre as Genre)) fail(`genre「${h.genre}」はありません (${GENRES.join(', ')})`);
  if (h.source !== 'aozora' && h.source !== 'original') fail('source は aozora か original にしてください');

  const known = new Map(globalReadings);
  for (const pair of (h.ruby ?? '').split(/[,、]\s*/).filter(Boolean)) {
    const [base, reading] = pair.split('=').map((s) => s.trim());
    if (!base || !reading) fail(`ruby: の「${pair}」は「漢字=よみ」の形にしてください`);
    known.set(base, reading);
  }
  // 原文のふりがな (2 字以上のもの) は、同じ言葉がまた出てきたときにも使う
  for (const para of draft.body) for (const seg of segments(para)) if (seg.ruby && seg.text.length >= 2 && !known.has(seg.text)) known.set(seg.text, seg.ruby);

  // 手がかりは、半角の空白で書いてもよい (分かち書きの原文が全角の空白でも、本文に合わせる)
  const plainParas = draft.body.map(plain);
  const fitEvidence = (evidence: string) =>
    evidence
      .split('\n')
      .map((line) => {
        if (plainParas.some((p) => p.includes(line))) return line;
        const wide = line.replace(/ /g, '　');
        return plainParas.some((p) => p.includes(wide)) ? wide : line;
      })
      .join('\n');

  const ctx: RubyContext = { grade, known, warnings: [] };
  const tokenizer = await getTokenizer();
  const ann = (s: string) => annotate(s, ctx, tokenizer);
  const body = draft.body.map(ann);
  const questions = draft.questions.map((q) => ({
    ...q,
    evidence: fitEvidence(q.evidence),
    text: ann(q.text),
    choices: q.choices.map(ann),
    explain: ann(q.explain),
  }));

  let series: Passage['series'];
  if (h.series) {
    const m = h.series.match(/^([a-z0-9-]+)\s+(\d+)\/(\d+)$/) ?? fail('series は「名前 番号/全部の数」の形にしてください (例: gon 1/3)');
    series = { id: `g${grade}-${m[1]}`, part: Number(m[2]), total: Number(m[3]) };
  }

  const passage: Passage = {
    id: h.id,
    grade,
    title: h.title,
    author: h.author,
    source: h.source as Passage['source'],
    ...(h.url ? { url: h.url } : {}),
    genre: h.genre as Genre,
    ...(series ? { series } : {}),
    ...(h.note ? { note: h.note } : {}),
    chars: countChars(body),
    qtypes: questions.map((q) => q.type),
    body,
    questions,
  };
  return { passage, warnings: ctx.warnings.map((w) => `${file}: ${w}`) };
}

/** content/readings.txt: どの文章でも使う読み (1 行に「漢字=よみ」) */
export function loadGlobalReadings(dir = CONTENT_DIR): Map<string, string> {
  const map = new Map<string, string>();
  let text = '';
  try {
    text = readFileSync(join(dir, 'readings.txt'), 'utf8');
  } catch {
    return map;
  }
  for (const line of text.split('\n')) {
    const s = line.replace(/#.*/, '').trim();
    if (!s) continue;
    const [base, reading] = s.split('=').map((x) => x.trim());
    if (base && reading) map.set(base, reading);
  }
  return map;
}

/** content/ の下の .txt (readings.txt をのぞく) をすべて */
export function contentFiles(dir = CONTENT_DIR): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.txt') && name !== 'readings.txt') out.push(p);
    }
  };
  walk(dir);
  return out;
}

export async function buildAll(dir = CONTENT_DIR): Promise<{ passages: Passage[]; warnings: string[] }> {
  const global = loadGlobalReadings(dir);
  const passages: Passage[] = [];
  const warnings: string[] = [];
  for (const file of contentFiles(dir)) {
    const rel = file.slice(dir.length + 1);
    const built = await buildPassage(parseFile(rel, readFileSync(file, 'utf8')), global);
    passages.push(built.passage);
    warnings.push(...built.warnings);
  }
  passages.sort((a, b) => a.grade - b.grade || (a.id < b.id ? -1 : 1));
  return { passages, warnings };
}

/** ふりがなのない本文 (検査用) */
export const plainBody = (p: Passage): string[] => p.body.map(plain);
