import { useEffect, useState } from "react";
import { brewState, BREW_LABELS } from "./brewing";
import type { Drink } from "./model";
export default function BrewStatus({
  drink,
  startedAt,
}: {
  drink: Drink;
  startedAt: number;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [startedAt]);
  const state = brewState(drink, now - startedAt);
  return (
    <span role="status" className="action-status" data-brew-stage={state.stage}>
      {BREW_LABELS[state.stage]}…
      <progress aria-label="커피 준비 진행률" max="1" value={state.progress} />
    </span>
  );
}
