// content/ の文章と問題から、アプリが読む JSON を作る。
//
//   npm run passages            src/data/passages/ に書き出す
//   npm run passages -- --check 書き出したものが content/ と合っているかだけを確かめる
//
// 書き出すもの:
//   src/data/passages/index.json  全部の文章の一覧 (題名・学年・字数など。本文はふくまない)
//   src/data/passages/g1.json〜g6.json  学年ごとの本文と問題 (その学年の文章を開いたときに読みこむ)

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Passage, PassageMeta } from '../src/core/reading';
import { buildAll } from './passages-lib';

const OUT = fileURLToPath(new URL('../src/data/passages/', import.meta.url));

export function outputs(passages: Passage[]): Record<string, string> {
  const meta: PassageMeta[] = passages.map(({ body: _b, questions: _q, ...m }) => m);
  const files: Record<string, string> = { 'index.json': `${JSON.stringify(meta, null, 1)}\n` };
  for (let g = 1; g <= 6; g++) {
    files[`g${g}.json`] = `${JSON.stringify(passages.filter((p) => p.grade === g))}\n`;
  }
  return files;
}

async function main(): Promise<void> {
  const check = process.argv.includes('--check');
  const { passages, warnings } = await buildAll();
  for (const w of warnings) console.warn(w);
  const files = outputs(passages);
  if (check) {
    const stale = Object.entries(files).filter(([name, text]) => {
      try {
        return readFileSync(OUT + name, 'utf8') !== text;
      } catch {
        return true;
      }
    });
    if (stale.length) {
      console.error(`content/ と合っていません。npm run passages を実行してください: ${stale.map(([n]) => n).join(', ')}`);
      process.exit(1);
    }
    console.log('content/ と合っています');
    return;
  }
  mkdirSync(OUT, { recursive: true });
  for (const [name, text] of Object.entries(files)) writeFileSync(OUT + name, text);
  const perGrade = [1, 2, 3, 4, 5, 6].map((g) => passages.filter((p) => p.grade === g).length);
  console.log(`${passages.length} 文章 (学年ごと: ${perGrade.join(' / ')})、問題 ${passages.reduce((n, p) => n + p.questions.length, 0)} 問`);
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
