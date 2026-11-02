import { createBrewAudio, type BrewAudioHandle } from "./brewAudio";
import type { Drink } from "./model";
export type AudioSettings = { music: number; effects: number; muted: boolean };
export type Sound = "pop" | "cup" | "sip" | "eat" | "step" | "page" | "water";
export function readAudioSettings(): AudioSettings {
  try {
    const s = JSON.parse(localStorage.getItem("latte:audio") || "{}");
    return {
      music: level(s.music, 0.45),
      effects: level(s.effects, 0.6),
      muted: typeof s.muted === "boolean" ? s.muted : true,
    };
  } catch {
    return { music: 0.45, effects: 0.6, muted: true };
  }
}
const level = (n: unknown, fallback: number) =>
  typeof n === "number" && Number.isFinite(n)
    ? Math.max(0, Math.min(1, n))
    : fallback;
export class CafeAudio {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  music: GainNode | null = null;
  effects: GainNode | null = null;
  settings = readAudioSettings();
  unlocked = false;
  private stepAt = 0;
  private brew: BrewAudioHandle | null = null;
  startBrew(drink: Drink, startedAt: number) {
    this.stopBrew();
    if (!this.enabled || !this.ctx || !this.effects) return;
    this.brew = createBrewAudio(
      this.ctx,
      this.effects,
      drink,
      this.ctx.currentTime + Math.max(0, (startedAt - Date.now()) / 1000),
    );
  }
  stopBrew() {
    this.brew?.cancel();
    this.brew = null;
  }
  get enabled() {
    return this.unlocked && !this.settings.muted;
  }
  private init() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.music = this.ctx.createGain();
    this.effects = this.ctx.createGain();
    this.master.gain.value = 0;
    this.music.connect(this.master);
    this.effects.connect(this.master);
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
    const ambience = this.ctx.createBufferSource();
    ambience.buffer = buffer;
    ambience.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 700;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.4;
    ambience.connect(filter);
    filter.connect(gain);
    gain.connect(this.music);
    ambience.start();
    let index = 0;
    const notes = [261.63, 329.63, 392, 493.88, 440, 392, 329.63, 293.66];
    setInterval(() => {
      if (this.enabled) {
        this.tone(notes[index++ % notes.length], 1.7, 0.045, "sine", "music");
        if (index % 12 === 0) this.tone(1700, 0.12, 0.012, "sine", "music");
      }
    }, 850);
  }
  async unlock() {
    this.init();
    await this.ctx!.resume();
    this.unlocked = true;
    this.apply();
  }
  async toggle() {
    const wasUnlocked = this.unlocked;
    await this.unlock();
    this.set({ muted: wasUnlocked ? !this.settings.muted : false });
    return this.enabled;
  }
  set(update: Partial<AudioSettings>) {
    this.settings = {
      music: level(update.music, this.settings.music),
      effects: level(update.effects, this.settings.effects),
      muted: update.muted ?? this.settings.muted,
    };
    try {
      localStorage.setItem("latte:audio", JSON.stringify(this.settings));
    } catch {
      /* Storage can be disabled. */
    }
    if (this.settings.muted) this.stopBrew();
    this.apply();
  }
  private apply() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master!.gain.setTargetAtTime(this.enabled ? 0.7 : 0, t, 0.08);
    this.music!.gain.setTargetAtTime(this.settings.music, t, 0.08);
    this.effects!.gain.setTargetAtTime(this.settings.effects, t, 0.03);
  }
  private tone(
    freq: number,
    duration: number,
    volume: number,
    type: OscillatorType,
    bus: "music" | "effects" = "effects",
    delay = 0,
  ) {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator(),
      g = this.ctx.createGain(),
      t = this.ctx.currentTime + delay;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g);
    g.connect(this[bus]!);
    osc.start(t);
    osc.stop(t + duration);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  }
  private noise(
    duration: number,
    volume: number,
    frequency: number,
    delay = 0,
  ) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime + delay,
      b = this.ctx.createBuffer(
        1,
        Math.ceil(this.ctx.sampleRate * duration),
        this.ctx.sampleRate,
      ),
      d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++)
      d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = this.ctx.createBufferSource(),
      f = this.ctx.createBiquadFilter(),
      g = this.ctx.createGain();
    s.buffer = b;
    f.type = "lowpass";
    f.frequency.value = frequency;
    g.gain.value = volume;
    s.connect(f);
    f.connect(g);
    g.connect(this.effects!);
    s.start(t);
    s.onended = () => {
      s.disconnect();
      f.disconnect();
      g.disconnect();
    };
  }
  play(sound: Sound) {
    switch (sound) {
      case "page":
        this.noise(0.22, 0.07, 2500);
        break;
      case "water":
        this.noise(1.3, 0.1, 1900);
        for (let i = 0; i < 5; i++)
          this.tone(900 + i * 90, 0.09, 0.04, "sine", "effects", i * 0.18);
        break;
      case "pop":
        this.tone(650, 0.12, 0.3, "sine");
        this.tone(1100, 0.075, 0.12, "triangle");
        break;
      case "cup":
        this.tone(1400, 0.18, 0.12, "sine");
        this.tone(2100, 0.12, 0.06, "sine", "effects", 0.025);
        break;
      case "sip":
        this.noise(0.45, 0.1, 1700);
        this.tone(360, 0.14, 0.06, "sine", "effects", 0.4);
        break;
      case "eat":
        this.noise(0.12, 0.14, 2600);
        this.noise(0.09, 0.08, 1900, 0.22);
        break;
      case "step":
        if (performance.now() - this.stepAt < 330) return;
        this.stepAt = performance.now();
        this.noise(0.07, 0.08, 380);
        break;
    }
  }
  pop() {
    this.play("pop");
  }
}
// All audio is synthesized here; no third-party recordings or copyrighted assets.
export const audio = new CafeAudio();
