import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Scene, { type Controls } from "./Scene";
import { audio } from "./audio";
import { useRoom, configured } from "./realtime";
import {
  ANIMALS,
  DRINKS,
  DESSERTS,
  SEATS,
  COOLDOWN,
  BUBBLE_LIFE,
  bubblePosition,
  mergeBubbles,
  type Animal,
  type Player,
  type Bubble,
  type Burst,
} from "./model";
class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="webgl-error">
        3D 화면을 불러오지 못했어요.
        <br />
        WebGL을 지원하는 최신 브라우저에서 다시 열어주세요.
      </div>
    ) : (
      this.props.children
    );
  }
}
const ROOM_NAMES = [
  "민트 가든",
  "바닐라 선셋",
  "딸기 구름",
  "라벤더 밤",
  "나무 그늘",
  "봄날의 창가",
  "달빛 라운지",
  "비 오는 오후",
  "포근한 다락",
  "새벽의 정원",
];
export default function App() {
  const [room, setRoom] = useState<number | null>(null),
    [panel, setPanel] = useState<"rooms" | "drink" | "dessert" | null>(null);
  const [animal, setAnimal] = useState<Animal>("cat"),
    [name, setName] = useState(() => localStorage.getItem("latte:name") || "");
  const player = useRef<Player>({
    id: crypto.randomUUID(),
    name: "쉬어가는 고양이",
    animal: "cat",
    x: 0,
    z: 3.4,
    angle: 0,
    seat: null,
    drink: null,
    dessert: null,
  });
  const controls = useRef<Controls>({ x: 0, z: 0, keys: new Set() });
  const [bubbles, setBubbles] = useState<Bubble[]>([]),
    [bursts, setBursts] = useState<Burst[]>([]);
  const bubblesRef = useRef<Bubble[]>([]),
    popped = useRef(new Map<string, number>()),
    cooldown = useRef(0),
    [remaining, setRemaining] = useState(0);
  const [muted, setMuted] = useState(true),
    [notice, setNotice] = useState(""),
    [seated, setSeated] = useState(false),
    [heldDrink, setHeldDrink] = useState<string>("");
  const receiveBubbles = useCallback(
    (incoming: Bubble[]) =>
      setBubbles((prev) => {
        const next = mergeBubbles(prev, incoming, Date.now(), popped.current);
        bubblesRef.current = next;
        return next;
      }),
    [],
  );
  const pop = useCallback((id: string) => {
    if (popped.current.has(id)) return;
    popped.current.set(id, Date.now());
    const b = bubblesRef.current.find((b) => b.id === id);
    setBubbles((prev) => {
      const next = prev.filter((b) => b.id !== id);
      bubblesRef.current = next;
      return next;
    });
    if (b) {
      const p = bubblePosition(b, Date.now());
      setBursts((prev) => [
        ...prev.slice(-19),
        { id, ...p, born: performance.now(), rainbow: b.rainbow },
      ]);
      audio.pop();
    }
  }, []);
  const net = useRoom(room, player, receiveBubbles, pop, () => ({
    bubbles: bubblesRef.current,
    popped: [...popped.current.keys()].slice(-200),
  }));
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      setRemaining(Math.max(0, cooldown.current - now));
      setBubbles((prev) => {
        const next = prev.filter((b) => now - b.born < BUBBLE_LIFE);
        bubblesRef.current = next;
        return next.length === prev.length ? prev : next;
      });
      setBursts((prev) => prev.filter((b) => performance.now() - b.born < 700));
      popped.current.forEach((t, id) => {
        if (now - t > 20000) popped.current.delete(id);
      });
    }, 150);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).matches(
          "input,textarea,select,[contenteditable=true]",
        ) ||
        (e.target as HTMLElement).closest("[role=dialog]")
      )
        return;
      const key = e.key.toLowerCase();
      if (
        [
          "w",
          "a",
          "s",
          "d",
          "arrowup",
          "arrowdown",
          "arrowleft",
          "arrowright",
        ].includes(key)
      ) {
        e.preventDefault();
        controls.current.keys.add(key);
      }
    };
    const up = (e: KeyboardEvent) =>
      controls.current.keys.delete(e.key.toLowerCase());
    const clear = () => {
      controls.current.keys.clear();
      controls.current.x = 0;
      controls.current.z = 0;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clear);
    };
  }, []);
  function join(next: number) {
    const p = player.current;
    p.name = name.trim().slice(0, 16) || "쉬어가는 손님";
    p.animal = animal;
    p.seat = null;
    p.x = 0;
    p.z = 3.4;
    p.angle = 0;
    localStorage.setItem("latte:name", p.name);
    setSeated(false);
    setBubbles([]);
    bubblesRef.current = [];
    setBursts([]);
    popped.current.clear();
    cooldown.current = 0;
    setRoom(next);
    setPanel(null);
  }
  function seat(i: number) {
    if (room === null) return;
    if (Object.values(net.others).some((p) => p.seat === i)) {
      setNotice("이미 누군가 쉬고 있어요. 옆자리는 어떨까요?");
      return;
    }
    const s = SEATS[i];
    Object.assign(player.current, { x: s.x, z: s.z, angle: s.angle, seat: i });
    setSeated(true);
    setNotice("잠시 앉아 쉬어요. 일어나기로 다시 걸을 수 있어요.");
  }
  function stand() {
    const s = SEATS[player.current.seat ?? 0];
    Object.assign(player.current, { seat: null, x: s.x, z: s.z + 0.85 });
    setSeated(false);
  }
  function blow(giant = false) {
    const now = Date.now();
    if (room === null || now < cooldown.current) return;
    cooldown.current = now + COOLDOWN;
    setRemaining(COOLDOWN);
    const p = player.current,
      count = giant ? 1 : 5 + Math.floor(Math.random() * 4);
    const incoming = Array.from({ length: count }, () => ({
      id: crypto.randomUUID(),
      owner: p.id,
      x: p.x + Math.sin(p.angle) * 0.65 + (Math.random() - 0.5) * 0.5,
      z: p.z + Math.cos(p.angle) * 0.65 + (Math.random() - 0.5) * 0.5,
      born: now,
      size: giant ? 0.85 : 0.16 + Math.random() * 0.16,
      seed: Math.random() * Math.PI * 2,
      rainbow: Math.random() < 0.07,
    }));
    receiveBubbles(incoming);
    net.sendEvent("bubbles", incoming);
    setNotice(
      giant ? "커다란 여유 한 방울 🫧" : "작은 걱정도 방울에 담아 날려요",
    );
  }
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null),
    didHold = useRef(false);
  useEffect(() => {
    stopHold();
    controls.current.x = 0;
    controls.current.z = 0;
    controls.current.keys.clear();
  }, [room, panel]);
  function stopHold() {
    if (hold.current) clearTimeout(hold.current);
    hold.current = null;
  }
  useEffect(() => () => stopHold(), []);
  function machine(kind: "drink" | "dessert") {
    if (room !== null) setPanel(kind);
  }
  const statusLabels = {
    local: "로컬 체험 · 연결 설정 필요",
    connecting: "카페에 연결 중…",
    online: "실시간 연결됨",
    reconnecting: "연결 복구 중 · 로컬 이동 가능",
    error: "연결 오류 · 설정을 확인해주세요",
  };
  return (
    <main
      data-room={room ?? "welcome"}
      data-bubbles={bubbles.length}
      data-seated={seated}
      className={room === null ? "app welcome" : "app in-room"}
    >
      <SceneBoundary>
        <Scene
          player={player}
          controls={controls}
          others={Object.values(net.others)}
          bubbles={bubbles}
          bursts={bursts}
          onPop={(id) => {
            if (!popped.current.has(id)) {
              pop(id);
              net.sendEvent("pop", { id });
            }
          }}
          onSeat={seat}
          onMachine={machine}
          tick={net.sendPlayer}
          entered={room !== null}
        />
      </SceneBoundary>
      <header className="topbar">
        <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
          LATTE <span>ROOM</span>
          <small>your little pause</small>
        </a>
        <div className="top-actions">
          <span className="open-badge">
            <i /> OPEN 24/7
          </span>
          <button
            className="icon-button"
            aria-label={muted ? "사운드 켜기" : "사운드 끄기"}
            onClick={() => {
              void audio
                .toggle()
                .then((on) => setMuted(!on))
                .catch(() => setNotice("브라우저에서 소리를 허용해주세요."));
            }}
          >
            {muted ? "♩ OFF" : "♫ ON"}
          </button>
        </div>
      </header>
      {room === null ? (
        <>
          <div className="welcome-shade" />
          <section className="welcome-card">
            <p className="eyebrow">A LITTLE SPACE, JUST FOR YOU</p>
            <h1>
              아무것도 하지 않아도
              <br />
              <em>괜찮은 곳.</em>
            </h1>
            <p className="intro">
              따뜻한 커피, 포근한 친구들.
              <br />
              말없이 함께 쉬어가는 우리의 작은 카페.
            </p>
            <div className="animal-picker" aria-label="캐릭터 선택">
              {ANIMALS.map((a) => (
                <button
                  key={a.id}
                  aria-label={a.label}
                  aria-pressed={animal === a.id}
                  className={animal === a.id ? "chosen" : ""}
                  onClick={() => {
                    setAnimal(a.id);
                    player.current.animal = a.id;
                  }}
                >
                  <span>{a.emoji}</span>
                  <small>{a.label}</small>
                </button>
              ))}
            </div>
            <label className="nickname">
              <span>어떤 이름으로 불러드릴까요?</span>
              <input
                aria-label="닉네임"
                maxLength={16}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="쉬어가는 손님"
              />
            </label>
            <button className="primary enter" onClick={() => join(1)}>
              입장하기 <span>↗</span>
            </button>
            <p className="quiet-note">채팅 없이, 각자의 속도로 쉬어가요.</p>
          </section>
          <div className="welcome-footer">
            <span>☕ 온종일 열려 있는 작은 쉼표</span>
            <span>SCROLL LESS, REST MORE.</span>
          </div>
        </>
      ) : (
        <>
          <section className="room-info">
            <p className="eyebrow">YOUR QUIET CORNER</p>
            <button className="room-title" onClick={() => setPanel("rooms")}>
              {String(room).padStart(2, "0")} ·{" "}
              {net.roomNames[room] || ROOM_NAMES[room - 1]} <span>⌄</span>
            </button>
            <div className="connection">
              <i className={net.status === "online" ? "connected" : ""} />
              {statusLabels[net.status]}
              <span>
                {" "}
                · {net.status === "online" ? net.counts[room - 1] || 1 : 1}명
              </span>
            </div>
          </section>
          <div className="room-tools">
            <button aria-label="음료 선택" onClick={() => setPanel("drink")}>
              ☕ <span>{heldDrink || "커피 한 잔"}</span>
            </button>
            <button
              aria-label="디저트 선택"
              onClick={() => setPanel("dessert")}
            >
              🍰 <span>오늘의 디저트</span>
            </button>
            <button aria-label="방 둘러보기" onClick={() => setPanel("rooms")}>
              ⌂ <span>방 둘러보기</span>
            </button>
            <button
              aria-label="나가기"
              onClick={() => {
                setRoom(null);
                setBubbles([]);
                bubblesRef.current = [];
                setBursts([]);
                controls.current.keys.clear();
              }}
            >
              ↗ <span>나가기</span>
            </button>
          </div>
          <div className="bottom-hint">
            {seated
              ? "편안히 쉬고 있어요 ☁"
              : "WASD / 방향키로 이동 · 의자를 눌러 앉기"}
            <small>방울을 톡 눌러 터뜨려 보세요</small>
          </div>
          <Joystick controls={controls} />
          <div className="play-actions">
            {seated && (
              <button className="stand-button" onClick={stand}>
                일어나기 ↑
              </button>
            )}
            <button
              className={`bubble-button ${remaining > 0 ? "cooling" : ""}`}
              aria-label="비눗방울 만들기"
              aria-disabled={remaining > 0}
              onClick={(e) => {
                if (e.detail === 0) blow();
              }}
              onContextMenu={(e) => e.preventDefault()}
              onPointerDown={(e) => {
                if (remaining > 0) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                didHold.current = false;
                hold.current = setTimeout(() => {
                  didHold.current = true;
                  blow(true);
                }, 650);
              }}
              onPointerUp={() => {
                stopHold();
                if (!didHold.current) blow();
              }}
              onPointerCancel={stopHold}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
                  e.preventDefault();
                  blow(e.shiftKey);
                }
              }}
            >
              <span>🫧</span>
              {remaining > 0 ? `${(remaining / 1000).toFixed(1)}s` : "비눗방울"}
              <small>꾹 누르면 대왕 방울</small>
            </button>
          </div>
        </>
      )}
      {notice && (
        <div role="status" className="toast">
          {notice}
        </div>
      )}
      {panel && (
        <div
          className="modal-backdrop"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) setPanel(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={
              panel === "rooms"
                ? "카페 선택"
                : panel === "drink"
                  ? "음료 선택"
                  : "디저트 선택"
            }
            className="modal"
            onKeyDown={(e) => {
              if (e.key === "Escape") setPanel(null);
            }}
          >
            <button
              autoFocus
              className="close"
              aria-label="닫기"
              onClick={() => setPanel(null)}
            >
              ×
            </button>
            <p className="eyebrow">A SMALL TREAT FOR YOUR DAY</p>
            <h2>
              {panel === "rooms"
                ? "어디에서 쉬어갈까요?"
                : panel === "drink"
                  ? "오늘은 어떤 커피?"
                  : "달콤한 작은 행운"}
            </h2>
            <p className="modal-description">
              {panel === "rooms"
                ? "열 개의 작은 공간, 마음이 머무는 곳으로."
                : panel === "drink"
                  ? "모든 음료는 마음껏 즐길 수 있어요."
                  : "무인 자판기가 골라주는 오늘의 디저트."}
            </p>
            {panel === "rooms" ? (
              <div className="room-grid">
                {ROOM_NAMES.map((n, i) => (
                  <button
                    key={n}
                    className={room === i + 1 ? "active-room" : ""}
                    onClick={() => {
                      if (room !== i + 1) join(i + 1);
                      else setPanel(null);
                    }}
                  >
                    <small>ROOM {String(i + 1).padStart(2, "0")}</small>
                    <strong>{net.roomNames[i + 1] || n}</strong>
                    <span>
                      {configured && net.status === "online"
                        ? `${net.counts[i]}명 쉬는 중`
                        : "접속 정보 없음"}
                      {room === i + 1 ? " · 현재 방" : ""}
                    </span>
                  </button>
                ))}
              </div>
            ) : panel === "drink" ? (
              <div className="drink-grid">
                {DRINKS.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => {
                      player.current.drink = d.id;
                      setHeldDrink(d.label);
                      setNotice(`${d.label} 한 잔, 준비됐어요 ☕`);
                      setPanel(null);
                    }}
                  >
                    <span style={{ background: d.color }}>☕</span>
                    <strong>{d.label}</strong>
                    <small>made with a little love</small>
                  </button>
                ))}
              </div>
            ) : (
              <>
                <div className="dessert-art">🧁</div>
                <button
                  className="primary"
                  onClick={() => {
                    const i = Math.floor(Math.random() * DESSERTS.length);
                    player.current.dessert = i;
                    setNotice(`${DESSERTS[i]} 당첨! 달콤하게 쉬어가요.`);
                    setPanel(null);
                  }}
                >
                  랜덤 디저트 받기 🎁
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
function Joystick({ controls }: { controls: React.RefObject<Controls> }) {
  const [knob, setKnob] = useState({ x: 0, z: 0 }),
    active = useRef<number | null>(null);
  const reset = () => {
    active.current = null;
    controls.current.x = 0;
    controls.current.z = 0;
    setKnob({ x: 0, z: 0 });
  };
  useEffect(() => {
    window.addEventListener("blur", reset);
    return () => window.removeEventListener("blur", reset);
  }, []);
  function move(e: React.PointerEvent<HTMLDivElement>) {
    if (active.current !== e.pointerId) return;
    const r = e.currentTarget.getBoundingClientRect();
    let x = (e.clientX - r.left - r.width / 2) / 36,
      z = (e.clientY - r.top - r.height / 2) / 36;
    const l = Math.max(1, Math.hypot(x, z));
    x /= l;
    z /= l;
    controls.current.x = x;
    controls.current.z = z;
    setKnob({ x, z });
  }
  return (
    <div
      className="joystick"
      role="group"
      aria-label="이동 조이스틱"
      onPointerDown={(e) => {
        active.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e);
      }}
      onPointerMove={move}
      onPointerUp={reset}
      onPointerCancel={reset}
      onLostPointerCapture={reset}
    >
      <span className="joystick-arrows">✣</span>
      <div
        className="joystick-knob"
        style={{ transform: `translate(${knob.x * 30}px,${knob.z * 30}px)` }}
      />
      <small>MOVE</small>
    </div>
  );
}
