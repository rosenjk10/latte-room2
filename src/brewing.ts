import type { Drink } from "./model";
export type BrewStage = "grind" | "pump" | "extract" | "steam" | "ready";
export type BrewStep = { stage: BrewStage; start: number; duration: number };
export const BREW_LABELS: Record<BrewStage, string> = {
  grind: "원두를 갈고 있어요",
  pump: "압력을 올리고 있어요",
  extract: "에스프레소를 내리고 있어요",
  steam: "우유를 부드럽게 스티밍해요",
  ready: "커피가 완성됐어요",
};
export function needsMilk(drink: Drink) {
  return ["latte", "cappuccino", "vanilla", "choco"].includes(drink);
}
export function brewPlan(drink: Drink): {
  steps: BrewStep[];
  duration: number;
} {
  const stages: [BrewStage, number][] = [
    ["grind", 1200],
    ["pump", 700],
    ["extract", 2200],
    ...(needsMilk(drink) ? [["steam", 1300] as [BrewStage, number]] : []),
    ["ready", 400],
  ];
  let time = 0;
  const steps = stages.map(([stage, duration]) => {
    const step = { stage, start: time, duration };
    time += duration;
    return step;
  });
  return { steps, duration: time };
}
export function brewState(drink: Drink, elapsed: number) {
  const plan = brewPlan(drink),
    step =
      plan.steps.find((s) => elapsed < s.start + s.duration) ??
      plan.steps.at(-1)!;
  const extraction = plan.steps.find((s) => s.stage === "extract")!;
  return {
    stage: step.stage,
    progress: Math.max(0, Math.min(1, elapsed / plan.duration)),
    stageProgress: Math.max(
      0,
      Math.min(1, (elapsed - step.start) / step.duration),
    ),
    fill: Math.max(
      0,
      Math.min(1, (elapsed - extraction.start) / extraction.duration),
    ),
    active: elapsed >= 0 && elapsed < plan.duration,
  };
}
