import { useEffect, useRef, useState } from "react";
import { client } from "./realtime";
import { guestbookError, validateMemo, type GuestEntry } from "./guestbook";
type Turnstile = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
  reset: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}
export default function Guestbook({ nickname }: { nickname: string }) {
  const [entries, setEntries] = useState<GuestEntry[]>([]),
    [name, setName] = useState(nickname),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [loading, setLoading] = useState(!!client),
    [success, setSuccess] = useState(""),
    [token, setToken] = useState("");
  const captchaRef = useRef<HTMLDivElement>(null),
    widget = useRef<string | null>(null),
    alive = useRef(true),
    requestSeq = useRef(0),
    submitting = useRef(false);
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!siteKey) return;
    let mounted = true;
    const render = () => {
      if (mounted && captchaRef.current && window.turnstile)
        widget.current = window.turnstile.render(captchaRef.current, {
          sitekey: siteKey,
          callback: (token: string) => setToken(token),
          "expired-callback": () => setToken(""),
          "error-callback": () =>
            setError("사람 확인을 불러오지 못했어요. 다시 열어주세요."),
        });
    };
    let script = document.getElementById(
      "latte-turnstile",
    ) as HTMLScriptElement | null;
    if (window.turnstile) render();
    else {
      if (!script) {
        script = document.createElement("script");
        script.id = "latte-turnstile";
        script.src =
          "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", render);
    }
    return () => {
      mounted = false;
      script?.removeEventListener("load", render);
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [siteKey]);
  async function load() {
    if (!client) return;
    const request = ++requestSeq.current;
    const { data, error } = await client
      .from("cafe_guestbook")
      .select("id,nickname,message,created_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(50);
    if (!alive.current || request !== requestSeq.current) return;
    setLoading(false);
    if (error) setError(guestbookError(error));
    else {
      setEntries(data || []);
      setError("");
    }
  }
  useEffect(() => {
    if (!client) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void load();
    const ch = client
      .channel("latte:guestbook:live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "cafe_guestbook" },
        () => {
          clearTimeout(timer);
          timer = setTimeout(() => void load(), 250);
        },
      )
      .subscribe((status) => {
        if (
          alive.current &&
          (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
        )
          setError(
            "실시간 연결을 복구하고 있어요. 새로고침으로 메모를 확인할 수 있어요.",
          );
      });
    return () => {
      clearTimeout(timer);
      void client?.removeChannel(ch);
    };
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!client || submitting.current) return;
    setSuccess("");
    const invalid = validateMemo(name, message);
    if (invalid) {
      setError(invalid);
      return;
    }
    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      const { data: session, error: sessionError } =
        await client.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session.session) {
        const { error } = await client.auth.signInAnonymously({
          options: { captchaToken: token || undefined },
        });
        if (error) throw error;
      }
      const { error } = await client.rpc("post_cafe_guestbook", {
        p_nickname: name.trim(),
        p_message: message.trim(),
      });
      if (error) throw error;
      if (!alive.current) return;
      setMessage("");
      setSuccess("메모를 남겼어요. 다음 손님에게 작은 온기가 될 거예요.");
      await load();
    } catch (e) {
      if (alive.current) setError(guestbookError(e));
    } finally {
      submitting.current = false;
      if (alive.current) {
        setSaving(false);
        setToken("");
        if (widget.current) window.turnstile?.reset(widget.current);
      }
    }
  }
  return (
    <div className="guestbook">
      {!client && (
        <p className="inline-notice">
          로컬 체험에서는 저장할 수 없어요. Supabase 환경변수와 방명록 SQL을
          적용해주세요.
        </p>
      )}
      <form onSubmit={(e) => void submit(e)}>
        <label>
          닉네임
          <input
            aria-label="방명록 닉네임"
            value={name}
            maxLength={16}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          작은 메모
          <textarea
            aria-label="방명록 메시지"
            value={message}
            maxLength={100}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="오늘의 작은 행복을 남겨주세요."
          />
        </label>
        <div className="memo-counter">
          {[...message].length}/100 · 모든 방이 함께 보는 메모
        </div>
        {siteKey && <div ref={captchaRef} />}
        <button className="primary" disabled={!client || saving} type="submit">
          {saving ? "메모를 붙이는 중…" : "메모 남기기"}
        </button>
        <small>
          로그인 화면 없이 익명 인증으로 저장해요. 1분 1회 · 시간당 5회
        </small>
      </form>
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="inline-notice">
          {success}
        </p>
      )}
      <div className="guestbook-heading">
        <span>최근 메모 · 최대 50개</span>
        <button
          disabled={!client || loading}
          onClick={() => {
            setLoading(true);
            void load();
          }}
        >
          새로고침
        </button>
      </div>
      {loading ? (
        <p>메모를 읽고 있어요…</p>
      ) : entries.length === 0 ? (
        <p className="empty-memos">
          아직 메모가 없어요. 첫 번째 온기를 남겨주세요.
        </p>
      ) : (
        <ol className="memo-list">
          {entries.map((entry) => (
            <li key={entry.id}>
              <p>{entry.message}</p>
              <footer>
                <strong>{entry.nickname}</strong>
                <time dateTime={entry.created_at}>
                  {new Date(entry.created_at).toLocaleString("ko-KR")}
                </time>
              </footer>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
