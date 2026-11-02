import { useEffect, useMemo, useRef, useState } from "react";
import {
  emptyState,
  RoomCoordinator,
  type RoomBridge,
  type SharedMessage,
  type Request,
} from "./roomState";
export function useSharedRoom(
  room: number | null,
  id: string,
  network: boolean,
  activeSeat: React.RefObject<{ seat: number | null }>,
) {
  const engine = useRef<RoomCoordinator | null>(null),
    sender = useRef<((v: SharedMessage) => void) | null>(null);
  const [view, setView] = useState({
    room: null as number | null,
    state: emptyState(),
    ready: false,
  });
  const bridge = useMemo<RoomBridge>(
    () => ({
      event: (v) => engine.current?.receive(v),
      roster: (ids) => engine.current?.setMembers(ids),
      connected: (v) => engine.current?.setConnected(v),
      bind: (fn) => {
        sender.current = fn;
      },
    }),
    [],
  );
  useEffect(() => {
    if (room === null) {
      setView({ room: null, state: emptyState(), ready: false });
      return;
    }
    const coordinator = new RoomCoordinator(
      id,
      (v) => sender.current?.(v),
      () =>
        setView({
          room,
          state: structuredClone(coordinator.state),
          ready: coordinator.ready,
        }),
    );
    engine.current = coordinator;
    if (!network) {
      coordinator.setMembers([id]);
      coordinator.setConnected(true);
    }
    let renewed = 0;
    const timer = setInterval(() => {
      coordinator.tick();
      const entry = Object.entries(coordinator.state.seats).find(
        ([, s]) => s.owner === id,
      );
      if (
        entry &&
        +entry[0] === activeSeat.current.seat &&
        coordinator.ready &&
        Date.now() - renewed > 5000
      ) {
        renewed = Date.now();
        void coordinator.request("renew", +entry[0], undefined, entry[1].token);
      }
    }, 500);
    return () => {
      clearInterval(timer);
      coordinator.dispose();
      engine.current = null;
    };
  }, [room, id, network]);
  return {
    state: view.room === room ? view.state : emptyState(),
    ready: view.room === room && view.ready,
    bridge,
    request: (
      kind: Request["kind"],
      resource: number,
      version?: number,
      token?: string,
    ) =>
      engine.current?.request(kind, resource, version, token) ??
      Promise.resolve({
        id: "",
        actor: id,
        ok: false,
        reason: "입장 후 이용해주세요.",
        at: Date.now(),
      }),
  };
}
