# LATTE ROOM ☕🫧

모바일과 PC에서 동물 캐릭터로 머무는 24시간 3D 무인카페입니다. React 19 + TypeScript + Vite, Three.js / React Three Fiber / Drei, Supabase JS로 처음부터 구현했습니다. 외부 3D 모델이나 오디오 다운로드 없이 실행됩니다.

## 실행

Node.js **22.12+ 또는 24 LTS** 권장 (개발 환경 검증: Node 24).

```bash
npm install
cp .env.example .env.local
# .env.local에 기존 Supabase 프로젝트의 URL과 publishable key 입력
npm run dev
```

환경변수를 비워 두어도 **로컬 체험 모드**에서 이동, 좌석, 자판기, 비눗방울을 즐길 수 있습니다. 이 모드에 가짜 접속자를 표시하지 않습니다. 멀티플레이는 아래 설정 후 활성화됩니다. Vite 환경변수 변경 후 개발 서버를 재시작하세요.

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

`VITE_` 값은 브라우저에 공개됩니다. **publishable key(또는 레거시 anon key)만 사용**하고 `service_role` / secret key는 절대로 넣지 마세요. `.env.local`은 Git에서 제외됩니다.

## 이용 방법

- 고양이·토끼·곰·강아지를 고르고 닉네임(최대 16자)을 입력해 입장합니다.
- PC: WASD / 방향키. 모바일: 왼쪽 아래 조이스틱. 카페 벽과 테이블에 간단한 충돌 처리를 적용했습니다.
- 의자를 누르면 앉습니다. 카페마다 12좌석이 있으며 일어나기 버튼으로 다시 이동합니다. 좌석 점유는 클라이언트에서 확인하므로 동시 착석 경쟁에서 독점 예약은 보장하지 않습니다.
- 자판기 또는 오른쪽 도구에서 4종 커피와 랜덤 디저트를 받습니다. 컵 색과 디저트가 캐릭터에 표시됩니다.
- 소리는 기본 OFF입니다. ON으로 바꾸면 Web Audio로 합성한 잔잔한 멜로디와 카페 공기 소리, 방울 효과음을 재생합니다. 외부 음원 파일은 사용하지 않습니다.
- 방 선택에서 10개의 독립 공간을 오갑니다. 방당 인원 제한은 없습니다.

### 비눗방울

오른쪽 아래 🫧 버튼을 누르면 5~8개, **650ms 이상 꾹 누르면 대왕 방울 1개**를 만듭니다. 키보드는 Enter/Space, Shift+Enter/Space로 대왕 방울을 만듭니다. 약 7% 확률로 특별한 분홍 무지개 방울이 나옵니다.

방울을 터치·클릭하면 뽁 효과음과 반짝이 파티클이 나타납니다. 음소거는 효과음에도 적용됩니다. 방울은 좌우로 흔들리며 상승하고 10.5초 후 사라집니다. 생성 쿨다운 1.8초, 방당 표시 상한 50개, 초과 시 가장 오래된 방울부터 제거합니다.

## 기존 Supabase 연결

기존 프로젝트와 `public.cafe_rooms`, `public.room_presence`를 유지합니다. 테이블 생성·삭제·쓰기 작업은 하지 않습니다.

1. 프로젝트 Settings → API에서 URL과 publishable key를 확인해 로컬 또는 Vercel 환경변수에 입력합니다.
2. Realtime 서비스와 **public channel 연결**을 허용해야 합니다. 이 1차 버전은 로그인 없는 공개 힐링 공간입니다. 프로젝트에서 public channel 접근을 비활성화했다면 이 앱의 공개 채널을 사용할 수 있도록 설정하거나, 별도 인증·Realtime Authorization 정책을 구현해야 합니다.
3. `cafe_rooms`는 선택적으로 `id` 정렬의 첫 10행에서 `name`을 읽어 방 이름에 사용합니다. 실제 스키마가 다르거나 anon SELECT 권한이 없으면 기본 이름을 사용합니다. 방 식별자는 앱의 고정 번호 1~10이며 데이터베이스 UUID를 변경하지 않습니다. 기존 스키마에 맞춘 표시명 연결은 `src/realtime.ts`에서 조정할 수 있습니다.
4. `room_presence`의 누적 행 수는 실제 동접과 다를 수 있어 **접속자 계산에 사용하지 않습니다**. 테이블은 다른 기능을 위해 그대로 둡니다. Postgres Changes publication에 테이블을 추가할 필요도 없습니다.

### 통신 구조

- 브라우저당 Supabase 클라이언트 1개 / WebSocket 1개, 채널 2개: 전체 접속 현황 `latte:occupancy:v1` + 현재 방 `latte:room:N:v1`.
- 방 채널의 Presence로 캐릭터 입장·퇴장을 처리합니다. 전체 현황 채널에는 현재 방에 가입한 이용자만 `id, room`을 track하고, Presence의 고유 ID를 기준으로 10개 방의 인원수를 계산합니다. DB 카운터를 갱신하거나 10개 방 전체 Broadcast를 구독하지 않습니다.
- 위치·방향·착석·음료·디저트는 **변경 시에만 최대 5Hz** Broadcast합니다. 원격 위치·회전은 프레임마다 보간합니다. 새 입장자의 hello에 기존 이용자가 최신 상태를 전송합니다.
- 방울은 생성 목록 / 터뜨린 ID만 Broadcast합니다. 시간·seed로 각 기기가 같은 궤적을 계산하며 프레임 위치를 전송하지 않습니다. UUID 중복 제거와 20초 tombstone으로 중복 pop 및 pop-before-create 재생성을 막습니다. 같은 방에 늦게 들어오면 대표 클라이언트가 현재 방울과 pop 이력을 전달합니다.
- 방 전환 시 구독·방울·파티클·입력 상태를 정리합니다. 연결 실패를 화면에 표시하고 Supabase SDK의 자동 재접속을 사용합니다. 재가입 시 Presence 및 방울 스냅샷을 다시 요청합니다. 오프라인 중 생성한 방울은 재접속 때 재전송하지 않습니다.
- 통신 데이터는 타입·좌표·크기·배치 개수를 검증합니다. 이 공개 클라이언트 구조는 악의적인 사용자의 신원 위조나 메시지 폭주를 서버에서 차단하는 구조는 아닙니다. 공개 운영 규모가 커지면 인증과 서버 측 rate limit이 필요합니다.

### 무료 플랜과 성능

DPR 최대 1.5, 공유 저폴리곤 구체, 단일 주 조명, 초기 프레임의 저해상도 접촉 그림자를 사용합니다. 투명 방울은 50개, 파티클 그룹은 20개로 제한합니다.

**전체 100명은 목표이며 보장 수치가 아닙니다.** 5Hz는 최대 전송 빈도이고, 방 인원이 많으면 각 Broadcast가 여러 수신자에게 전달되어 메시지가 크게 늘어납니다. 예를 들어 한 방의 100명이 모두 움직이면 송신 500회/초와 많은 수신 메시지가 발생합니다. Supabase 무료 플랜의 현재 연결·메시지·처리량 한도를 대시보드/공식 문서에서 확인하고, 실제 프로젝트·모바일 기기로 부하 검증 후 운영하세요. 이 버전에서 100명 실부하 테스트는 수행하지 않았습니다.

## 검증

```bash
npm test              # 방울 수명/중복/역순 pop/상한/입력 검증 등 로직 테스트
npm run build         # TypeScript + 프로덕션 번들
npm run preview       # 빌드 결과 실행
```

브라우저 자동 검증(테스트 설정이 5173·5174 개발 서버를 자동 실행합니다):

```bash
# 시스템 Chromium이 없으면 설치 후 CHROMIUM_PATH 지정
npx playwright install chromium
CHROMIUM_PATH=/path/to/chrome npm run test:browser
```

시스템의 `/usr/bin/chromium`이 있으면 사용하고, 없으면 Playwright가 설치한 Chromium을 사용합니다. 브라우저 테스트는 PC·모바일 화면에서 실제 WebGL 렌더링, 키보드/조이스틱 이동, 착석, 음료·디저트, 방울 생성·길게 누르기·터뜨리기·만료·방 분리를 검증합니다. 키가 없는 로컬 체험 환경으로 실행하세요.

두 브라우저 + 모의 Phoenix Realtime 서버 테스트도 포함합니다. **실제 Supabase SDK**를 통과하는 Presence 입·퇴장, 이동 Broadcast, 방울 생성·pop 공유, 방 분리와 WebSocket 재접속을 검증합니다. 모의 서버는 공개된 가짜 테스트 키만 사용하고 외부 Supabase로 요청하지 않습니다. 실제 서버 권한·플랜 한도·지연 시간에 대한 검증을 대신하지 않습니다.

실제 Supabase 검증: 서로 다른 브라우저/기기 2개로 같은 방에 입장 → 닉네임·이동·음료·착석·방울 생성 및 pop 공유 확인 → 한쪽 방 이동 및 종료 → 인원 감소 확인 → 네트워크를 끊고 복구해 재접속 확인. 실제 환경변수가 제공되지 않은 개발 환경에서는 이 검증을 통과했다고 주장하지 않습니다.

## Vercel 무료 배포

1. GitHub의 이 저장소를 Vercel로 Import합니다.
2. Framework: Vite / Build: `npm run build` / Output: `dist` / Install: `npm ci`.
3. 두 `VITE_SUPABASE_*` 환경변수를 Preview와 Production에 등록합니다. 추가 후 다시 배포해야 번들에 적용됩니다.
4. Deploy 후 HTTPS에서 모바일·PC로 위의 2인 테스트를 진행합니다.

이 앱은 단일 페이지로 동작하므로 서버 함수나 유료 서비스가 필수는 아닙니다. Supabase Realtime은 사용자 소유의 기존 프로젝트에 연결합니다. 저장소 push와 Vercel 실제 배포는 별개입니다.

## 파일

- `src/Scene.tsx`: 카페, 캐릭터, 프레임 이동/보간, 방울/파티클
- `src/App.tsx`: 입장·모바일 UI·상호작용·방울 수명
- `src/realtime.ts`: Supabase Presence / Broadcast / 재접속
- `src/model.ts`: 데이터 모델, 검증, 결정적 방울 궤적과 병합
- `src/audio.ts`: 음소거 가능한 합성 배경음·효과음
- `tests/`: 로직 및 브라우저 테스트
