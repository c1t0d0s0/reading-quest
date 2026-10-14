import { GENRES, GRADES, type Genre, type Grade, type PassageMeta } from '../core/reading';
import { getGrade, getScores, loadProgress, statusOf } from '../core/storage';
import { PASSAGES } from '../data/passages';
import { h, hanamaru, homeButton, rubyHtml } from './dom';
import { passageMeta } from './home';
import { T } from './text';

type ReadFilter = 'all' | 'unread' | 'read';

interface Filter {
  grade: Grade;
  genre: Genre | 'all';
  read: ReadFilter;
}

// 画面を行き来しても、えらんだしぼりこみをおぼえておく (ページを開き直したら元にもどる)
let remembered: Filter | null = null;

function chips<V extends string | number>(label: string, options: { value: V; text: string }[], current: V, onPick: (v: V) => void): HTMLElement {
  return h(
    'div',
    { class: 'chips', role: 'group', 'aria-label': label },
    ...options.map((o) => {
      const btn = h('button', { type: 'button', class: 'chip', 'aria-pressed': String(o.value === current), onclick: () => onPick(o.value) });
      btn.innerHTML = rubyHtml(o.text);
      return btn;
    }),
  );
}

function item(meta: PassageMeta, scores: Record<string, number>): HTMLElement {
  const status = statusOf(meta.id);
  const progress = loadProgress(meta.id);
  const latest = progress?.done ? progress.ok.filter(Boolean).length : null;
  const read = meta.id in scores || status === 'done';
  const badge =
    status === 'done' && latest !== null
      ? T.statusDone(latest, meta.qtypes.length)
      : status === 'playing'
        ? T.statusPlaying
        : read
          ? T.statusDone(scores[meta.id], meta.qtypes.length)
          : T.statusNew;
  return h(
    'li',
    {},
    h(
      'a',
      { class: `entry${read ? ' is-read' : ''}${status === 'playing' ? ' is-playing' : ''}`, href: `#/read/${meta.id}` },
      h('span', { class: 'entry-title' }, meta.title),
      passageMeta(meta),
      h('span', { class: 'entry-status' }, badge),
      read && latest === meta.qtypes.length ? hanamaru('hanamaru hanamaru-entry') : null,
    ),
  );
}

export function renderLibrary(root: HTMLElement): void {
  const filter: Filter = remembered ?? { grade: getGrade() ?? 1, genre: 'all', read: 'all' };
  remembered = filter;
  const scores = getScores();
  const isRead = (id: string) => id in scores || statusOf(id) === 'done';

  const inGrade = PASSAGES.filter((p) => p.grade === filter.grade);
  const shown = inGrade.filter(
    (p) =>
      (filter.genre === 'all' || p.genre === filter.genre) &&
      (filter.read === 'all' || (filter.read === 'read') === isRead(p.id)),
  );
  const genres = GENRES.filter((g) => inGrade.some((p) => p.genre === g));
  const rerender = (change: Partial<Filter>) => {
    Object.assign(filter, change);
    renderLibrary(root);
  };

  root.replaceChildren(
    h(
      'div',
      { class: 'library-page' },
      h('header', { class: 'bar' }, homeButton(T.goHome), h('h1', {}, T.libraryTitle), h('span', {})),
      h(
        'main',
        { class: 'library' },
        chips(T.gradeTitle, GRADES.map((g) => ({ value: g, text: T.gradeLabel(g) })), filter.grade, (g) => rerender({ grade: g, genre: 'all' })),
        chips('ジャンル', [{ value: 'all' as const, text: T.filterAll }, ...genres.map((g) => ({ value: g, text: T.genre[g] }))], filter.genre, (g) =>
          rerender({ genre: g }),
        ),
        chips<ReadFilter>(
          '読んだかどうか',
          [
            { value: 'all', text: T.filterAll },
            { value: 'unread', text: T.filterUnread },
            { value: 'read', text: T.filterRead },
          ],
          filter.read,
          (r) => rerender({ read: r }),
        ),
        h('p', { class: 'library-count' }, T.readCount(inGrade.filter((p) => isRead(p.id)).length, inGrade.length)),
        shown.length ? h('ul', { class: 'entries' }, ...shown.map((m) => item(m, scores))) : h('p', { class: 'section-note' }, T.emptyList),
        h('p', { class: 'page-foot' }, h('a', { class: 'btn btn-primary', href: '#/' }, T.goHome)),
      ),
    ),
  );
}
