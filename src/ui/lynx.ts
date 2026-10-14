import type { Background, Card, Item, Look } from '../data/cards';
import { h, hanamaruPoints } from './dom';

// 目や輪郭は、画面の明暗に関係なくこの色にする (文字色に合わせると暗い画面で白目になる)
const LINE = '#1c2a4a';
const RED = '#e8546a';
const YELLOW = '#ffd23f';

/** 色の指定があればその色、なければ CSS のクラス (暗い画面で少し色を落とす) を使う */
const paint = (color: string | undefined, cls: string) => (color ? `fill="${color}"` : `class="${cls}"`);

const sparkle = (cx: number, cy: number, r: number, fill = YELLOW) =>
  `<path fill="${fill}" d="M${cx} ${cy - r}Q${cx} ${cy} ${cx + r} ${cy}Q${cx} ${cy} ${cx} ${cy + r}Q${cx} ${cy} ${cx - r} ${cy}Q${cx} ${cy} ${cx} ${cy - r}Z"/>`;

const EYE_Y = 69;
const EYE_X = [42, 78];

function eyes(look: Look): string {
  const open = (x: number) =>
    look.eyeColor
      ? `<ellipse cx="${x}" cy="${EYE_Y}" rx="7.5" ry="8.5" fill="${look.eyeColor}" stroke="${LINE}" stroke-width="1.6"/>` +
        `<ellipse cx="${x}" cy="${EYE_Y}" rx="3.3" ry="6.4" fill="${LINE}"/>` +
        `<circle cx="${x + 2.6}" cy="${EYE_Y - 3.6}" r="2" fill="#fff"/>`
      : `<ellipse cx="${x}" cy="${EYE_Y}" rx="7.5" ry="8.5" fill="${LINE}"/>` +
        `<circle cx="${x + 2.6}" cy="${EYE_Y - 3.6}" r="3.1" fill="#fff"/>` +
        `<circle cx="${x - 2.6}" cy="${EYE_Y + 3.6}" r="1.5" fill="#fff"/>`;
  const arc = (x: number, up: boolean) =>
    `<path fill="none" stroke="${LINE}" stroke-width="2.8" stroke-linecap="round" d="M${x - 7} ${EYE_Y + (up ? 2 : -1)}Q${x} ${EYE_Y + (up ? -8 : 7)} ${x + 7} ${EYE_Y + (up ? 2 : -1)}"/>`;
  const [l, r] = EYE_X;
  switch (look.eyes ?? 'open') {
    case 'wink':
      return open(l) + arc(r, true);
    case 'sleep':
      return arc(l, false) + arc(r, false);
    case 'happy':
      return arc(l, true) + arc(r, true);
    case 'sparkle':
      return open(l) + open(r) + sparkle(l - 11, EYE_Y - 12, 4.5) + sparkle(r + 11, EYE_Y - 12, 4.5);
    case 'brave':
      return (
        open(l) +
        open(r) +
        `<path fill="none" stroke="${LINE}" stroke-width="3" stroke-linecap="round" d="M33 56L50 60.5M87 56L70 60.5"/>`
      );
    default:
      return open(l) + open(r);
  }
}

function mouth(look: Look): string {
  const nose = `<path class="lynx-nose" d="M56.2 79.4Q60 77.6 63.8 79.4Q62.4 83.4 60 84Q57.6 83.4 56.2 79.4Z"/>`;
  const lines = `<path fill="none" stroke="${LINE}" stroke-width="2" stroke-linecap="round" d="M60 84V86M60 86C58 90 53 90 51.5 87M60 86C62 90 67 90 68.5 87"/>`;
  switch (look.mouth ?? 'tongue') {
    case 'smile':
      return nose + lines;
    case 'open':
      return (
        `<path fill="#8a3b3b" stroke="${LINE}" stroke-width="2" stroke-linejoin="round" d="M52.5 87.5Q60 100 67.5 87.5Z"/>` +
        `<ellipse class="lynx-tongue" cx="60" cy="93.2" rx="3.6" ry="2.4"/>` +
        nose +
        `<path fill="none" stroke="${LINE}" stroke-width="2" stroke-linecap="round" d="M60 84V87"/>`
      );
    default:
      return `<path class="lynx-tongue" d="M56.8 88.5Q60 95.5 63.2 88.5Z"/>` + nose + lines;
  }
}

// 頭の上にかぶるもの。これがあるときは、ひたいのもようをかかない
const HEADWEAR: Item[] = ['hat', 'headband', 'cap', 'wizard', 'crown', 'deerstalker', 'hood', 'mortarboard', 'conductor', 'beret', 'laurel'];

const ITEMS: Record<Item, string> = {
  ribbon:
    `<g transform="translate(87 31) rotate(18)" stroke="${LINE}" stroke-width="2" stroke-linejoin="round" fill="${RED}">` +
    `<path d="M0 0L-14 -8.5V8.5Z"/><path d="M0 0L14 -8.5V8.5Z"/><circle r="4"/></g>`,
  glasses:
    `<g fill="rgba(255,255,255,0.3)" stroke="${LINE}" stroke-width="2.6">` +
    `<circle cx="42" cy="69" r="11.5"/><circle cx="78" cy="69" r="11.5"/>` +
    `<path fill="none" stroke-linecap="round" d="M53.5 67.5Q60 63.5 66.5 67.5M30.5 67L21 63M89.5 67L99 63"/></g>`,
  pencil:
    `<g transform="rotate(30 97 34)" stroke="${LINE}" stroke-width="2" stroke-linejoin="round">` +
    `<rect x="93" y="12" width="8" height="6" fill="#f7a3b0"/><rect x="93" y="18" width="8" height="26" fill="${YELLOW}"/>` +
    `<path fill="#f6e0b5" d="M93 44H101L97 54Z"/><path fill="${LINE}" stroke="none" d="M95.4 50H98.6L97 54Z"/></g>`,
  hat:
    `<g stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round">` +
    `<ellipse cx="60" cy="31" rx="43" ry="7.5" fill="#f0d27a"/>` +
    `<path fill="#f5dc8e" d="M37 30C37 6 83 6 83 30Q60 36 37 30Z"/>` +
    `<path fill="${RED}" d="M37.2 24Q60 19 82.8 24L83 30Q60 36 37 30Z"/></g>`,
  scarf:
    `<g fill="${RED}" stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round">` +
    `<path d="M73 110L79 129L90 125L85 107Z"/><path d="M25 97Q60 113 95 97L97 107Q60 125 23 107Z"/></g>` +
    `<path fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.8" d="M38 107Q60 115 82 107"/>`,
  flower:
    `<g transform="translate(88 31)" stroke="${LINE}" stroke-width="1.6">` +
    [0, 72, 144, 216, 288].map((a) => `<circle r="5.4" cx="0" cy="-6.6" fill="#ff9fb5" transform="rotate(${a})"/>`).join('') +
    `<circle r="4" fill="${YELLOW}"/></g>`,
  book:
    `<g stroke="${LINE}" stroke-width="2.2" stroke-linejoin="round">` +
    `<path fill="#fff" d="M32 100Q46 93 60 100Q74 93 88 100V120Q74 113 60 120Q46 113 32 120Z"/>` +
    `<path fill="none" d="M60 100V120"/></g>` +
    `<path fill="none" stroke="#9aa6b8" stroke-width="1.4" stroke-linecap="round" d="M38 104Q46 101 54 104M38 109Q46 106 54 109M66 104Q74 101 82 104M66 109Q74 106 82 109"/>`,
  headband:
    `<g stroke="${LINE}" stroke-width="2.2" stroke-linejoin="round" fill="#fff">` +
    `<path d="M97 52L112 44L110 53L114 60L98 58Z"/><path d="M21 50Q60 33 99 50L99.5 59Q60 42 20.5 59Z"/></g>` +
    `<circle cx="60" cy="44.5" r="4.4" fill="#d63c2c"/>`,
  headphones:
    `<path fill="none" stroke="${LINE}" stroke-width="8" stroke-linecap="round" d="M19 62C19 12 101 12 101 62"/>` +
    `<path fill="none" stroke="#5b79d6" stroke-width="4.5" stroke-linecap="round" d="M19 62C19 12 101 12 101 62"/>` +
    `<g fill="${RED}" stroke="${LINE}" stroke-width="2.2"><rect x="9" y="55" width="14" height="27" rx="6.5"/><rect x="97" y="55" width="14" height="27" rx="6.5"/></g>`,
  cap:
    `<g stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round">` +
    `<path fill="#2f55a8" d="M38 33C24 33 11 37 6 44C24 45 46 41 62 35Z"/>` +
    `<path fill="#3f6fd1" d="M35 34C35 8 85 8 85 34Q60 28 35 34Z"/></g>` +
    `<circle cx="60" cy="13.5" r="2.6" fill="#fff" stroke="${LINE}" stroke-width="1.5"/>` +
    `<path fill="none" stroke="#fff" stroke-width="1.6" opacity="0.7" d="M60 16V30"/>`,
  wizard:
    `<g stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round">` +
    `<path fill="#5b3fa8" d="M34 33Q50 10 70 -12Q72 12 86 33Q60 39 34 33Z"/>` +
    `<ellipse cx="60" cy="33" rx="37" ry="6.5" fill="#4a3290"/></g>` +
    sparkle(57, 20, 5) +
    sparkle(69, 8, 3.2) +
    sparkle(72, 25, 2.6),
  crown:
    `<path fill="${YELLOW}" stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round" d="M38 32L35 8L49 20L60 2L71 20L85 8L82 32Q60 26 38 32Z"/>` +
    `<circle cx="60" cy="21" r="3.6" fill="#d63c2c" stroke="${LINE}" stroke-width="1.4"/>` +
    `<circle cx="45.5" cy="24" r="2.6" fill="#4a90e2" stroke="${LINE}" stroke-width="1.2"/>` +
    `<circle cx="74.5" cy="24" r="2.6" fill="#3fb37f" stroke="${LINE}" stroke-width="1.2"/>`,
  zzz:
    `<g fill="#fff" font-family="sans-serif" font-weight="700">` +
    `<text x="90" y="34" font-size="13">z</text><text x="99" y="22" font-size="16">z</text><text x="110" y="8" font-size="19">z</text></g>`,
  // ---- ここから下は Reading Quest で足したもの ----
  bookmark:
    `<g transform="translate(94 22) rotate(14)" stroke="${LINE}" stroke-width="2" stroke-linejoin="round">` +
    `<path fill="#4a90e2" d="M-5 0H5V30L0 25L-5 30Z"/><circle cy="-4" r="3.2" fill="${YELLOW}"/></g>` +
    `<path fill="none" stroke="${RED}" stroke-width="1.8" stroke-linecap="round" d="M95 15Q101 8 99 2M95 15Q90 9 92 3"/>`,
  acorn:
    `<g stroke="${LINE}" stroke-width="2.2" stroke-linejoin="round">` +
    `<path fill="#c98a4b" d="M50 24Q50 6 60 4Q70 6 70 24Z"/>` +
    `<path fill="#8a5a2b" d="M46 26Q46 16 60 15Q74 16 74 26Q60 31 46 26Z"/>` +
    `<path fill="none" d="M60 15V10"/></g>` +
    `<path fill="none" stroke="#5e3b1a" stroke-width="1.2" d="M50 22L56 17M56 25L64 17M63 26L70 19"/>`,
  mittens:
    `<g stroke="${LINE}" stroke-width="2.2" stroke-linejoin="round">` +
    `<path fill="${RED}" d="M22 120V104Q22 94 31 94Q40 94 40 104V120Z"/><path fill="${RED}" d="M22 106Q14 104 15 97Q18 93 23 98"/>` +
    `<path fill="${RED}" d="M80 120V104Q80 94 89 94Q98 94 98 104V120Z"/><path fill="${RED}" d="M98 106Q106 104 105 97Q102 93 97 98"/>` +
    `<path fill="#fff" d="M21 114H41V121H21ZM79 114H99V121H79Z"/></g>`,
  candle:
    `<g stroke="${LINE}" stroke-width="2" stroke-linejoin="round">` +
    `<rect x="96" y="80" width="10" height="28" rx="2" fill="${RED}"/>` +
    `<path fill="#ffd23f" d="M101 63Q108 72 101 79Q94 72 101 63Z"/></g>` +
    `<path fill="#fff6c8" d="M101 69Q104 73 101 77Q98 73 101 69Z"/>` +
    `<circle cx="101" cy="72" r="13" fill="#ffd23f" opacity="0.18"/>`,
  magnifier:
    `<g stroke="${LINE}" stroke-width="2.6" stroke-linecap="round">` +
    `<path fill="none" stroke-width="5" stroke="#8a5a2b" d="M104 104L114 116"/>` +
    `<circle cx="96" cy="94" r="11" fill="rgba(190,225,255,0.55)"/></g>` +
    `<path fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" d="M90 90Q92 86 96 86"/>`,
  quill:
    `<g transform="rotate(28 98 30)" stroke="${LINE}" stroke-width="2" stroke-linejoin="round">` +
    `<path fill="#fff" d="M98 2Q110 18 101 50L97 50Q88 20 98 2Z"/>` +
    `<path fill="none" stroke-width="1.4" d="M98 8V50M98 18L103 14M98 26L104 22M98 34L103 31M98 22L93 18M98 30L92 27"/>` +
    `<path fill="${LINE}" d="M97 50H101L99 58Z"/></g>`,
  scroll:
    `<g stroke="${LINE}" stroke-width="2.2" stroke-linejoin="round">` +
    `<rect x="30" y="100" width="60" height="18" fill="#fbf3dc"/>` +
    `<rect x="24" y="97" width="8" height="24" rx="4" fill="#b5651d"/><rect x="88" y="97" width="8" height="24" rx="4" fill="#b5651d"/></g>` +
    `<path fill="none" stroke="#9aa6b8" stroke-width="1.4" stroke-linecap="round" d="M38 105H82M38 111H74"/>`,
  lantern:
    `<path fill="none" stroke="${LINE}" stroke-width="1.6" d="M16 74V82"/>` +
    `<g stroke="${LINE}" stroke-width="2" stroke-linejoin="round">` +
    `<rect x="10" y="82" width="12" height="4" fill="${LINE}"/><rect x="10" y="108" width="12" height="4" fill="${LINE}"/>` +
    `<ellipse cx="16" cy="97" rx="11" ry="12" fill="${RED}"/></g>` +
    `<path fill="none" stroke="#fff" stroke-width="1" opacity="0.7" d="M6 92H26M5.5 97H26.5M6 102H26"/>` +
    `<circle cx="16" cy="97" r="16" fill="#ffd23f" opacity="0.15"/>`,
  maple:
    `<g transform="translate(88 30) rotate(-12)">` +
    `<path fill="#e5532d" stroke="${LINE}" stroke-width="1.8" stroke-linejoin="round" d="M0 -12L3 -5L9 -8L7 -1L13 1L6 4L8 10L0 6L-8 10L-6 4L-13 1L-7 -1L-9 -8L-3 -5Z"/>` +
    `<path fill="none" stroke="${LINE}" stroke-width="1.6" stroke-linecap="round" d="M0 6V14"/></g>`,
  chestnut:
    `<g transform="translate(97 100)" stroke="${LINE}" stroke-width="2" stroke-linejoin="round">` +
    `<path fill="#8b4a22" d="M0 -12Q12 -2 10 6Q0 12 -10 6Q-12 -2 0 -12Z"/>` +
    `<path fill="#e8c493" d="M-10 6Q0 12 10 6Q8 11 0 12Q-8 11 -10 6Z"/></g>` +
    `<path fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity="0.7" d="M93 92Q95 89 98 89"/>`,
  shell:
    `<g transform="translate(88 30) rotate(14)" stroke="${LINE}" stroke-width="1.8" stroke-linejoin="round">` +
    `<path fill="#ffb3c7" d="M-11 4Q-12 -10 0 -12Q12 -10 11 4Q0 9 -11 4Z"/>` +
    `<path fill="none" d="M0 6V-11M-6 5L-5 -10M6 5L5 -10"/><path fill="#ffb3c7" d="M-4 4H4L3 9H-3Z"/></g>`,
  cello:
    `<path fill="none" stroke="${LINE}" stroke-width="4" stroke-linecap="round" d="M108 30V78"/>` +
    `<g stroke="${LINE}" stroke-width="2.2" stroke-linejoin="round">` +
    `<path fill="#a0522d" d="M108 74Q96 74 97 84Q98 90 95 94Q92 104 100 112Q108 118 116 112Q124 104 121 94Q118 90 119 84Q120 74 108 74Z"/></g>` +
    `<path fill="none" stroke="#3a1f0e" stroke-width="1.6" d="M103 92Q105 96 103 100M113 92Q111 96 113 100"/>` +
    `<path fill="none" stroke="#f3e6c8" stroke-width="0.9" d="M106 40V106M110 40V106"/>` +
    `<path fill="none" stroke="${LINE}" stroke-width="2" stroke-linecap="round" d="M84 100L126 88"/>`,
  deerstalker:
    `<g stroke="${LINE}" stroke-width="2.4" stroke-linejoin="round">` +
    `<path fill="#9c7a52" d="M30 34Q20 34 16 40Q30 42 40 36ZM90 34Q100 34 104 40Q90 42 80 36Z"/>` +
    `<path fill="#b8936a" d="M34 36C34 8 86 8 86 36Q60 30 34 36Z"/></g>` +
    `<path fill="none" stroke="#6f5233" stroke-width="1.3" d="M44 16V34M60 10V31M76 16V34M38 24H82"/>` +
    `<path fill="none" stroke="${LINE}" stroke-width="1.6" stroke-linecap="round" d="M60 10Q57 5 60 3Q63 5 60 10"/>`,
  hood:
    `<g stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round">` +
    `<path fill="#d63c2c" d="M14 76C8 26 112 26 106 76Q100 50 60 40Q20 50 14 76Z"/>` +
    `<path fill="#d63c2c" d="M50 104L60 98L70 104L66 112L60 106L54 112Z"/></g>` +
    `<path fill="none" stroke="#fff" stroke-width="1.5" opacity="0.5" d="M26 52Q60 26 94 52"/>`,
  mortarboard:
    `<g stroke="${LINE}" stroke-width="2.4" stroke-linejoin="round">` +
    `<path fill="#2c3550" d="M38 34V24Q60 18 82 24V34Q60 28 38 34Z"/>` +
    `<path fill="#3b4566" d="M60 4L100 16L60 28L20 16Z"/></g>` +
    `<path fill="none" stroke="${YELLOW}" stroke-width="2" stroke-linecap="round" d="M60 16L92 22V40"/>` +
    `<circle cx="92" cy="42" r="3" fill="${YELLOW}"/>`,
  conductor:
    `<g stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round">` +
    `<path fill="#1f2b55" d="M30 38C24 38 16 40 14 45C30 46 46 43 60 39Z"/>` +
    `<path fill="#2c3d78" d="M32 37V20Q60 8 88 20V37Q60 30 32 37Z"/></g>` +
    `<path fill="none" stroke="${YELLOW}" stroke-width="3" d="M33 31Q60 24 87 31"/>` +
    sparkle(60, 19, 5),
  beret:
    `<g stroke="${LINE}" stroke-width="2.4" stroke-linejoin="round">` +
    `<path fill="#3f4fa8" d="M30 34Q22 14 52 10Q92 6 94 28Q90 34 30 34Z"/>` +
    `<path fill="none" stroke-linecap="round" d="M56 10Q56 4 60 2"/></g>`,
  laurel:
    `<path fill="none" stroke="#3f8f4f" stroke-width="2.4" stroke-linecap="round" d="M24 52Q30 30 60 26Q90 30 96 52"/>` +
    [
      [28, 44, -60], [34, 36, -45], [42, 30, -30], [51, 27, -15], [69, 27, 15], [78, 30, 30], [86, 36, 45], [92, 44, 60],
    ]
      .map(([x, y, a]) => `<ellipse cx="${x}" cy="${y}" rx="3.4" ry="6.5" fill="#69c56e" stroke="${LINE}" stroke-width="1.4" transform="rotate(${a} ${x} ${y})"/>`)
      .join('') +
    `<circle cx="60" cy="26" r="3.4" fill="${YELLOW}" stroke="${LINE}" stroke-width="1.4"/>`,
};

/** ヤマネコの顔 (たて 110 × よこ 120 の中にかく)。耳の先のふさ毛と、ほおの長い毛が目じるし */
export function lynxFace(look: Look = {}): string {
  const items = look.items ?? [];
  const marks = items.some((i) => HEADWEAR.includes(i)) ? 'none' : (look.marks ?? 'stripes');
  return (
    `<g stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">` +
    `<path ${paint(look.fur, 'lynx-fur')} d="M27 52C21 38 21 24 25 13C36 19 47 27 53 36ZM93 52C99 38 99 24 95 13C84 19 73 27 67 36Z"/>` +
    `<path ${paint(look.fur, 'lynx-fur')} d="M60 28C36 28 19 44 19 67C19 73 15 79 8 85C18 86 25 89 31 95C39 103 50 106 60 106C70 106 81 103 89 95C95 89 102 86 112 85C105 79 101 73 101 67C101 44 84 28 60 28Z"/></g>` +
    `<path ${paint(look.pink, 'lynx-pink')} d="M30 43C28 35 28 28 30 22C36 26 41 31 45 36ZM90 43C92 35 92 28 90 22C84 26 79 31 75 36Z"/>` +
    `<path ${look.fur ? `fill="${LINE}"` : 'class="lynx-tuft"'} d="M24 15C22 10 20 6 19 1C24 4 28 8 31 12ZM96 15C98 10 100 6 101 1C96 4 92 8 89 12Z"/>` +
    `<ellipse ${paint(look.light, 'lynx-light')} cx="60" cy="86" rx="15" ry="11"/>` +
    `<ellipse ${paint(look.pink, 'lynx-pink')} cx="28" cy="82" rx="6.5" ry="4" opacity="0.75"/>` +
    `<ellipse ${paint(look.pink, 'lynx-pink')} cx="92" cy="82" rx="6.5" ry="4" opacity="0.75"/>` +
    (marks === 'stripes'
      ? `<path fill="none" stroke="${LINE}" stroke-width="2.5" stroke-linecap="round" d="M53 39L54 45M60 37V44M67 39L66 45"/>`
      : marks === 'spots'
        ? `<g fill="${LINE}"><circle cx="52" cy="42" r="2.2"/><circle cx="60" cy="38" r="2.2"/><circle cx="68" cy="42" r="2.2"/></g>`
        : '') +
    eyes(look) +
    mouth(look) +
    `<path fill="none" stroke="${LINE}" stroke-width="1.4" stroke-linecap="round" d="M45 87L33 89M45.5 90.5L35 96M75 87L87 89M74.5 90.5L85 96"/>` +
    items.map((item) => ITEMS[item]).join('')
  );
}

/** タイトル画面のヤマネコ */
export function lynx(): HTMLElement {
  const el = h('div', { class: 'lynx' });
  el.innerHTML = `<svg viewBox="0 0 120 110" role="img" aria-label="ヤマネコのキャラクター">${lynxFace()}</svg>`;
  return el;
}

// ---- カードの絵柄 (たて 156 × よこ 120) ----

const W = 120;
const H = 156;
const circles = (points: number[][], fill: string) =>
  points.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`).join('');
const fillRect = (fill: string) => `<rect width="${W}" height="${H}" fill="${fill}"/>`;

function background(bg: Background): string {
  switch (bg) {
    case 'dots': {
      const dots: number[][] = [];
      for (let y = 0; y < 11; y++) for (let x = 0; x < 9; x++) dots.push([x * 15 + (y % 2) * 7.5, y * 15 + 6, 3.2]);
      return fillRect('#fff5c2') + circles(dots, '#ffe36e');
    }
    case 'grid': {
      let d = '';
      for (let x = 12; x < W; x += 12) d += `M${x} 0V${H}`;
      for (let y = 12; y < H; y += 12) d += `M0 ${y}H${W}`;
      return fillRect('#f3faf6') + `<path d="${d}" stroke="#b9dccf" stroke-width="1" fill="none"/>`;
    }
    case 'night':
      return (
        fillRect('#27305a') +
        `<circle cx="24" cy="24" r="11" fill="#ffe58a"/><circle cx="29" cy="20.5" r="10" fill="#27305a"/>` +
        circles([[52, 14, 1.4], [76, 26, 1.1], [14, 60, 1.2], [108, 52, 1.5], [100, 140, 1.3], [16, 132, 1.5], [62, 148, 1.1]], '#fff') +
        sparkle(90, 16, 4, '#ffe58a') +
        sparkle(106, 100, 3, '#ffe58a')
      );
    case 'pink':
      return fillRect('#ffe4ea') + circles([[18, 22, 13], [102, 34, 9], [96, 132, 16], [14, 120, 8], [60, 10, 6]], '#ffd0da');
    case 'sky':
      return (
        fillRect('#cdeaf8') +
        `<circle cx="98" cy="22" r="11" fill="${YELLOW}"/>` +
        `<g fill="#fff"><ellipse cx="26" cy="22" rx="15" ry="6.5"/><ellipse cx="34" cy="17" rx="9" ry="6"/>` +
        `<ellipse cx="92" cy="142" rx="17" ry="6.5"/><ellipse cx="20" cy="136" rx="12" ry="5"/></g>`
      );
    case 'snow':
      return (
        fillRect('#dcecf5') +
        `<ellipse cx="60" cy="160" rx="90" ry="22" fill="#fff"/>` +
        circles([[16, 16, 2.6], [44, 10, 1.8], [78, 20, 2.4], [104, 12, 1.9], [10, 58, 2], [110, 66, 2.6], [20, 104, 1.8], [102, 112, 2.2], [60, 24, 1.6]], '#fff')
      );
    case 'sakura': {
      const petals = [[16, 18, 20], [42, 10, -30], [86, 16, 50], [106, 34, -10], [10, 70, 70], [112, 86, 30], [18, 128, -40], [98, 138, 15], [58, 146, -60], [70, 28, 80]];
      return (
        fillRect('#fdeaf0') +
        petals.map(([x, y, a]) => `<ellipse cx="${x}" cy="${y}" rx="5" ry="3" fill="#f7a8bd" transform="rotate(${a} ${x} ${y})"/>`).join('')
      );
    }
    case 'notes': {
      const notes = [[12, 28, 18], [94, 22, 15], [104, 70, 13], [8, 96, 14], [92, 146, 18], [24, 148, 13]];
      return (
        fillRect('#e9f1ff') +
        `<g fill="#7d94d6" font-family="sans-serif">` +
        notes.map(([x, y, s]) => `<text x="${x}" y="${y}" font-size="${s}">♪</text>`).join('') +
        `</g>`
      );
    }
    case 'hanamaru':
      return (
        fillRect('#fdfdfa') +
        `<polyline points="${hanamaruPoints()}" fill="none" stroke="#d63c2c" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.38" transform="translate(-10 4) scale(1.4)"/>`
      );
    case 'stars':
      return (
        fillRect('#33285c') +
        [[16, 18, 6], [100, 14, 4.5], [108, 70, 5], [10, 84, 4], [20, 140, 5], [98, 140, 6.5], [60, 12, 3]].map(([x, y, r]) => sparkle(x, y, r)).join('') +
        circles([[40, 20, 1.2], [84, 30, 1], [112, 112, 1.3], [8, 116, 1.1]], '#fff')
      );
    case 'rainbow':
      return (
        fillRect('#eaf6ff') +
        ['#f2666c', '#f7a23b', '#ffd93b', '#69c56e', '#4aa3e8', '#8b6fd6']
          .map((c, i) => `<circle cx="60" cy="150" r="${112 - i * 9}" fill="none" stroke="${c}" stroke-width="9"/>`)
          .join('') +
        `<circle cx="60" cy="150" r="53.5" fill="#eaf6ff"/>`
      );
    case 'gold': {
      let rays = '';
      for (let i = 0; i < 12; i++) rays += `<path d="M60 84L${60 - 14} -40L${60 + 14} -40Z" fill="#f2d56a" transform="rotate(${i * 30} 60 84)"/>`;
      return fillRect('#f8e9ad') + rays + sparkle(16, 20, 6, '#fff') + sparkle(104, 28, 4.5, '#fff') + sparkle(102, 136, 6, '#fff') + sparkle(18, 132, 4, '#fff');
    }
    case 'library': {
      const colors = ['#d9534f', '#4a90e2', '#f0ad4e', '#5cb85c', '#8b6fd6', '#e8a0bf'];
      let books = '';
      for (const [row, y] of [[0, 4], [1, 112]] as const) {
        let x = 4;
        let i = row * 3;
        while (x < 116) {
          const w = 7 + ((i * 5) % 5);
          const hgt = 30 + ((i * 7) % 8);
          books += `<rect x="${x}" y="${y + 38 - hgt}" width="${w}" height="${hgt}" fill="${colors[i % colors.length]}" stroke="#5e3b1a" stroke-width="0.8"/>`;
          x += w + 1;
          i++;
        }
      }
      return fillRect('#f4e3c4') + books + `<path d="M0 42.5H120M0 150.5H120" stroke="#8a5a2b" stroke-width="5"/>`;
    }
    case 'forest': {
      const tree = (x: number, y: number, s: number, c: string) =>
        `<path d="M${x} ${y - 22 * s}L${x + 12 * s} ${y}H${x - 12 * s}Z" fill="${c}"/><rect x="${x - 2 * s}" y="${y}" width="${4 * s}" height="${6 * s}" fill="#8a5a2b"/>`;
      return (
        fillRect('#e3f3dc') +
        `<ellipse cx="60" cy="166" rx="100" ry="30" fill="#bfe3b0"/>` +
        tree(14, 34, 1, '#6fbf73') + tree(104, 28, 1.1, '#4fa65a') + tree(10, 140, 1.2, '#4fa65a') + tree(108, 146, 1, '#6fbf73') +
        circles([[34, 14, 7], [86, 136, 6]], '#9fd49a')
      );
    }
    case 'genko': {
      let d = '';
      for (let x = 10; x <= 110; x += 10) d += `M${x} 8V148`;
      for (let y = 8; y <= 148; y += 10) d += `M10 ${y}H110`;
      return fillRect('#fdfdfa') + `<path d="${d}" stroke="#e7a7a0" stroke-width="0.8" fill="none"/>` + `<rect x="10" y="8" width="100" height="140" fill="none" stroke="#d66b5f" stroke-width="1.5"/>`;
    }
    case 'moon':
      return (
        fillRect('#1f2d55') +
        `<circle cx="88" cy="28" r="18" fill="#ffe9a8"/><circle cx="82" cy="24" r="3" fill="#f3d68a"/><circle cx="94" cy="34" r="2.2" fill="#f3d68a"/>` +
        `<g fill="#2e3f72"><ellipse cx="22" cy="40" rx="16" ry="5"/><ellipse cx="96" cy="140" rx="20" ry="6"/></g>` +
        circles([[14, 14, 1.3], [48, 10, 1.1], [112, 64, 1.2], [8, 96, 1.4], [30, 146, 1.1]], '#fff')
      );
    case 'autumn': {
      const leaves = [[14, 18, 20, '#e5532d'], [100, 12, -30, '#f39c34'], [108, 70, 50, '#e5532d'], [10, 84, -10, '#f2c14e'], [20, 140, 35, '#f39c34'], [98, 140, -45, '#e5532d'], [56, 150, 10, '#f2c14e']] as const;
      return (
        fillRect('#fdf0dc') +
        leaves
          .map(
            ([x, y, a, c]) =>
              `<path transform="translate(${x} ${y}) rotate(${a}) scale(0.55)" fill="${c}" d="M0 -12L3 -5L9 -8L7 -1L13 1L6 4L8 10L0 6L-8 10L-6 4L-13 1L-7 -1L-9 -8L-3 -5Z"/>`,
          )
          .join('')
      );
    }
    case 'sea':
      return (
        fillRect('#bfe6f2') +
        `<rect y="70" width="120" height="86" fill="#8fd0e6"/>` +
        `<path d="M0 72Q10 66 20 72T40 72T60 72T80 72T100 72T120 72" fill="none" stroke="#fff" stroke-width="2.5"/>` +
        `<path d="M0 132Q15 124 30 132T60 132T90 132T120 132V156H0Z" fill="#f3e3b5"/>` +
        circles([[14, 98, 3], [20, 88, 2], [104, 104, 3.5], [110, 92, 2]], 'rgba(255,255,255,0.8)')
      );
    case 'galaxy':
      return (
        fillRect('#141c3f') +
        `<path d="M-10 150Q40 90 70 60T130 -10" stroke="#3b4a8f" stroke-width="40" fill="none" opacity="0.7"/>` +
        `<path d="M-10 150Q40 90 70 60T130 -10" stroke="#6f7fcf" stroke-width="12" fill="none" opacity="0.5"/>` +
        [[16, 20, 4], [104, 16, 5], [110, 120, 3.5], [12, 112, 3], [30, 146, 4.5]].map(([x, y, r]) => sparkle(x, y, r, '#ffe58a')).join('') +
        circles([[46, 12, 1.2], [80, 30, 1], [20, 64, 1.1], [100, 80, 1.3], [64, 140, 1.2], [90, 150, 1]], '#fff')
      );
    case 'washi':
      return (
        fillRect('#f5ecd8') +
        circles([[20, 20, 1.2], [44, 60, 0.9], [90, 30, 1.1], [104, 98, 1], [30, 120, 1.2], [70, 146, 0.9], [12, 80, 0.8]], '#e0cfa8') +
        `<path d="M0 12H120M0 144H120" stroke="#c9a96b" stroke-width="2"/><path d="M0 16H120M0 140H120" stroke="#c9a96b" stroke-width="0.8"/>`
      );
    default:
      return fillRect('#fdfdfa') + `<rect x="8" y="8" width="104" height="140" rx="4" fill="none" stroke="#c5ddd3" stroke-width="1.2"/>`;
  }
}

const FRAMES = {
  plain: `<rect x="1.5" y="1.5" width="117" height="153" rx="7" fill="none" stroke="#6aa893" stroke-width="3"/>`,
  silver:
    `<rect x="2.5" y="2.5" width="115" height="151" rx="6.5" fill="none" stroke="#aeb8c4" stroke-width="5"/>` +
    `<rect x="5.5" y="5.5" width="109" height="145" rx="4.5" fill="none" stroke="#f1f4f7" stroke-width="1.2"/>`,
  gold:
    `<rect x="2.5" y="2.5" width="115" height="151" rx="6.5" fill="none" stroke="#d9a520" stroke-width="5"/>` +
    `<rect x="5.5" y="5.5" width="109" height="145" rx="4.5" fill="none" stroke="#fff3c4" stroke-width="1.2"/>`,
};

let clipSeq = 0;

/** 表向きのカードの絵 */
export function cardSvg(card: Card): string {
  const clip = `card-clip-${clipSeq++}`;
  return (
    `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${card.name}">` +
    `<clipPath id="${clip}"><rect width="${W}" height="${H}" rx="8"/></clipPath>` +
    `<g clip-path="url(#${clip})">${background(card.bg)}` +
    `<g transform="translate(9 37) scale(0.85)">${lynxFace({ fur: '#e9bd72', light: '#fff6e1', pink: '#f7b3a6', ...card.look })}</g>` +
    `</g>${FRAMES[card.frame]}</svg>`
  );
}
