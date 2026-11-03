import { useEffect, useRef, useState } from "react";
import { InteractionHints } from "./interactionHints";
import type { Interaction } from "./InteractionPanel";
export function useInteractionHints(
  room: number | null,
  nearby: Interaction | null,
  blocked: boolean,
  canShow: () => boolean = () => true,
) {
  const policy = useRef(new InteractionHints());
  const input = useRef({ room, nearby, blocked, canShow });
  input.current = { room, nearby, blocked, canShow };
  const [active, setActive] = useState<Interaction | null>(null);
  useEffect(() => {
    const update = () => {
      const v = input.current,
        next = policy.current.tick(
          v.room,
          v.nearby,
          v.blocked || !v.canShow(),
          Date.now(),
        );
      setActive((old) =>
        old?.kind === next?.kind && old?.id === next?.id ? old : next,
      );
    };
    update();
    const timer = setInterval(update, 100);
    return () => clearInterval(timer);
  }, [room, nearby?.kind, nearby?.id, blocked]);
  return {
    active: blocked ? null : active,
    dismiss: (target: Interaction) => {
      if (room !== null) policy.current.dismiss(room, target, Date.now());
      setActive(null);
    },
  };
}
