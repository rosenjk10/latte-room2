import type { BrowserContext, WebSocketRoute } from "@playwright/test";
type Membership = {
  socket: WebSocketRoute;
  topic: string;
  joinRef: string;
  key: string;
  presence?: Record<string, unknown>;
};
/** In-memory Phoenix v2 transport; exercises the real Supabase SDK without credentials. */
export async function mockRealtime(context: BrowserContext) {
  const memberships: Membership[] = [];
  const sockets: WebSocketRoute[] = [];
  let ref = 0;
  const metrics: {
    event: string;
    topic: string;
    at: number;
    socket: WebSocketRoute;
  }[] = [];
  const send = (
    m: Membership,
    event: string,
    payload: unknown,
    replyRef: string | null = null,
  ) =>
    m.socket.send(
      JSON.stringify([m.joinRef, replyRef, m.topic, event, payload]),
    );
  function sync(topic: string) {
    const state: Record<string, { metas: Record<string, unknown>[] }> = {};
    memberships
      .filter((m) => m.topic === topic && m.presence)
      .forEach((m) => {
        state[m.key] = { metas: [{ ...m.presence, phx_ref: m.joinRef }] };
      });
    memberships
      .filter((m) => m.topic === topic)
      .forEach((m) => send(m, "presence_state", state));
  }
  function remove(socket: WebSocketRoute, topic?: string) {
    const topics = new Set(
      memberships
        .filter((m) => m.socket === socket && (!topic || m.topic === topic))
        .map((m) => m.topic),
    );
    for (let i = memberships.length - 1; i >= 0; i--)
      if (
        memberships[i].socket === socket &&
        (!topic || memberships[i].topic === topic)
      )
        memberships.splice(i, 1);
    topics.forEach(sync);
  }
  await context.route(
    "https://latte-e2e.supabase.co/rest/v1/cafe_rooms?*",
    (route) =>
      route.fulfill({
        json: Array.from({ length: 10 }, (_, i) => ({
          id: i + 1,
          name: `테스트 정원 ${i + 1}`,
        })),
        headers: { "access-control-allow-origin": "*" },
      }),
  );
  await context.routeWebSocket("wss://latte-e2e.supabase.co/**", (socket) => {
    sockets.push(socket);
    socket.onClose(() => remove(socket));
    socket.onMessage((raw) => {
      let joinRef: string,
        replyRef: string,
        topic: string,
        event: string,
        payload: Record<string, any>;
      if (typeof raw === "string")
        [joinRef, replyRef, topic, event, payload] = JSON.parse(raw);
      else {
        // Supabase's compact binary user-broadcast push frame.
        const b = Buffer.from(raw);
        let offset = 7;
        const read = (n: number) => {
          const s = b.subarray(offset, offset + n).toString();
          offset += n;
          return s;
        };
        joinRef = read(b[1]);
        replyRef = read(b[2]);
        topic = read(b[3]);
        const userEvent = read(b[4]);
        read(b[5]);
        event = "broadcast";
        payload = {
          event: userEvent,
          type: "broadcast",
          payload: JSON.parse(b.subarray(offset).toString()),
        };
      }
      if (event === "phx_join") {
        remove(socket, topic);
        const m = {
          socket,
          topic,
          joinRef: replyRef,
          key: payload.config.presence.key || String(++ref),
        };
        memberships.push(m);
        send(m, "phx_reply", { status: "ok", response: {} }, replyRef);
        sync(topic);
        return;
      }
      if (topic === "phoenix") {
        socket.send(
          JSON.stringify([
            null,
            replyRef,
            topic,
            "phx_reply",
            { status: "ok", response: {} },
          ]),
        );
        return;
      }
      const member = memberships.find(
        (m) => m.socket === socket && m.topic === topic,
      );
      if (!member) return;
      if (event === "presence") {
        if (payload.event === "track") member.presence = payload.payload;
        else member.presence = undefined;
        send(member, "phx_reply", { status: "ok", response: {} }, replyRef);
        sync(topic);
      } else if (event === "broadcast") {
        metrics.push({ event: payload.event, topic, at: Date.now(), socket });
        memberships
          .filter((m) => m.topic === topic && m.socket !== socket)
          .forEach((m) => send(m, "broadcast", payload));
        send(member, "phx_reply", { status: "ok", response: {} }, replyRef);
      } else if (event === "phx_leave") {
        send(member, "phx_reply", { status: "ok", response: {} }, replyRef);
        remove(socket, topic);
      }
    });
  });
  return {
    metrics,
    sockets,
    memberships,
    disconnect: () => {
      const socket = sockets.at(-1);
      if (socket) {
        remove(socket);
        socket.close({ code: 1012, reason: "test reconnect" });
      }
    },
  };
}
