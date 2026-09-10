import type {NavigateFn, ScreenParams} from './router';
import {listMatns, listBabs, listBayts} from './mutuniDB';

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));

export function renderChaptersScreen(root: HTMLElement, params: ScreenParams, navigate: NavigateFn) {
  const {matnId} = params;
  if (!matnId) { root.innerHTML = `<div class="app-error">Matn non spécifié.</div>`; return; }

  root.innerHTML = `
    <header class="screen-header">
      <button class="screen-back" id="back">←</button>
      <div class="screen-title" id="title">Chapitres</div>
      <div class="screen-header-spacer"></div>
    </header>
    <div class="chapters-list" id="list">Chargement…</div>
  `;
  const $ = <T extends HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
  $('back').addEventListener('click', () => navigate('home'));

  void (async () => {
    const [matns, babs] = await Promise.all([listMatns(), listBabs(matnId)]);
    const matn = matns.find(m => m.id === matnId);
    $('title').textContent = matn?.title ?? matnId;
    if (!babs.length) { $('list').innerHTML = '<div class="home-empty">Aucun chapitre.</div>'; return; }

    const baytCounts = await Promise.all(babs.map(b => listBayts(b.id)));
    $('list').innerHTML = babs.map((b, i) => `
      <button class="chapter-card" data-bab="${esc(b.id)}" style="${b.clr ? `border-color:${esc(b.clr[0])}` : ''}">
        <span class="chapter-title">${esc(b.title)}</span>
        ${b.sub ? `<span class="chapter-sub">${esc(b.sub)}</span>` : ''}
        <span class="chapter-count">${baytCounts[i].length} bayts</span>
      </button>
    `).join('');
    $('list').addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-bab]');
      if (!btn) return;
      navigate('recite', {matnId, babId: btn.dataset.bab, baytIdx: 0});
    });
  })();
}
