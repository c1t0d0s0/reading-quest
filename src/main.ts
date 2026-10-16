import './styles.css';
import { restoreStore, startCloud } from './cloud';
import { dailyPassage } from './core/daily';
import { jstDate } from './core/date';
import { getGrade, gradeFromSearch, migrateCardPrices, setGrade } from './core/storage';
import { CARDS } from './data/cards';
import { PASSAGES } from './data/passages';
import { renderCards } from './ui/cards';
import { renderHome } from './ui/home';
import { renderLibrary } from './ui/library';
import { renderRead } from './ui/read';
import { renderRecord } from './ui/record';
import { renderStamps } from './ui/stamps';
import { T } from './ui/text';

// 前にログインしていた人がいれば、通信を待たずに、この端末に残っているその人の写しで画面を出す
const queryGrade = gradeFromSearch(location.search);
if (queryGrade !== null) setGrade(queryGrade);
restoreStore();
if (queryGrade !== null) setGrade(queryGrade);
migrateCardPrices(CARDS);

const app = document.getElementById('app')!;
let cleanup: (() => void) | null = null;
/** 今の画面が、ログインの状態を出しているホームか */
let onHome = false;

function route(): void {
  cleanup?.();
  cleanup = null;
  onHome = false;
  document.querySelectorAll('dialog, .fx').forEach((d) => d.remove());

  const hash = location.hash;
  const read = hash.match(/^#\/read\/([a-z0-9-]+)$/);
  const grade = getGrade();
  if (hash === '#/daily' && grade !== null) {
    const today = jstDate();
    const meta = dailyPassage(PASSAGES, grade, today);
    if (meta) cleanup = renderRead(app, meta.id, { daily: today });
    else renderHome(app);
  } else if (read) {
    cleanup = renderRead(app, read[1]);
  } else if (hash === '#/library') {
    renderLibrary(app);
  } else if (hash === '#/record') {
    renderRecord(app);
  } else if (hash === '#/cards') {
    renderCards(app);
  } else if (hash === '#/stamps') {
    renderStamps(app);
  } else {
    renderHome(app);
    onHome = true;
  }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
route();

// 最初の画面を出してから、ログインと Firestore の準備をする (Firebase の設定がないビルドでは何もしない)
void startCloud({
  // ログインやほぞんの状態が変わった。状態を出しているのはホームだけ
  onStatus: () => {
    if (onHome) renderHome(app);
  },
  // Firestore から取りこんで、手元の記録が変わった。読んでいるとちゅうでなければ、今の画面をかき直す
  onData: () => {
    migrateCardPrices(CARDS); // ほかの端末で、値下げ前の値段で交換した記録が入ってくることがある
    if (!app.querySelector('.reader')) route();
  },
  askMigrate: () => confirm(T.askMigrate),
});
