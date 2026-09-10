import type {NavigateFn, ScreenParams} from './router';
import {listBayts, Bayt} from './mutuniDB';
import {LiveCursor} from './liveCursor';
import {MicEngine} from './micEngine';
import {renderReciteWords, activeWordIndex, LEARNING_LEVELS, DEFAULT_LEARNING_LEVEL} from './reciteView';
import {getBaytState, putBaytState, applySrsResult} from './srs';

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));

let sharedMicEngine: MicEngine | null = null;
function getMicEngine(): MicEngine {
  if (!sharedMicEngine) sharedMicEngine = new MicEngine();
  return sharedMicEngine;
}

export function renderReciteScreen(root: HTMLElement, params: ScreenParams, navigate: NavigateFn) {
  const {baytIdx = 0} = params;
  if (!params.matnId || !params.babId) { root.innerHTML = `<div class="app-error">Bayt non spécifié.</div>`; return; }
  const matnId: string = params.matnId;
  const babId: string = params.babId;

  root.innerHTML = `
    <header class="screen-header">
      <button class="screen-back" id="back">←</button>
      <div class="screen-title" id="screenTitle">Récitation</div>
      <div class="screen-header-spacer"></div>
    </header>
    <div class="recite-levels" id="levels"></div>
    <div class="recite-words" id="words" dir="rtl"></div>
    <div class="recite-progress" id="progressBar"></div>
    <div class="recite-controls">
      <button class="recite-mic" id="micBtn" aria-label="Démarrer la récitation">🎤</button>
      <div class="recite-status" id="micStatus">Appuie pour réciter</div>
    </div>
    <div class="recite-nav">
      <button id="prevBayt">← Précédent</button>
      <button id="resetBayt">↺ Recommencer</button>
      <button id="nextBayt">Suivant →</button>
    </div>
  `;

  const $ = <T extends HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
  let level = DEFAULT_LEARNING_LEVEL;
  let cursor: LiveCursor | null = null;
  let bayts: Bayt[] = [];
  let currentIdx = baytIdx;
  let heardWords: string[] = [];
  let recording = false;
  let cancelled = false;

  const levelsEl = $('levels');
  levelsEl.innerHTML = LEARNING_LEVELS.map(l =>
    `<button class="level-chip${l.id === level ? ' level-chip-active' : ''}" data-level="${l.id}">${l.icon} ${esc(l.label)}</button>`
  ).join('');
  levelsEl.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-level]');
    if (!btn) return;
    level = Number(btn.dataset.level);
    levelsEl.querySelectorAll('.level-chip').forEach(c => c.classList.toggle('level-chip-active', c === btn));
    renderWords();
  });

  function renderWords() {
    if (!cursor) return;
    const snap = cursor.snapshot();
    renderReciteWords($('words'), snap, level, activeWordIndex(snap));
    const r = cursor.report();
    $('progressBar').textContent = `${r.matched + r.skipped}/${r.total} mots`;
  }

  async function loadBayt(idx: number) {
    bayts = await listBayts(babId);
    if (!bayts.length) { root.innerHTML = `<div class="app-error">Aucun bayt dans ce bab.</div>`; return; }
    currentIdx = Math.max(0, Math.min(bayts.length - 1, idx));
    const bayt = bayts[currentIdx];
    cursor = new LiveCursor(bayt.textHaraka);
    heardWords = [];
    $('screenTitle').textContent = `Bayt ${currentIdx + 1} / ${bayts.length}`;
    renderWords();
  }

  const engine = getMicEngine();
  const micBtn = $('micBtn');
  const micStatus = $('micStatus');

  async function finishAttempt() {
    if (!cursor) return;
    const r = cursor.report();
    const coverage = r.total ? (r.matched + r.skipped) / r.total : 0;
    try {
      const bayt = bayts[currentIdx];
      const state = await getBaytState(matnId, babId, bayt.order - 1);
      await putBaytState(matnId, babId, bayt.order - 1, applySrsResult(state, coverage));
    } catch { /* SRS best-effort : ne bloque jamais la récitation si ça échoue */ }
  }

  micBtn.addEventListener('click', async () => {
    if (recording) {
      recording = false;
      micBtn.textContent = '🎤';
      micStatus.textContent = 'Traitement…';
      await engine.stop();
      return;
    }
    if (!engine.isReady()) { micStatus.textContent = 'Moteur en cours de chargement…'; return; }
    recording = true;
    micBtn.textContent = '⏹';
    micStatus.textContent = 'Écoute…';
    try {
      await engine.start();
    } catch (e) {
      recording = false;
      micBtn.textContent = '🎤';
      micStatus.textContent = 'Micro refusé ou indisponible.';
    }
  });

  const cbResult = (text: string) => {
    if (cancelled || !text.trim()) return;
    heardWords.push(...text.trim().split(/\s+/).filter(Boolean));
    cursor?.advance(heardWords);
    renderWords();
  };
  const cbSessionEnded = () => { if (!cancelled) { micStatus.textContent = 'Appuie pour réciter'; void finishAttempt(); } };
  const cbError = (msg: string) => { if (!cancelled) micStatus.textContent = 'Erreur: ' + msg; };
  const cbReady = () => { if (!cancelled) micStatus.textContent = 'Prêt — appuie pour réciter'; };
  const cbStatus = (msg: string) => { if (!cancelled && !engine.isReady()) micStatus.textContent = msg; };

  engine.setCallbacks({onResult: cbResult, onSessionEnded: cbSessionEnded, onError: cbError, onReady: cbReady, onStatus: cbStatus});
  if (!engine.isReady()) engine.init();

  async function switchBayt(idx: number) {
    if (recording) { recording = false; micBtn.textContent = '🎤'; await engine.stop(); }
    await loadBayt(idx);
  }

  $('prevBayt').addEventListener('click', () => void switchBayt(currentIdx - 1));
  $('nextBayt').addEventListener('click', () => void switchBayt(currentIdx + 1));
  $('resetBayt').addEventListener('click', () => void switchBayt(currentIdx));
  $('back').addEventListener('click', () => navigate('chapters', {matnId}));

  void loadBayt(currentIdx);

  return () => { cancelled = true; if (recording) void engine.stop(); };
}
