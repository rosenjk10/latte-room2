import { useEffect, useState } from "react";
import { WATER_COOLDOWN, type SharedState } from "./roomState";
import { BOOKS } from "./world";
export type Interaction = { kind: "book" | "pot" | "chair"; id: number };
export default function InteractionPanel({
  target,
  state,
  ready,
  busy,
  onAct,
  onClose,
  selectedBook,
}: {
  target: Interaction;
  state: SharedState;
  ready: boolean;
  busy: boolean;
  onAct: () => void;
  onClose: () => void;
  selectedBook: number | null;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  const flower = state.flowers[target.id],
    cooldown =
      target.kind === "pot" && flower?.wateredAt
        ? Math.max(0, WATER_COOLDOWN - (now - flower.wateredAt))
        : 0;
  const occupied = target.kind === "chair" && !!state.seats[target.id];
  return (
    <aside className="interaction-panel" aria-label="가까운 상호작용">
      <button
        className="interaction-close"
        aria-label="상호작용 닫기"
        onClick={onClose}
      >
        ×
      </button>
      <strong>
        {target.kind === "book"
          ? `📖 ${BOOKS[target.id].title}`
          : target.kind === "chair"
            ? "잠시 쉬어가는 자리"
            : `🌱 작은 정원 · ${["씨앗", "새싹", "줄기", "꽃봉오리", "개화"][flower?.stage ?? 0]}`}
      </strong>
      <small>
        {!ready
          ? "공간을 함께 맞추고 있어요…"
          : target.kind === "pot"
            ? `이번 주기 ${flower.stage}회 물주기${flower.stage === 4 ? " · 3분 후 다시 씨앗으로" : ""}`
            : target.kind === "chair"
              ? "가까이 걸어간 뒤 자리에 앉아요."
              : "짧은 문장과 함께 잠깐 쉬어가요."}
      </small>
      <button
        className="primary"
        aria-label={
          target.kind === "chair"
            ? "앉기"
            : target.kind === "pot"
              ? "물주기"
              : "책 읽기"
        }
        disabled={
          busy ||
          (target.kind !== "book" && !ready) ||
          (target.kind === "pot" && (cooldown > 0 || flower.stage === 4)) ||
          occupied
        }
        onClick={onAct}
      >
        {target.kind === "book"
          ? "📖 책 읽기"
          : target.kind === "chair"
            ? occupied
              ? "쉬고 있는 자리"
              : selectedBook !== null
                ? "앉아 책 읽기"
                : "가까이 가서 앉기"
            : flower.stage === 4
              ? "꽃을 감상해요"
              : cooldown > 0
                ? `${Math.ceil(cooldown / 1000)}초 쉬는 중`
                : "가까이 가서 물주기"}
      </button>
    </aside>
  );
}
