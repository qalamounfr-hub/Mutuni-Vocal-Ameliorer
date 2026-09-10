/** Mono -> 16 kHz resampler avec filtre passe-bas anti-repliement.
 *  Émet des blocs bornés et transférables de 0.5 s ; supporte un flush explicite
 *  pour récupérer la fin de la récitation à l'arrêt du micro. */
class AudioStreamProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000;
    this.pending = [];
    this.phase = 0;
    this.resampled = [];
    this.filterState = 0;
    this.reportedRate = false;
    this.alpha = this.ratio > 1 ? 1 - Math.exp(-2 * Math.PI * 0.45 / this.ratio) : 1;
    this.block = 8000; // 0.5 s à 16 kHz
    this.port.onmessage = (event) => {
      if (event.data?.type === 'reset') {
        this.pending = [];
        this.resampled = [];
        this.phase = 0;
        this.filterState = 0;
        this.reportedRate = false;
      }
      if (event.data?.type === 'flush') {
        this.emit(true);
        this.port.postMessage({type: 'flushed'});
      }
    };
  }
  emit(force = false) {
    while (this.resampled.length >= this.block || (force && this.resampled.length)) {
      const n = Math.min(this.block, this.resampled.length);
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) out[i] = this.resampled[i];
      this.resampled.splice(0, n);
      this.port.postMessage(out, [out.buffer]);
    }
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    if (!this.reportedRate) {
      this.port.postMessage({type: 'sample-rate', sampleRate});
      this.reportedRate = true;
    }
    for (let i = 0; i < input.length; i += 1) {
      this.filterState += this.alpha * (input[i] - this.filterState);
      this.pending.push(this.filterState);
    }
    const available = Math.max(0, Math.floor((this.pending.length - 1 - this.phase) / this.ratio) + 1);
    for (let i = 0; i < available; i += 1) {
      const position = this.phase + i * this.ratio;
      const left = Math.floor(position);
      const fraction = position - left;
      const a = this.pending[left] ?? 0;
      const b = this.pending[left + 1] ?? a;
      this.resampled.push(a + (b - a) * fraction);
    }
    this.phase += available * this.ratio;
    const consumed = Math.floor(this.phase);
    this.pending = this.pending.slice(consumed);
    this.phase -= consumed;
    this.emit();
    return true;
  }
}
registerProcessor('audio-stream-processor', AudioStreamProcessor);
