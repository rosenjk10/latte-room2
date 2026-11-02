import { useState } from "react";
import { audio } from "./audio";
export default function SoundSettings({
  onToggle,
}: {
  onToggle: () => Promise<void>;
}) {
  const [settings, setSettings] = useState(audio.settings);
  return (
    <div className="sound-settings">
      <p>
        직접 만든 작은 멜로디와 실내 공기 소리.
        <br />
        소리는 버튼을 눌러 켠 뒤에만 재생됩니다.
      </p>
      <label>
        배경음악 · 실내 분위기{" "}
        <output>{Math.round(settings.music * 100)}%</output>
        <input
          aria-label="배경음악 볼륨"
          type="range"
          min="0"
          max="100"
          value={Math.round(settings.music * 100)}
          onChange={(e) => {
            audio.set({ music: Number(e.target.value) / 100 });
            setSettings({ ...audio.settings });
          }}
        />
      </label>
      <label>
        효과음 <output>{Math.round(settings.effects * 100)}%</output>
        <input
          aria-label="효과음 볼륨"
          type="range"
          min="0"
          max="100"
          value={Math.round(settings.effects * 100)}
          onChange={(e) => {
            audio.set({ effects: Number(e.target.value) / 100 });
            setSettings({ ...audio.settings });
          }}
        />
      </label>
      <button
        className="primary"
        onClick={async () => {
          await onToggle();
          setSettings({ ...audio.settings });
        }}
      >
        {audio.enabled ? "전체 음소거" : "전체 소리 켜기"}
      </button>
      <small>
        볼륨과 음소거 설정은 이 기기에 저장됩니다. 다시 방문했을 때도 소리 켜기
        버튼이 필요해요.
      </small>
    </div>
  );
}
