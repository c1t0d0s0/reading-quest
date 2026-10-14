import { dailyPassage } from '../core/daily';
import { jstDate } from '../core/date';
import { GRADES, type Grade, type PassageMeta } from '../core/reading';
import { currentRun } from '../core/rewards';
import { rngFromString, shuffle } from '../core/rng';
import { recommend, typeStats, weakest } from '../core/stats';
import { allProgress, balance, dailyDone, getGrade, getScores, getSound, getStamps, setGrade, setSound, statusOf } from '../core/storage';
import { PASSAGES, metaOf } from '../data/passages';
import { accountBox } from './account';
import { h, hanamaru, rubyHtml } from './dom';
import { lynx } from './lynx';
import { T } from './text';

/** 右の列を出す画面のはば (styles.css の .home と同じ値) */
const WIDE = '(min-width: 64rem)';

/** 原稿用紙のマスに、たて書きで「よみとく」と書いたタイトルのかざり */
function crest(): HTMLElement {
  const el = h('div', { class: 'crest', 'aria-hidden': 'true' });
  // 右の列から読む。null は空いているマス
  const cols = [
    ['よ', 'み', 'と', 'く'],
    ['ち', 'か', 'ら', null],
  ];
  for (let r = 0; r < 4; r++) {
    for (let c = cols.length - 1; c >= 0; c--) {
      const ch = cols[c][r];
      el.append(h('span', { class: c === 0 && r === 2 ? 'crest-cell crest-cross' : 'crest-cell' }, ch ?? ''));
    }
  }
  return el;
}

function gradeSwitch(root: HTMLElement, current: Grade | null): HTMLElement {
  return h(
    'div',
    { class: 'grades', role: 'group', 'aria-label': T.gradeTitle },
    ...GRADES.map((g) =>
      h(
        'button',
        {
          type: 'button',
          class: 'grade-option',
          'aria-pressed': String(g === current),
          onclick: () => {
            if (g === current) return;
            setGrade(g);
            renderHome(root);
          },
        },
        h('span', { class: 'grade-num' }, String(g)),
        h('span', { class: 'grade-unit' }, '年生'),
      ),
    ),
  );
}

/** 効果音を鳴らすかどうかの切りかえ */
function soundSwitch(): HTMLElement {
  const btn = h('button', { type: 'button', class: 'btn sound-switch' });
  const paint = () => {
    const on = getSound();
    btn.textContent = on ? T.soundOn : T.soundOff;
    btn.setAttribute('aria-pressed', String(on));
  };
  btn.addEventListener('click', () => {
    setSound(!getSound());
    paint();
  });
  paint();
  return h('p', { class: 'settings' }, btn);
}

/** 文章の題名・ジャンル・字数の 1 行 */
export function passageMeta(meta: PassageMeta): HTMLElement {
  const genre = h('span', { class: 'tag' });
  genre.innerHTML = rubyHtml(T.genre[meta.genre]);
  return h(
    'p',
    { class: 'meta-line' },
    genre,
    h('span', {}, meta.author === 'Reading Quest' ? T.original : meta.author),
    h('span', {}, T.chars(meta.chars)),
    meta.series ? h('span', {}, T.part(meta.series.part, meta.series.total)) : null,
  );
}

function dailySection(grade: Grade, today: string): HTMLElement {
  const meta = dailyPassage(PASSAGES, grade, today);
  const done = dailyDone(today);
  const status = meta ? statusOf(meta.id) : 'new';
  const run = currentRun(getStamps(), today);
  const d = new Date(`${today}T00:00:00Z`);
  const action = done ? T.review : status === 'playing' ? T.resume : T.start;
  return h(
    'section',
    { class: 'daily', 'aria-labelledby': 'daily-title' },
    h(
      'div',
      { class: 'daily-text' },
      h('h2', { id: 'daily-title' }, T.daily),
      h('p', { class: 'daily-date' }, T.dateLabel(d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCDay())),
      meta ? h('p', { class: 'daily-passage' }, h('b', {}, meta.title)) : null,
      meta ? passageMeta(meta) : null,
      h('p', { class: 'daily-note' }, T.dailyNote(done, run)),
    ),
    done ? hanamaru('hanamaru hanamaru-daily') : null,
    meta ? h('a', { class: 'btn btn-primary', href: '#/daily' }, action) : null,
  );
}

function recommendSection(grade: Grade, today: string): HTMLElement {
  const scores = getScores();
  const progress = allProgress();
  const isRead = (id: string) => id in scores || progress[id]?.done === true;
  const weak = weakest(typeStats(progress, metaOf));
  const daily = dailyPassage(PASSAGES, grade, today);
  // 毎日ちがう文章をすすめるよう、日付で並べかえてからえらぶ
  const order = shuffle(PASSAGES, rngFromString(`recommend:${today}`));
  const pick = recommend(order, grade, isRead, weak?.type, daily ? [daily.id] : []);

  const body: (HTMLElement | null)[] = [];
  if (!pick) {
    body.push(h('p', { class: 'section-note' }, T.recommendAllRead));
  } else {
    const isNext = pick.series && pick.series.part > 1;
    const why = isNext ? T.recommendNext : weak && pick.qtypes.includes(weak.type) ? T.recommendWeak(T.qtype[weak.type]) : T.recommendAny;
    const status = statusOf(pick.id);
    body.push(
      h(
        'a',
        { class: 'pick', href: `#/read/${pick.id}` },
        h('span', { class: 'pick-title' }, pick.title),
        passageMeta(pick),
        h('span', { class: 'pick-why' }, why),
        h('span', { class: 'btn btn-primary pick-go' }, status === 'playing' ? T.resume : T.start),
      ),
    );
  }
  return h('section', { class: 'recommend', 'aria-labelledby': 'rec-title' }, h('h2', { id: 'rec-title' }, T.recommendTitle), ...body);
}

export function renderHome(root: HTMLElement): void {
  const grade = getGrade();
  const today = jstDate();

  const main: (HTMLElement | null)[] = [
    h(
      'header',
      { class: 'hero' },
      crest(),
      h('div', { class: 'hero-text' }, h('h1', { class: 'brand' }, T.brand), h('p', { class: 'lead' }, T.lead)),
      lynx(),
    ),
  ];

  if (grade === null) {
    main.push(
      h(
        'section',
        { class: 'grade-ask', 'aria-labelledby': 'grade-title' },
        h('h2', { id: 'grade-title' }, T.gradeAsk),
        gradeSwitch(root, null),
        h('p', { class: 'section-note' }, T.gradeNote),
      ),
    );
  } else {
    main.push(
      gradeSwitch(root, grade),
      dailySection(grade, today),
      h(
        'nav',
        { class: 'reward-links', 'aria-label': T.rewardLinks },
        h('p', { class: 'points' }, h('span', { class: 'points-label' }, T.pointsLabel), h('b', { class: 'points-num' }, T.points(balance()))),
        h(
          'div',
          { class: 'reward-buttons' },
          h('a', { class: 'btn', href: '#/stamps' }, T.stampTitle),
          h('a', { class: 'btn', href: '#/cards' }, T.cardsTitle),
        ),
      ),
      recommendSection(grade, today),
      h(
        'nav',
        { class: 'home-links' },
        h('a', { class: 'btn', href: '#/library' }, T.libraryLink),
        h('a', { class: 'btn', href: '#/record' }, T.recordLink),
      ),
    );
  }

  root.replaceChildren(
    h(
      'main',
      { class: 'home' },
      h('div', { class: 'home-main' }, ...main),
      // あそびかた・音・記録の保存。広い画面では右の列にならべ、スクロールしなくても見えるようにする
      h(
        'aside',
        { class: 'home-side' },
        accountBox(T),
        h(
          'details',
          // 広い画面では場所があるので、はじめから開いておく
          { class: 'howto', open: matchMedia(WIDE).matches },
          h('summary', {}, T.howto),
          h('ul', {}, ...T.howtoItems.map((item) => h('li', {}, item))),
        ),
        soundSwitch(),
      ),
    ),
  );
}
