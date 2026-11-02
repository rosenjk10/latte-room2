import type { BrowserContext, WebSocketRoute } from "@playwright/test";
type Membership = {
  socket: WebSocketRoute;
  topic: string;
  joinRef: string;
  key: string;
  presence?: Record<string, unknown>;
  postgres?: Record<string, unknown>[];
};
/** In-memory Phoenix v2 transport; exercises the real Supabase SDK without credentials. */
export async function mockRealtime(context: BrowserContext) {
  const memberships: Membership[] = [];
  const sockets: WebSocketRoute[] = [];
  let ref = 0;
  const metrics: {
    event: string;
    payload: unknown;
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
  const entries: {
    id: string;
    nickname: string;
    message: string;
    created_at: string;
  }[] = [];
  let lastWrite = 0;
  await context.route(
    "https://latte-e2e.supabase.co/auth/v1/signup",
    (route) => {
      const now = Math.floor(Date.now() / 1000),
        id = "33333333-3333-4333-8333-333333333333";
      const token = [
        Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
          "base64url",
        ),
        Buffer.from(
          JSON.stringify({
            sub: id,
            role: "authenticated",
            aud: "authenticated",
            exp: now + 3600,
          }),
        ).toString("base64url"),
        "test_signature",
      ].join(".");
      return route.fulfill({
        json: {
          access_token: token,
          refresh_token: "mock_refresh_only",
          expires_in: 3600,
          token_type: "bearer",
          user: {
            id,
            aud: "authenticated",
            role: "authenticated",
            is_anonymous: true,
            app_metadata: { provider: "anonymous", providers: ["anonymous"] },
            user_metadata: {},
            created_at: new Date().toISOString(),
          },
        },
        headers: { "access-control-allow-origin": "*" },
      });
    },
  );
  await context.route(
    "https://latte-e2e.supabase.co/rest/v1/cafe_guestbook?*",
    (route) =>
      route.fulfill({
        json: entries.slice().reverse(),
        headers: { "access-control-allow-origin": "*" },
      }),
  );
  await context.route(
    "https://latte-e2e.supabase.co/rest/v1/rpc/post_cafe_guestbook",
    async (route) => {
      if (Date.now() - lastWrite < 60000)
        return route.fulfill({
          status: 400,
          json: {
            code: "P0001",
            message: "메모는 1분에 한 번 남길 수 있어요.",
          },
        });
      const body = route.request().postDataJSON();
      lastWrite = Date.now();
      const entry = {
        id: crypto.randomUUID(),
        nickname: body.p_nickname,
        message: body.p_message,
        created_at: new Date().toISOString(),
      };
      entries.push(entry);
      await route.fulfill({
        json: entry,
        headers: { "access-control-allow-origin": "*" },
      });
      memberships
        .filter((m) => m.postgres?.length)
        .forEach((m) =>
          send(m, "postgres_changes", {
            ids: [1],
            data: {
              schema: "public",
              table: "cafe_guestbook",
              type: "INSERT",
              commit_timestamp: entry.created_at,
              columns: Object.keys(entry).map((name) => ({
                name,
                type: "text",
              })),
              record: entry,
              old_record: {},
              errors: null,
            },
          }),
        );
    },
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
          postgres: payload.config.postgres_changes,
        };
        memberships.push(m);
        send(
          m,
          "phx_reply",
          {
            status: "ok",
            response: {
              postgres_changes: (m.postgres || []).map(
                (p: Record<string, unknown>, i: number) => ({
                  ...p,
                  id: i + 1,
                }),
              ),
            },
          },
          replyRef,
        );
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
        metrics.push({
          event: payload.event,
          payload: payload.payload,
          topic,
          at: Date.now(),
          socket,
        });
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
