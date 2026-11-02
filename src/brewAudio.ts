import { brewPlan, type BrewStage } from "./brewing";
import type { Drink } from "./model";
export type BrewAudioHandle = {
  cancel: () => void;
  activeSources: () => number;
};
/** A finite, cancellable Web Audio score. Every sound uses the same plan as the 3D machine. */
export function createBrewAudio(
  ctx: AudioContext,
  destination: AudioNode,
  drink: Drink,
  start = ctx.currentTime,
): BrewAudioHandle {
  const gain = ctx.createGain();
  gain.gain.value = 1;
  gain.connect(destination);
  const sources = new Set<AudioScheduledSourceNode>(),
    nodes = new Set<AudioNode>([gain]);
  let closed = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    nodes.forEach((n) => n.disconnect());
    nodes.clear();
  };
  function register(
    source: AudioScheduledSourceNode,
    time: number,
    duration: number,
  ) {
    sources.add(source);
    nodes.add(source);
    source.onended = () => {
      sources.delete(source);
      source.disconnect();
      nodes.delete(source);
      if (sources.size === 0) cleanup();
    };
    source.start(time);
    source.stop(time + duration);
  }
  function envelope(time: number, duration: number, volume: number) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(volume, time + 0.025);
    g.gain.setValueAtTime(volume, time + Math.max(0.026, duration - 0.07));
    g.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    g.connect(gain);
    nodes.add(g);
    return g;
  }
  function tone(
    time: number,
    duration: number,
    freq: number,
    volume: number,
    type: OscillatorType = "sine",
    endFreq = freq,
  ) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.linearRampToValueAtTime(endFreq, time + duration);
    osc.connect(envelope(time, duration, volume));
    register(osc, time, duration);
  }
  function noise(
    time: number,
    duration: number,
    frequency: number,
    volume: number,
    stage: BrewStage,
  ) {
    const buffer = ctx.createBuffer(
        1,
        Math.ceil(ctx.sampleRate * duration),
        ctx.sampleRate,
      ),
      data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / ctx.sampleRate,
        pulse =
          stage === "grind"
            ? 0.55 + 0.45 * Math.sin(t * 35 * Math.PI * 2) ** 2
            : stage === "extract"
              ? 0.55 + 0.45 * Math.sin(t * 7 * Math.PI * 2) ** 2
              : 1;
      data[i] = (Math.random() * 2 - 1) * pulse;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = stage === "steam" ? "bandpass" : "lowpass";
    filter.Q.value = stage === "steam" ? 0.6 : 1;
    filter.frequency.setValueAtTime(frequency, time);
    filter.frequency.linearRampToValueAtTime(
      stage === "steam" ? 2800 : frequency * 0.8,
      time + duration,
    );
    source.connect(filter);
    filter.connect(envelope(time, duration, volume));
    nodes.add(filter);
    register(source, time, duration);
  }
  for (const step of brewPlan(drink).steps) {
    const t = start + step.start / 1000,
      d = step.duration / 1000;
    switch (step.stage) {
      case "grind":
        noise(t, d, 1500, 0.15, "grind");
        tone(t, d, 240, 0.025, "sawtooth", 320);
        break;
      case "pump":
        tone(t, d, 65, 0.1, "triangle", 90);
        noise(t, d, 350, 0.07, "pump");
        break;
      case "extract":
        noise(t, d, 1700, 0.055, "extract");
        for (let i = 0; i < 10; i++)
          tone(
            t + 0.08 + i * 0.2,
            0.09,
            1050 + (i % 3) * 180,
            0.035,
            "sine",
            650,
          );
        break;
      case "steam":
        noise(t, d, 4300, 0.12, "steam");
        tone(t, d, 2100, 0.012, "sine", 2600);
        break;
      case "ready":
        tone(t, 0.28, 880, 0.1);
        tone(t + 0.1, 0.28, 1320, 0.075);
        break;
    }
  }
  return {
    activeSources: () => sources.size,
    cancel: () => {
      if (closed) return;
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      sources.forEach((source) => {
        source.onended = null;
        source.stop(ctx.currentTime);
      });
      sources.clear();
      cleanup();
    },
  };
}
