import { jstDate } from '../core/date';
import { GRADES } from '../core/reading';
import { currentRun } from '../core/rewards';
import { typeStats, weakest } from '../core/stats';
import { allProgress, getScores, getStamps } from '../core/storage';
import { PASSAGES, metaOf } from '../data/passages';
import { h, homeButton, rubyHtml } from './dom';
import { T } from './text';

/** きろくの画面。読んだ量と、問題のタイプごとの正答率 (苦手なタイプ) を見る */
export function renderRecord(root: HTMLElement): void {
  const scores = getScores();
  const progress = allProgress();
  const readIds = PASSAGES.filter((p) => p.id in scores || progress[p.id]?.done).map((p) => p.id);
  const chars = readIds.reduce((sum, id) => sum + (metaOf(id)?.chars ?? 0), 0);
  const stats = typeStats(progress, metaOf).filter((s) => s.answered > 0);
  const weak = weakest(stats);

  const tile = (label: string, value: string) => h('div', { class: 'stat' }, h('span', { class: 'stat-label' }, label), h('b', { class: 'stat-num' }, value));

  const bars = stats.length
    ? h(
        'ul',
        { class: 'rates' },
        ...stats
          .sort((a, b) => a.correct / a.answered - b.correct / b.answered)
          .map((s) => {
            const rate = Math.round((s.correct / s.answered) * 100);
            const label = h('span', { class: 'rate-label' });
            label.innerHTML = rubyHtml(T.qtype[s.type]);
            return h(
              'li',
              { class: `rate${weak?.type === s.type ? ' is-weak' : ''}` },
              label,
              h(
                'span',
                { class: 'rate-bar', role: 'img', 'aria-label': `${rate}%` },
                h('span', { class: 'rate-fill', style: `width: ${rate}%` }),
              ),
              h('span', { class: 'rate-num' }, `${rate}%`),
              h('span', { class: 'rate-count' }, T.recordRate(s.correct, s.answered)),
            );
          }),
      )
    : h('p', { class: 'section-note' }, T.recordNone);

  const byGrade = h(
    'ul',
    { class: 'by-grade' },
    ...GRADES.map((g) => {
      const all = PASSAGES.filter((p) => p.grade === g);
      const read = all.filter((p) => readIds.includes(p.id)).length;
      return h(
        'li',
        {},
        h('span', { class: 'by-grade-label' }, T.gradeLabel(g)),
        h('span', { class: 'rate-bar' }, h('span', { class: 'rate-fill', style: `width: ${all.length ? (read / all.length) * 100 : 0}%` })),
        h('span', { class: 'rate-count' }, `${read} / ${all.length}`),
      );
    }),
  );

  root.replaceChildren(
    h(
      'div',
      { class: 'record-page' },
      h('header', { class: 'bar' }, homeButton(T.goHome), h('h1', {}, T.recordTitle), h('span', {})),
      h(
        'main',
        { class: 'record' },
        h(
          'div',
          { class: 'stats' },
          tile(T.recordRead, T.recordCount(readIds.length)),
          tile(T.recordChars, T.chars(chars)),
          tile(T.recordStreak, T.recordDays(currentRun(getStamps(), jstDate()))),
        ),
        h(
          'section',
          { 'aria-labelledby': 'types-title' },
          h('h2', { id: 'types-title' }, T.recordTypes),
          h('p', { class: 'section-note' }, T.recordTypesNote),
          bars,
          stats.length ? h('p', { class: 'weak-note' }, weak ? T.recordWeak(T.qtype[weak.type].replace(/\{([^|]*)\|[^}]*\}/g, '$1')) : T.recordNoWeak) : null,
        ),
        h('section', { 'aria-labelledby': 'grade-title' }, h('h2', { id: 'grade-title' }, T.recordByGrade), byGrade),
        h('p', { class: 'page-foot' }, h('a', { class: 'btn btn-primary', href: '#/' }, T.goHome)),
      ),
    ),
  );
}
