// Paramètres ajustables du flux audio.
// Restaurés à 3 s / hop 1,5 s (config d'origine, CHANGE-REPORT.md) : la
// version à 1,5 s / 1,0 s réduisait trop le contexte acoustique fourni au
// FastConformer et dégradait nettement la reconnaissance (comparé à Lab v5).
export const AUDIO_WINDOW_SECONDS=3.0;
export const AUDIO_HOP_SECONDS=1.5;
export const AUDIO_WINDOW=Math.round(16000*AUDIO_WINDOW_SECONDS);
export const AUDIO_HOP=Math.round(16000*AUDIO_HOP_SECONDS);
export const AUDIO_MIN_TAIL=8000;
export const CONSTRAINED_DECODING_ENABLED=true;
export const ALIGNMENT_BAND=15;
