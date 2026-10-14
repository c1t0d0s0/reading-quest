import { choiceOrder, isHeading, segments, type Passage } from '../core/reading';
import { POINTS_PER_CORRECT, type StampReward } from '../core/rewards';
import {
  addDailyClear,
  addStamp,
  answer,
  balance,
  dailyDone,
  getView,
  loadProgress,
  setView,
  startTry,
  type Progress,
  type ViewPrefs,
} from '../core/storage';
import { loadPassage, metaOf, nextPart, prevPart } from '../data/passages';
import { playClear } from './celebrate';
import { escapeHtml, h, hanamaru, homeButton, rubyHtml, withRuby } from './dom';
import { passageMeta } from './home';
import { playCorrect, playWrong, primeSound } from './sound';
import { T } from './text';

const LABELS = ['ア', 'イ', 'ウ', 'エ'];
/** 本文と問題を横にならべる画面のはば (styles.css の .reader と同じ値) */
const WIDE = '(min-width: 62.5rem)';

export interface ReadOptions {
  /** 今日のチャレンジとして読むときの日付 */
  daily?: string;
}

/** 段落の中で、[start, end) の範囲に黄色い印をつけた HTML (ふりがなの付いた言葉は、まるごと印の中に入れる) */
export function markedHtml(text: string, ranges: readonly [number, number][]): string {
  let out = '';
  let pos = 0;
  const inRange = (i: number) => ranges.some(([s, e]) => i >= s && i < e);
  for (const seg of segments(text)) {
    const start = pos;
    const end = pos + seg.text.length;
    pos = end;
    if (seg.ruby) {
      const html = `<ruby>${escapeHtml(seg.text)}<rt>${escapeHtml(seg.ruby)}</rt></ruby>`;
      out += ranges.some(([s, e]) => s < end && e > start) ? `<mark>${html}</mark>` : html;
      continue;
    }
    // 印のある所とない所に分けてつなぐ
    let buf = '';
    let marked = false;
    const flush = () => {
      if (buf) out += marked ? `<mark>${escapeHtml(buf)}</mark>` : escapeHtml(buf);
      buf = '';
    };
    for (let i = start; i < end; i++) {
      const m = inRange(i);
      if (m !== marked) {
        flush();
        marked = m;
      }
      buf += seg.text[i - start];
    }
    flush();
  }
  return out;
}

/** 手がかりの文字が、どの段落のどこにあるか。見つからない行は飛ばす */
export function findEvidence(plainParas: readonly string[], evidence: string): Map<number, [number, number][]> {
  const found = new Map<number, [number, number][]>();
  for (const line of evidence.split('\n').filter(Boolean)) {
    const idx = plainParas.findIndex((p) => p.includes(line));
    if (idx < 0) continue;
    const start = plainParas[idx].indexOf(line);
    found.set(idx, [...(found.get(idx) ?? []), [start, start + line.length]]);
  }
  return found;
}

export function renderRead(root: HTMLElement, id: string, opts: ReadOptions = {}): () => void {
  let alive = true;
  const bar = h('header', { class: 'bar' }, homeButton(T.goHome), h('h1', {}, opts.daily ? T.daily : (metaOf(id)?.title ?? '')), h('span', { class: 'bar-meta' }));
  const status = h('p', { class: 'reader-status', role: 'status' }, T.loading);
  root.replaceChildren(h('div', { class: 'reader-page' }, bar, h('main', { class: 'reader-loading' }, status)));

  const load = () => {
    status.textContent = T.loading;
    loadPassage(id).then(
      (p) => {
        if (!alive) return;
        if (!p) {
          status.textContent = T.notFound;
          return;
        }
        show(root, p, opts);
      },
      () => {
        if (!alive) return;
        status.replaceChildren(T.loadFailed, ' ', h('button', { type: 'button', class: 'btn', onclick: load }, T.retry));
      },
    );
  };
  load();
  return () => {
    alive = false;
    document.querySelector('.back-to-q')?.remove();
  };
}

function show(root: HTMLElement, p: Passage, opts: ReadOptions): void {
  const daily = opts.daily;
  let progress: Progress | null = loadProgress(p.id);
  // 今日のチャレンジで、前に読み終えている文章が出たときは、読み直しから始める
  if (daily && !dailyDone(daily) && progress?.done) progress = startTry(p.id, p.questions.length);
  // 問題の数が変わっていたら (文章を直したとき)、読み直しにする
  if (progress && progress.answers.length !== p.questions.length) progress = startTry(p.id, p.questions.length);
  const tries = progress?.tries ?? 0;
  const seed = `${p.id}:${tries}`;

  // ---- 本文 ----
  const plainParas = p.body.map((para) => segments(para).map((s) => s.text).join(''));
  const paraEls: HTMLElement[] = p.body.map((para, i) =>
    isHeading(para) ? withRuby('h3', 'passage-heading', para.slice(3)) : withRuby('p', 'passage-para', para, { 'data-i': String(i) }),
  );
  /** 手がかりの印をつけかえる。null なら印を消す */
  const highlight = (evidence: string | null): HTMLElement | null => {
    const found = evidence ? findEvidence(plainParas, evidence) : new Map();
    p.body.forEach((para, i) => {
      if (isHeading(para)) return;
      paraEls[i].innerHTML = found.has(i) ? markedHtml(para, found.get(i)!) : rubyHtml(para);
    });
    return root.querySelector('.passage mark');
  };

  const view = getView();
  const passage = h(
    'article',
    { class: 'passage', 'aria-labelledby': 'passage-title' },
    h('h2', { id: 'passage-title', class: 'passage-title' }, p.title),
    h('p', { class: 'passage-author' }, p.source === 'original' ? T.original : p.author),
    h('div', { class: 'passage-body', tabindex: '0' }, ...paraEls),
    sourceLine(p),
  );
  const applyView = (v: ViewPrefs) => {
    passage.classList.toggle('is-tate', v.tate);
    passage.dataset.size = String(v.size);
    passage.dataset.grade = String(p.grade);
  };
  applyView(view);

  const tools = h(
    'div',
    { class: 'view-tools', role: 'group', 'aria-label': T.viewSize },
    viewButton(view, applyView),
    sizeButton(view, applyView),
  );

  // ---- 問題 ----
  const qEls: HTMLElement[] = [];
  const backBtn = h('button', { type: 'button', class: 'btn btn-primary back-to-q', hidden: true });
  document.querySelector('.back-to-q')?.remove();
  document.body.append(backBtn);
  let backTarget: HTMLElement | null = null;
  backBtn.addEventListener('click', () => {
    backBtn.hidden = true;
    backTarget?.scrollIntoView({ block: 'center', behavior: smooth() });
    backTarget?.querySelector<HTMLElement>('.check-evidence')?.focus({ preventScroll: true });
  });

  const jumpToEvidence = (qi: number) => {
    const mark = highlight(p.questions[qi].evidence);
    qEls.forEach((el, i) => el.classList.toggle('is-checking', i === qi));
    if (!mark) return;
    mark.scrollIntoView({ block: 'center', inline: 'center', behavior: smooth() });
    // せまい画面では本文と問題がはなれているので、問題にもどるボタンを出す
    if (!matchMedia(WIDE).matches) {
      backTarget = qEls[qi];
      backBtn.textContent = `問${qi + 1}に もどる`;
      backBtn.hidden = false;
    }
  };

  const counter = h('span', { class: 'bar-meta' });
  const bar = h('header', { class: 'bar' }, homeButton(T.goHome), h('h1', {}, daily ? T.daily : p.title), counter);
  const paintCounter = () => {
    const answered = progress?.answers.filter((a) => a !== null).length ?? 0;
    counter.textContent = T.progress(answered, p.questions.length);
  };

  const renderQuestion = (qi: number): HTMLElement => {
    const q = p.questions[qi];
    const order = choiceOrder(seed, qi, q.choices.length);
    const chosen = progress?.answers[qi] ?? null;
    const done = chosen !== null;
    const tag = h('span', { class: 'tag' });
    tag.innerHTML = rubyHtml(T.qtype[q.type]);
    const card = h(
      'li',
      { class: `question${done ? (chosen === q.answer ? ' is-correct' : ' is-wrong') : ''}`, id: `q${qi + 1}` },
      h('p', { class: 'q-head' }, h('span', { class: 'q-num' }, T.qnum(qi + 1, p.questions.length)), tag),
      withRuby('p', 'q-text', q.text),
    );
    const list = h('ol', { class: 'choices' });
    order.forEach((ci, pos) => {
      const cls = ['choice', done && ci === q.answer && 'is-answer', done && ci === chosen && 'is-chosen'].filter(Boolean).join(' ');
      const btn = h(
        'button',
        { type: 'button', class: cls, disabled: done, 'aria-pressed': String(ci === chosen) },
        h('span', { class: 'choice-label' }, LABELS[pos]),
        withRuby('span', 'choice-text', q.choices[ci]),
      );
      if (done && ci === q.answer) btn.append(hanamaruMark());
      if (done && ci === chosen && ci !== q.answer) btn.append(h('span', { class: 'batsu', 'aria-hidden': 'true' }, '×'));
      if (!done) btn.addEventListener('click', () => choose(qi, ci));
      list.append(h('li', {}, btn));
    });
    card.append(list);
    if (done) {
      const ok = chosen === q.answer;
      const answerLabel = LABELS[order.indexOf(q.answer)];
      card.append(
        h(
          'div',
          { class: 'feedback' },
          h('p', { class: 'feedback-head' }, h('b', {}, ok ? T.correct : T.wrong), ok ? null : h('span', {}, T.answerIs(answerLabel))),
          h('p', { class: 'explain-title' }, T.explainTitle),
          withRuby('p', 'explain', q.explain),
          h('button', { type: 'button', class: 'btn check-evidence', onclick: () => jumpToEvidence(qi) }, T.evidenceShow),
        ),
      );
    }
    return card;
  };

  const choose = (qi: number, ci: number) => {
    primeSound();
    if (!progress) progress = startTry(p.id, p.questions.length);
    const q = p.questions[qi];
    const ok = ci === q.answer;
    const result = answer(p.id, progress, qi, ci, ok);
    progress = result.progress;
    if (ok) playCorrect();
    else playWrong();
    const fresh = renderQuestion(qi);
    qEls[qi].replaceWith(fresh);
    qEls[qi] = fresh;
    // 答えたらすぐに、本文の手がかりに印をつける (場所は動かさない)
    highlight(q.evidence);
    qEls.forEach((el, i) => el.classList.toggle('is-checking', i === qi));
    fresh.querySelector<HTMLElement>('.check-evidence')?.focus({ preventScroll: true });
    paintCounter();
    if (progress.done) void finish(result.points);
  };

  const finish = async (points: number) => {
    let stamp: StampReward | undefined;
    let dailyPoints = 0;
    if (daily && !dailyDone(daily)) {
      dailyPoints = addDailyClear(daily);
      stamp = addStamp(daily);
    }
    const correct = progress!.ok.filter(Boolean).length;
    const total = p.questions.length;
    if (correct === total) await playClear(['ぜんもん', 'せいかい']);
    openResult(p, { correct, total, points, dailyPoints, stamp, month: daily ? Number(daily.slice(5, 7)) : 0 });
    footer.replaceChildren(...footerItems());
  };

  p.questions.forEach((_, qi) => qEls.push(renderQuestion(qi)));

  const footer = h('div', { class: 'reader-foot' });
  const footerItems = (): HTMLElement[] => {
    const items: HTMLElement[] = [];
    const prev = prevPart(p);
    const next = nextPart(p);
    if (prev) items.push(h('a', { class: 'btn', href: `#/read/${prev.id}` }, T.previousPart));
    if (progress?.done) {
      items.push(
        h(
          'button',
          {
            type: 'button',
            class: 'btn',
            onclick: () => {
              if (!confirm(T.restartConfirm)) return;
              startTry(p.id, p.questions.length);
              show(root, p, opts);
              window.scrollTo(0, 0);
            },
          },
          T.again,
        ),
      );
    }
    if (next) items.push(h('a', { class: 'btn btn-primary', href: `#/read/${next.id}` }, T.nextPart));
    items.push(h('a', { class: 'btn', href: '#/' }, T.goHome));
    return items;
  };
  footer.replaceChildren(...footerItems());

  const questions = h(
    'section',
    { class: 'questions', 'aria-labelledby': 'questions-title' },
    h('h2', { id: 'questions-title', class: 'questions-title' }, T.questionsTitle),
    progress?.answers.some((a) => a !== null) ? null : h('p', { class: 'section-note' }, T.readFirst),
    h('ol', { class: 'question-list' }, ...qEls),
    footer,
  );

  paintCounter();
  root.replaceChildren(
    h(
      'div',
      { class: 'reader-page' },
      bar,
      h(
        'main',
        { class: 'reader' },
        h('div', { class: 'reader-text' }, h('div', { class: 'reader-meta' }, passageMeta(p), tools), passage),
        questions,
      ),
    ),
  );
}

function sourceLine(p: Passage): HTMLElement {
  if (p.source === 'original') return h('p', { class: 'passage-source' }, `${T.sourceLabel}：${T.original}`);
  return h(
    'p',
    { class: 'passage-source' },
    `${T.sourceLabel}：${p.author}『${p.title.replace(/（.*?）$/, '')}』（`,
    p.url ? h('a', { href: p.url, target: '_blank', rel: 'noopener' }, T.aozora) : T.aozora,
    '）',
    p.note ? h('span', { class: 'passage-note' }, ` ${p.note}`) : null,
  );
}

function viewButton(view: ViewPrefs, apply: (v: ViewPrefs) => void): HTMLElement {
  const btn = h('button', { type: 'button', class: 'btn btn-small' });
  const paint = () => {
    btn.textContent = view.tate ? T.viewYoko : T.viewTate;
  };
  btn.addEventListener('click', () => {
    view.tate = !view.tate;
    setView(view);
    apply(view);
    paint();
  });
  paint();
  return btn;
}

function sizeButton(view: ViewPrefs, apply: (v: ViewPrefs) => void): HTMLElement {
  const btn = h('button', { type: 'button', class: 'btn btn-small', 'aria-label': T.viewSize });
  const paint = () => {
    btn.textContent = `字：${T.viewSizes[view.size]}`;
  };
  btn.addEventListener('click', () => {
    view.size = ((view.size + 1) % 3) as ViewPrefs['size'];
    setView(view);
    apply(view);
    paint();
  });
  paint();
  return btn;
}

const smooth = (): ScrollBehavior => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

/** 正解の選択肢につける赤い丸 */
function hanamaruMark(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('class', 'maru');
  svg.setAttribute('aria-hidden', 'true');
  const c = document.createElementNS(ns, 'path');
  c.setAttribute('d', 'M50 8C78 6 95 26 92 52C89 78 66 94 42 91C18 88 4 68 9 44C13 24 32 10 56 12');
  svg.append(c);
  return svg;
}

interface ResultInfo {
  correct: number;
  total: number;
  /** はじめて解いたときの、正解の分のポイント */
  points: number;
  /** 今日のチャレンジの分のポイント */
  dailyPoints: number;
  stamp?: StampReward;
  month: number;
}

/** 全部の問題に答えたあとの画面 */
function openResult(p: Passage, r: ResultInfo): void {
  const stamp = r.stamp?.added ? r.stamp : undefined;
  const gained = r.points + r.dailyPoints + (stamp ? stamp.weekPoints + stamp.monthPoints : 0);
  const title = r.correct === r.total ? T.resultPerfect : r.correct * 2 >= r.total ? T.resultGood : T.resultTry;
  const next = nextPart(p);

  const rewards = h(
    'div',
    { class: 'result-stamp' },
    r.points > 0 ? h('p', { class: 'result-reward' }, T.rewardCorrect(r.points / POINTS_PER_CORRECT)) : null,
    r.dailyPoints > 0 ? h('p', { class: 'result-reward' }, T.rewardDaily) : null,
    stamp ? h('p', { class: 'result-stamp-title' }, T.stampDone) : null,
    stamp && stamp.weekPoints > 0 ? h('p', { class: 'result-reward' }, T.rewardWeek(stamp.run)) : null,
    stamp && stamp.monthPoints > 0 ? h('p', { class: 'result-reward' }, T.rewardMonth(r.month)) : null,
    gained === 0 ? h('p', { class: 'result-balance' }, T.rewardNone) : null,
    h('p', { class: 'result-balance' }, `${T.pointsLabel} ${T.points(balance())}`),
    stamp ? h('a', { class: 'btn', href: '#/stamps' }, T.seeStamps) : gained > 0 ? h('a', { class: 'btn', href: '#/cards' }, T.seeCards) : null,
  );

  const dialog = h('dialog', { class: 'result', 'aria-labelledby': 'result-title' });
  dialog.append(
    h(
      'div',
      { class: 'result-head' },
      r.correct * 2 >= r.total ? hanamaru() : null,
      h(
        'div',
        {},
        h('h2', { id: 'result-title' }, title),
        h('p', { class: 'result-score' }, T.resultScore(r.correct, r.total)),
        h('p', { class: 'result-sub' }, T.resultAdvice(r.correct, r.total)),
      ),
    ),
    rewards,
    h(
      'div',
      { class: 'result-actions' },
      h('button', { type: 'button', class: 'btn', onclick: () => dialog.close() }, T.seeAnswers),
      next ? h('a', { class: 'btn btn-primary', href: `#/read/${next.id}` }, T.nextPart) : h('a', { class: 'btn btn-primary', href: '#/' }, T.goHome),
    ),
  );
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  dialog.scrollTop = 0;
}
