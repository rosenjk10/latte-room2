import { useEffect, useRef, useState } from "react";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import { validPlayer, validBubble, type Player, type Bubble } from "./model";
const url = import.meta.env.VITE_SUPABASE_URL,
  key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured =
  !!url &&
  !!key &&
  /^https:\/\/[a-z0-9.-]+\.supabase\.co\/?$/i.test(url) &&
  !key.includes("YOUR_");
const client = configured
  ? createClient(url, key, { realtime: { params: { eventsPerSecond: 10 } } })
  : null;
export type Status =
  "local" | "connecting" | "online" | "reconnecting" | "error";
export function useRoom(
  room: number | null,
  player: React.RefObject<Player>,
  onBubbles: (b: Bubble[]) => void,
  onPop: (id: string) => void,
  getSnapshot: () => { bubbles: Bubble[]; popped: string[] },
) {
  const [others, setOthers] = useState<Record<string, Player>>({});
  const [counts, setCounts] = useState<number[]>(Array(10).fill(0));
  const [status, setStatus] = useState<Status>(
    configured ? "connecting" : "local",
  );
  const [roomNames, setRoomNames] = useState<Record<number, string>>({});
  const channel = useRef<RealtimeChannel | null>(null);
  const callbacks = useRef({ onBubbles, onPop, getSnapshot });
  callbacks.current = { onBubbles, onPop, getSnapshot };
  const lastSend = useRef(0);
  const lastValue = useRef("");
  const joined = useRef(false);
  const forcePlayer = useRef(false);
  useEffect(() => {
    if (!client) return;
    let alive = true;
    void client
      .from("cafe_rooms")
      .select("*")
      .order("id")
      .limit(10)
      .then(({ data, error }) => {
        if (!alive || error || !data) return;
        const names: Record<number, string> = {};
        data.forEach((r, i) => {
          if (typeof r.name === "string") names[i + 1] = r.name;
        });
        setRoomNames(names);
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    setOthers({});
    lastValue.current = "";
    lastSend.current = 0;
    joined.current = false;
    forcePlayer.current = false;
    if (room === null || !client) {
      setStatus("local");
      return;
    }
    let alive = true,
      roomReady = false,
      lobbyReady = false,
      lastHello = 0;
    const members = new Set<string>();
    let snapshotTimer: ReturnType<typeof setTimeout> | undefined;
    setStatus("connecting");
    const lobby = client.channel("latte:occupancy:v1", {
      config: { presence: { key: player.current.id } },
    });
    const ch = client.channel(`latte:room:${room}:v1`, {
      config: {
        presence: { key: player.current.id },
        broadcast: { self: false, ack: true },
      },
    });
    channel.current = ch;
    const announce = () => {
      if (roomReady && lobbyReady) {
        void lobby.track({ id: player.current.id, room }).then((result) => {
          if (alive) setStatus(result === "ok" ? "online" : "error");
        });
      }
    };
    lobby
      .on("presence", { event: "sync" }, () => {
        const byRoom = Array(10).fill(0);
        const seen = new Set<string>();
        Object.values(lobby.presenceState())
          .flat()
          .forEach((raw) => {
            const p = raw as unknown as { id: string; room: number };
            if (
              typeof p.id === "string" &&
              !seen.has(p.id) &&
              Number.isInteger(p.room) &&
              p.room >= 1 &&
              p.room <= 10
            ) {
              seen.add(p.id);
              byRoom[p.room - 1]++;
            }
          });
        if (alive) setCounts(byRoom);
      })
      .subscribe((s) => {
        if (!alive) return;
        lobbyReady = s === "SUBSCRIBED";
        if (lobbyReady) announce();
        else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT")
          setStatus("reconnecting");
      });
    ch.on("presence", { event: "sync" }, () => {
      if (!alive) return;
      members.clear();
      const snapshots: Record<string, Player> = {};
      Object.values(ch.presenceState())
        .flat()
        .forEach((raw) => {
          const p = (raw as unknown as { player: unknown }).player;
          if (validPlayer(p) && p.id !== player.current.id) {
            members.add(p.id);
            snapshots[p.id] = p;
          }
        });
      setOthers((prev) =>
        Object.fromEntries(
          [...members].map((id) => [id, prev[id] || snapshots[id]]),
        ),
      );
    })
      .on("broadcast", { event: "player" }, ({ payload }) => {
        if (alive && validPlayer(payload) && payload.id !== player.current.id) {
          setOthers((prev) => ({ ...prev, [payload.id]: payload }));
        }
      })
      .on("broadcast", { event: "hello" }, ({ payload }) => {
        if (!alive) return;
        if (Date.now() - lastHello > 1000) {
          lastHello = Date.now();
          forcePlayer.current = true;
          clearTimeout(snapshotTimer);
          snapshotTimer = setTimeout(
            sendPlayer,
            Math.max(0, 201 - (performance.now() - lastSend.current)),
          );
        }
        const leader = [player.current.id, ...members]
          .filter((id) => id !== payload?.id)
          .sort()[0];
        if (leader === player.current.id && typeof payload?.id === "string")
          void ch.send({
            type: "broadcast",
            event: "bubble-state",
            payload: { to: payload.id, ...callbacks.current.getSnapshot() },
          });
      })
      .on("broadcast", { event: "bubble-state" }, ({ payload }) => {
        if (!alive || payload?.to !== player.current.id) return;
        if (Array.isArray(payload.popped) && payload.popped.length <= 200)
          payload.popped.forEach((id: unknown) => {
            if (typeof id === "string" && id.length < 120)
              callbacks.current.onPop(id);
          });
        if (
          Array.isArray(payload.bubbles) &&
          payload.bubbles.length <= 50 &&
          payload.bubbles.every(validBubble)
        )
          callbacks.current.onBubbles(payload.bubbles);
      })
      .on("broadcast", { event: "bubbles" }, ({ payload }) => {
        if (
          alive &&
          Array.isArray(payload) &&
          payload.length <= 8 &&
          payload.every(validBubble)
        )
          callbacks.current.onBubbles(payload);
      })
      .on("broadcast", { event: "pop" }, ({ payload }) => {
        if (alive && typeof payload?.id === "string" && payload.id.length < 120)
          callbacks.current.onPop(payload.id);
      })
      .subscribe(async (s) => {
        if (!alive) return;
        roomReady = s === "SUBSCRIBED";
        joined.current = roomReady;
        if (roomReady) {
          const result = await ch.track({ player: player.current });
          if (!alive) return;
          if (result !== "ok") {
            joined.current = false;
            setStatus("error");
            return;
          }
          announce();
          void ch.send({
            type: "broadcast",
            event: "hello",
            payload: { id: player.current.id },
          });
        } else if (
          s === "CHANNEL_ERROR" ||
          s === "TIMED_OUT" ||
          s === "CLOSED"
        ) {
          setStatus("reconnecting");
          setOthers({});
          void lobby.untrack();
        }
      });
    const online = () => {
      if (alive && roomReady) {
        void ch.track({ player: player.current });
        announce();
      }
    };
    const visibility = () => {
      if (document.visibilityState === "visible") online();
    };
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      alive = false;
      clearTimeout(snapshotTimer);
      joined.current = false;
      channel.current = null;
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", visibility);
      void client.removeChannel(ch);
      void client.removeChannel(lobby);
    };
  }, [room, player]);
  const sendPlayer = () => {
    const now = performance.now(),
      value = JSON.stringify(player.current);
    if (
      !channel.current ||
      !joined.current ||
      now - lastSend.current < 200 ||
      (value === lastValue.current && !forcePlayer.current)
    )
      return;
    forcePlayer.current = false;
    lastSend.current = now;
    lastValue.current = value;
    void channel.current.send({
      type: "broadcast",
      event: "player",
      payload: { ...player.current },
    });
  };
  const sendEvent = (event: "bubbles" | "pop", payload: unknown) => {
    if (!channel.current || !joined.current) return;
    void channel.current
      .send({ type: "broadcast", event, payload })
      .then((result) => {
        if (result !== "ok") setStatus("reconnecting");
      });
  };
  return { others, counts, status, roomNames, sendPlayer, sendEvent };
}
