import { rngFromString, shuffle } from './rng';

export type Grade = 1 | 2 | 3 | 4 | 5 | 6;
export const GRADES: readonly Grade[] = [1, 2, 3, 4, 5, 6];

/** 物語・説明文・随筆・昔話・伝記・詩 */
export type Genre = 'story' | 'explain' | 'essay' | 'folktale' | 'biography' | 'poem';
export const GENRES: readonly Genre[] = ['story', 'folktale', 'explain', 'essay', 'biography', 'poem'];

/**
 * 問題のタイプ。苦手なタイプを見つけるために、きろくの画面でタイプごとの正答率を出す。
 * content: 書いてあること / reason: わけ / feeling: 気持ち / reference: 「それ」などがさすもの /
 * vocab: 言葉の意味 / connective: つなぎ言葉 / expression: たとえ・表現 / main-idea: いちばん言いたいこと・主題 /
 * structure: 段落・組み立て・順序
 */
export type QType = 'content' | 'reason' | 'feeling' | 'reference' | 'vocab' | 'connective' | 'expression' | 'main-idea' | 'structure';
export const QTYPES: readonly QType[] = ['content', 'reason', 'feeling', 'reference', 'vocab', 'connective', 'expression', 'main-idea', 'structure'];

export interface Question {
  type: QType;
  /** 問題文。ふりがなは {漢字|かんじ} */
  text: string;
  /** 選択肢 4 つ。画面に出すときは順番を入れかえる (choiceOrder) */
  choices: string[];
  /** 正解の選択肢の番号 (choices の中の位置) */
  answer: number;
  /** 答えの手がかりになる本文の部分 (ふりがなをのぞいた本文に、そのまま出てくる)。答えたあとで本文に色をつける */
  evidence: string;
  /** 解説 */
  explain: string;
}

export interface PassageMeta {
  id: string;
  grade: Grade;
  title: string;
  author: string;
  source: 'aozora' | 'original';
  /** 青空文庫の図書カード */
  url?: string;
  genre: Genre;
  /** 長い作品を分けたもの。id が同じものは 1 つの作品 */
  series?: { id: string; part: number; total: number };
  /** 「一部をはぶいています」など、出典についてのことわり */
  note?: string;
  /** 本文の字数 (ふりがなをのぞく) */
  chars: number;
  /** 問題のタイプ (問題の順) */
  qtypes: QType[];
}

export interface Passage extends PassageMeta {
  /** 1 段落 1 つ。「## 」で始まるものは小見出し */
  body: string[];
  questions: Question[];
}

// ---- ふりがな ----

export interface Segment {
  text: string;
  ruby?: string;
}

const RUBY = /\{([^|{}]+)\|([^|{}]+)\}/g;

/** {漢字|かんじ} をふくむ文字列を、ふりがなのある部分とない部分に分ける */
export function segments(s: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of s.matchAll(RUBY)) {
    if (m.index > last) out.push({ text: s.slice(last, m.index) });
    out.push({ text: m[1], ruby: m[2] });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
  return out;
}

/** ふりがなをのぞいた文字列 */
export const plain = (s: string): string => s.replace(RUBY, '$1');

export const isHeading = (para: string): boolean => para.startsWith('## ');

/** 本文の字数 (小見出しと、ふりがなと、分かち書きの空白をのぞく) */
export function countChars(body: readonly string[]): number {
  return body.filter((p) => !isHeading(p)).reduce((sum, p) => sum + plain(p).replace(/[\s　]/g, '').length, 0);
}

// ---- 選択肢の順番 ----

/**
 * 画面に出す選択肢の順番 (choices の番号のならび)。seed が同じなら同じ順番。
 * 同じ文章を読み直したときは seed が変わるので、正解の位置も変わる。
 */
export function choiceOrder(seed: string, questionIndex: number, count = 4): number[] {
  return shuffle(
    Array.from({ length: count }, (_, i) => i),
    rngFromString(`${seed}#${questionIndex}`),
  );
}

// ---- 採点 ----

/** 正解の数 */
export function score(p: Pick<Passage, 'questions'>, answers: readonly (number | null)[]): number {
  return p.questions.reduce((n, q, i) => n + (answers[i] === q.answer ? 1 : 0), 0);
}
