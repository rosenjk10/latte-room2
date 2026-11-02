const adjectives = [
  "졸린",
  "말랑한",
  "커피 마시는",
  "달콤한",
  "새벽의",
  "몽글몽글",
  "라떼 좋아하는",
  "포근한",
  "느긋한",
  "산책하는",
  "햇살 닮은",
  "꿈꾸는",
  "별빛 품은",
  "수줍은",
  "폭신한",
  "책 읽는",
  "고요한",
  "기지개 켜는",
  "우유빛",
  "구름 위의",
];
const animals = [
  "수달",
  "토끼",
  "곰",
  "고양이",
  "여우",
  "판다",
  "다람쥐",
  "강아지",
  "코알라",
  "너구리",
  "펭귄",
  "사슴",
  "알파카",
  "고슴도치",
  "햄스터",
  "아기 오리",
];
export interface NameStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export function randomNickname(previous = "", random = () => Math.random()) {
  const total = adjectives.length * animals.length;
  const index = Math.min(total - 1, Math.max(0, Math.floor(random() * total)));
  let result = `${adjectives[Math.floor(index / animals.length)]} ${animals[index % animals.length]}`;
  if (result === previous) {
    const next = (index + 1) % total;
    result = `${adjectives[Math.floor(next / animals.length)]} ${animals[next % animals.length]}`;
  }
  return result.slice(0, 16);
}
export function saveNickname(name: string, storage?: NameStorage) {
  try {
    (storage ?? globalThis.localStorage)?.setItem("latte:name", name);
  } catch {
    /* Private browsing may disable storage. */
  }
}
export function initialNickname(storage?: NameStorage) {
  try {
    storage ??= globalThis.localStorage;
    const saved = storage?.getItem("latte:name")?.trim();
    if (saved && saved.length <= 16) return saved;
  } catch {
    /* Fall back to an in-memory name. */
  }
  const generated = randomNickname();
  saveNickname(generated, storage);
  return generated;
}
