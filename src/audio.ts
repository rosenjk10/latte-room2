class CafeAudio {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  enabled = false;
  timer: ReturnType<typeof setInterval> | null = null;
  async toggle() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.ctx.destination);
      const buffer = this.ctx.createBuffer(
        1,
        this.ctx.sampleRate * 3,
        this.ctx.sampleRate,
      );
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < data.length; i++) {
        last = (last + (Math.random() * 2 - 1) * 0.025) / 1.025;
        data[i] = last;
      }
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 850;
      source.connect(filter);
      filter.connect(this.master);
      source.start();
      let step = 0;
      const notes = [261.63, 329.63, 392, 493.88, 440, 392, 329.63, 293.66];
      this.timer = setInterval(() => {
        if (this.enabled) {
          this.tone(notes[step++ % notes.length], 1.8, 0.035, "sine");
        }
      }, 850);
    }
    await this.ctx.resume();
    this.enabled = !this.enabled;
    this.master!.gain.setTargetAtTime(
      this.enabled ? 0.7 : 0,
      this.ctx.currentTime,
      0.15,
    );
    return this.enabled;
  }
  tone(freq: number, duration: number, volume: number, type: OscillatorType) {
    if (!this.enabled || !this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator(),
      gain = this.ctx.createGain(),
      t = this.ctx.currentTime;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(t + duration);
  }
  pop() {
    this.tone(650, 0.12, 0.3, "sine");
    if (this.ctx) this.tone(1100, 0.075, 0.12, "triangle");
  }
}
export const audio = new CafeAudio();
