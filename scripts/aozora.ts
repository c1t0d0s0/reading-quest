// 青空文庫の作品を、このアプリの文章の下書きにする。
//
//   npm run aozora -- https://www.aozora.gr.jp/cards/000121/card628.html > draft.txt
//
// 図書カードの URL をわたすと、XHTML 版の本文を取ってきて、
// - ふりがな <ruby> を {漢字|かんじ} の形に
// - 見出しを「## 一」の行に
// - 傍点などのかざりははずして、ただの文字に
// して、1 段落 1 行で書き出す。外字 (画像の字) は ※〔…〕 の形で残すので、手で直す。
// できたものは下書きなので、学年に合わせて抜き出し、content/ の書式にして使う (README の「文章を足す」)。
//
// 著作権の切れていない作品 (図書カードに「著作権存続」とあるもの) は取りこまない。

const cardUrl = process.argv[2];
if (!cardUrl || !/^https:\/\/www\.aozora\.gr\.jp\/cards\/\d+\/card\d+\.html$/.test(cardUrl)) {
  console.error('使い方: npm run aozora -- https://www.aozora.gr.jp/cards/<人物ID>/card<作品ID>.html');
  process.exit(1);
}

async function fetchText(url: string, encoding: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} を取ってこられませんでした (${res.status})`);
  return new TextDecoder(encoding).decode(await res.arrayBuffer());
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decodeEntities = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return ENTITIES[e] ?? m;
  });

/** XHTML の本文を、1 段落 1 行の文字列にする */
export function convert(html: string): string {
  const start = html.indexOf('<div class="main_text">');
  const end = html.indexOf('<div class="bibliographical_information">');
  if (start < 0) throw new Error('本文が見つかりませんでした');
  let s = html.slice(start, end > start ? end : undefined);
  s = s
    // ふりがな
    .replace(/<ruby>\s*<rb>(.*?)<\/rb>\s*<rp>.*?<\/rp>\s*<rt>(.*?)<\/rt>\s*<rp>.*?<\/rp>\s*<\/ruby>/g, (_m, rb: string, rt: string) => `{${rb}|${rt}}`)
    .replace(/<ruby>(.*?)<rt>(.*?)<\/rt><\/ruby>/g, (_m, rb: string, rt: string) => `{${rb}|${rt}}`)
    // 見出し
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/g, (_m, t: string) => `\n## ${t.replace(/<[^>]+>/g, '')}\n`)
    // 外字
    .replace(/<img[^>]*alt="([^"]*)"[^>]*>/g, (_m, alt: string) => `※〔${alt}〕`)
    // 入力者の注記 (［＃「刄を」は底本では「匁を」］ など) は本文ではないのでとる
    .replace(/［＃[^］]*］/g, '')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<\/?(p|div)[^>]*>/g, '\n')
    .replace(/<[^>]+>/g, '');
  return decodeEntities(s)
    .split('\n')
    .map((line) => line.replace(/^[\s　]+/, '').replace(/\s+$/, ''))
    .filter((line) => line !== '')
    .join('\n');
}

async function main(): Promise<void> {
  const card = await fetchText(cardUrl, 'utf-8');
  if (/著作権存続/.test(card)) throw new Error('この作品は著作権が切れていないので使えません');
  const file = card.match(/href="(\.\/files\/\d+_\d+\.html)"/)?.[1];
  if (!file) throw new Error('図書カードに XHTML 版のリンクが見つかりませんでした');
  const title = card.match(/<td class="header">作品名：<\/td>\s*<td><font size="\+2">(.*?)<\/font><\/td>/)?.[1] ?? '';
  const author = (card.match(/<td class="header">作家名：<\/td><td><a [^>]*>(.*?)<\/a>/)?.[1] ?? '').replace(/\s+/g, '');
  const html = await fetchText(new URL(file, cardUrl).href, 'shift_jis');
  const text = convert(html);
  process.stdout.write(`title: ${decodeEntities(title)}\nauthor: ${decodeEntities(author)}\nurl: ${cardUrl}\nchars: ${text.replace(/\{([^|}]*)\|[^}]*\}/g, '$1').replace(/\n/g, '').length}\n---\n${text}\n`);
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
