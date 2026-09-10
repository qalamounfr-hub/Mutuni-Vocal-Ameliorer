import type {LiveWord} from './liveCursor';

export interface LearningLevel { id: number; icon: string; label: string; }

// Porté depuis l'ancienne interface (mutuni-optimized) — 5 niveaux d'aide
// progressive, du texte entièrement visible à l'écran vide.
export const LEARNING_LEVELS: LearningLevel[] = [
  {id: 1, icon: '👁️', label: 'Lecture'},      // tout visible
  {id: 2, icon: '🌤️', label: 'Assisté'},      // 1 mot sur 3 visible avant récitation
  {id: 3, icon: '🎯', label: 'Standard'},      // rien de pré-révélé (comportement par défaut)
  {id: 4, icon: '🌱', label: 'Amorce'},        // seul le premier mot visible
  {id: 5, icon: '⬛', label: 'Vide'},          // écran vide, distinct visuellement de 'Standard'
];
export const DEFAULT_LEARNING_LEVEL = 3;

/** Quels mots sont pré-révélés avant même d'avoir été récités, selon le niveau. */
export function maskWordsForLevel(wordCount: number, level: number): boolean[] {
  const arr = new Array(wordCount).fill(false);
  if (level === 1) return arr.fill(true);
  if (level === 2) { for (let i = 0; i < wordCount; i++) arr[i] = (i % 3 === 0); return arr; }
  if (level === 4) { if (wordCount > 0) arr[0] = true; return arr; }
  return arr; // niveaux 3 et 5 : rien de pré-révélé
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));
const HARAKAT = /[\u064B-\u065F\u0670\u0640]/g;

/**
 * Rend les mots d'un bayt en cours de récitation. Un mot non révélé (pas
 * encore 'matched'/'skipped', et pas pré-révélé par le niveau d'aide)
 * s'affiche comme une pastille grisée de la largeur du mot (pas le texte en
 * clair) — porté fidèlement du composant Word de l'ancienne interface
 * (pastille 24px de haut, largeur ≈ nb de lettres sans harakat × 11px,
 * dégradé vert clair quand le mot actif est en cours de prononciation).
 * Niveau 5 : les pastilles restent grisées même après validation ("vide").
 */
export function renderReciteWords(el: HTMLElement, words: LiveWord[], level: number, activeIndex: number) {
  const preRevealed = maskWordsForLevel(words.length, level);
  el.innerHTML = words.map((w, i) => {
    const isRevealed = w.status === 'matched' || w.status === 'skipped' || preRevealed[i];
    const showText = isRevealed && level !== 5;
    if (!showText) {
      const len = Math.max(1, w.expected.replace(HARAKAT, '').length);
      const isActive = i === activeIndex;
      const bg = isActive
        ? 'linear-gradient(180deg,rgba(168,212,182,0.30),rgba(168,212,182,0.12))'
        : 'var(--wrd-bg)';
      const bord = isActive ? '1px solid rgba(168,212,182,0.4)' : '1px solid var(--cbord)';
      return `<span class="recite-word-pill" style="min-width:${Math.max(18, len * 11)}px;background:${bg};border:${bord}"></span>`;
    }
    const isFuzzy = w.status === 'skipped';
    return `<span class="recite-word-text${isFuzzy ? ' recite-word-fuzzy' : ''}">${esc(w.expected)}</span>`;
  }).join('');
}

/** Premier mot pas encore résolu (pending) — le mot "actif" que le récitant doit dire. */
export function activeWordIndex(words: LiveWord[]): number {
  return words.findIndex(w => w.status === 'pending');
}
