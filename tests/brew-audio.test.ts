import { describe, it, expect } from "vitest";
import { createBrewAudio } from "../src/brewAudio";
import { CafeAudio } from "../src/audio";
class Param {
  value = 0;
  events: { value: number; time: number }[] = [];
  setValueAtTime(value: number, time: number) {
    this.events.push({ value, time });
    return this;
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.events.push({ value, time });
    return this;
  }
  exponentialRampToValueAtTime(value: number, time: number) {
    this.events.push({ value, time });
    return this;
  }
  cancelScheduledValues() {
    return this;
  }
  setTargetAtTime() {
    return this;
  }
}
class Node {
  frequency = new Param();
  gain = new Param();
  Q = new Param();
  type = "";
  buffer: unknown;
  onended: (() => void) | null = null;
  starts: number[] = [];
  stops: number[] = [];
  disconnected = false;
  destination: unknown;
  connect(n: unknown) {
    this.destination = n;
    return n;
  }
  disconnect() {
    this.disconnected = true;
  }
  start(time: number) {
    this.starts.push(time);
  }
  stop(time: number) {
    this.stops.push(time);
  }
}
class Context {
  currentTime = 10;
  sampleRate = 8000;
  nodes: Node[] = [];
  node() {
    const n = new Node();
    this.nodes.push(n);
    return n;
  }
  createGain() {
    return this.node();
  }
  createOscillator() {
    return this.node();
  }
  createBufferSource() {
    return this.node();
  }
  createBiquadFilter() {
    return this.node();
  }
  createBuffer(_channels: number, length: number) {
    return { getChannelData: () => new Float32Array(length) };
  }
}
function setup() {
  const context = new Context(),
    destination = new Node();
  return {
    context,
    destination,
    ctx: context as unknown as AudioContext,
    bus: destination as unknown as AudioNode,
  };
}
describe("finite synthesized ASMR through the effects bus", () => {
  it("schedules grinder, pump, drops, milk steam and ready chime in order", () => {
    const { context, ctx, bus, destination } = setup();
    createBrewAudio(ctx, bus, "latte");
    const at = (freq: number) =>
      context.nodes.find((n) => n.frequency.events[0]?.value === freq)!
        .starts[0];
    expect(at(240)).toBe(10);
    expect(at(65)).toBe(11.2);
    expect(at(1050)).toBeCloseTo(11.98); // first drop follows the start of water flow by 80ms
    expect(at(2100)).toBe(14.1);
    expect(at(880)).toBe(15.4);
    expect(context.nodes[0].destination).toBe(destination);
    const sources = context.nodes.filter((n) => n.starts.length);
    expect(
      sources.every((n) => n.stops.length === 1 && n.stops[0] <= 15.8),
    ).toBe(true);
  });
  it("does not steam black coffee and releases nodes after the score ends", () => {
    const { context, ctx, bus } = setup();
    const handle = createBrewAudio(ctx, bus, "americano");
    expect(
      context.nodes.some((n) => n.frequency.events[0]?.value === 4300),
    ).toBe(false);
    context.nodes.filter((n) => n.starts.length).forEach((n) => n.onended?.());
    expect(handle.activeSources()).toBe(0);
    expect(context.nodes.every((n) => n.disconnected)).toBe(true);
  });
  it("cancels every scheduled source, including future phases, on room exit", () => {
    const { context, ctx, bus } = setup();
    const handle = createBrewAudio(ctx, bus, "latte");
    handle.cancel();
    handle.cancel();
    expect(handle.activeSources()).toBe(0);
    expect(
      context.nodes
        .filter((n) => n.starts.length)
        .every((n) => n.stops.at(-1) === 10),
    ).toBe(true);
    expect(context.nodes.every((n) => n.disconnected)).toBe(true);
  });
  it("prevents overlap on repeated start, respects mute, and never creates audio before unlock", () => {
    const { context, ctx } = setup(),
      audio = new CafeAudio();
    audio.startBrew("latte", Date.now());
    expect(audio.ctx).toBeNull();
    audio.ctx = ctx;
    audio.master = context.createGain() as unknown as GainNode;
    audio.music = context.createGain() as unknown as GainNode;
    audio.effects = context.createGain() as unknown as GainNode;
    audio.unlocked = true;
    audio.settings = { music: 0.3, effects: 0.6, muted: false };
    audio.startBrew("latte", Date.now());
    const first = context.nodes.filter((n) => n.starts.length);
    audio.startBrew("espresso", Date.now());
    expect(first.every((n) => n.disconnected)).toBe(true);
    audio.set({ muted: true });
    expect(
      context.nodes.filter((n) => n.starts.length).every((n) => n.disconnected),
    ).toBe(true);
    const count = context.nodes.length;
    audio.startBrew("latte", Date.now());
    expect(context.nodes).toHaveLength(count);
  });
});
