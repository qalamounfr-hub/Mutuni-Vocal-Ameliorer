import {normalizeArabic} from './normalize';

const WORD_PREFIX = '▁';

export interface TimedWord {
  text: string;
  // Frame CTC (indice temporel dans la fenêtre courante) à laquelle ce mot
  // a commencé à être décodé. Sert à découper proprement le recouvrement
  // entre deux fenêtres sur l'axe du temps plutôt que sur le texte.
  startFrame: number;
}

export interface DecodeResult {
  tokenIds: number[];
  text: string;
  words: TimedWord[];
}

export class TextCTCDecoder {
  vocab = new Map<number, string>();
  blankId: number;

  constructor(vocab: Record<string, string>, blankId = 1024) {
    for (const [id, t] of Object.entries(vocab)) this.vocab.set(Number(id), t);
    this.blankId = blankId;
  }

  decode(logprobs: Float32Array, timeSteps: number, vocabSize: number): DecodeResult {
    const frames: number[] = [];
    for (let t = 0; t < timeSteps; t++) {
      let best = 0, bestVal = logprobs[t * vocabSize];
      for (let v = 1; v < vocabSize; v++) {
        const x = logprobs[t * vocabSize + v];
        if (x > bestVal) { bestVal = x; best = v; }
      }
      frames.push(best);
    }

    // Collapse CTC standard (dédoublonne les répétitions, retire les blancs)
    // en conservant, pour chaque token gardé, la frame à laquelle il apparaît
    // pour la première fois dans ce run.
    const ids: number[] = [];
    const idFrames: number[] = [];
    let prev = -1;
    for (let t = 0; t < frames.length; t += 1) {
      const id = frames[t];
      if (id !== prev && id !== this.blankId) { ids.push(id); idFrames.push(t); }
      prev = id;
    }

    // Regroupe les tokens en mots : un token commençant par WORD_PREFIX (▁)
    // démarre un nouveau mot ; sa frame de départ devient celle du mot.
    const words: TimedWord[] = [];
    let current = '';
    let currentStartFrame = -1;
    const flush = () => {
      const cleaned = current.trim();
      if (cleaned) words.push({text: cleaned, startFrame: currentStartFrame});
      current = '';
    };
    for (let i = 0; i < ids.length; i += 1) {
      const raw = this.vocab.get(ids[i]) ?? '';
      if (!raw || raw === '<unk>' || raw === '<blank>') continue;
      const startsNewWord = raw.startsWith(WORD_PREFIX) || current === '';
      if (startsNewWord && current !== '') flush();
      if (current === '') currentStartFrame = idFrames[i];
      current += raw.replace(/▁/g, '');
    }
    flush();

    const text = normalizeArabic(words.map(w => w.text).join(' ')).trim();
    return {tokenIds: ids, text, words};
  }
}
