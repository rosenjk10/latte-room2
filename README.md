# LATTE ROOM ☕🫧

말없이 함께 쉬어가는 3D 무인카페. 기존 React 19 + TypeScript + Vite + React Three Fiber / Drei + Supabase 구조를 유지하며 확장한 버전입니다. 10개 독립 방, 동물 아바타 4종, 12좌석, 멀티플레이, 비눗방울이 포함됩니다. 모델과 소리는 코드로 직접 제작하며 외부 모델·음원 다운로드가 없습니다.

## 로컬 실행

Node.js 24 LTS 권장 (`.nvmrc` 제공, 최소 22.12).

```bash
npm install
cp .env.example .env.local
# 기존 Supabase 프로젝트 값을 .env.local에 입력
npm run dev
```

설정이 없으면 로컬 체험 모드로 카메라·이동·음료·디저트·비눗방울을 이용할 수 있습니다. 방명록은 가짜 로컬 저장을 하지 않으며 연결 설정 안내를 표시합니다.

| 변수                            | 설명                                                                        |
| ------------------------------- | --------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`             | 기존 Supabase 프로젝트의 HTTPS URL                                          |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | publishable key 또는 레거시 anon key                                        |
| `VITE_TURNSTILE_SITE_KEY`       | **신규, 선택 사항:** 익명 인증 CAPTCHA용 Cloudflare Turnstile 공개 site key |

Vite 변수는 브라우저에 공개됩니다. `service_role`, secret key, Turnstile secret은 넣지 마세요. `.env.local`은 Git에서 제외됩니다. 변수 변경 후 개발 서버 재시작 / 배포 재빌드가 필요합니다.

## 조작과 기능

- 입장: 고양이·토끼·곰·강아지, 닉네임 최대 16자. 방 선택에서 10개 공간을 이동합니다. 방당 고정 인원 제한은 없습니다.
- 이동: PC WASD / 방향키, 모바일 왼쪽 조이스틱. 의자를 클릭해 착석하고 일어나기 버튼으로 이동합니다.
- 카메라: PC 마우스 드래그 회전 / 휠 줌. 모바일 캔버스 한 손가락 회전 / 두 손가락 핀치 줌. **이동은 키보드·조이스틱만** 담당하며 캔버스 드래그와 분리합니다. 드래그·핀치를 클릭으로 처리하지 않아 의자·메뉴·방울이 오작동하지 않습니다. `시점 초기화`로 기본 시점을 복원합니다.
- 카메라 안전: 팬을 비활성화하고 반경 10~26, 극각 0.28~1.02 rad의 높은 궤도로 제한합니다. 가장 낮은 시점도 높이 약 5.53으로, 높이 4.2의 벽과 모든 가구 위에 있어 카메라가 내부를 통과하지 않습니다. 바닥 높이의 1인칭 시점은 제공하지 않습니다.
- 커피머신: 크림 베이지·실버의 독자적인 에스프레소 머신입니다. 원두 호퍼·압력 게이지·추출구·스팀 노즐·드립 트레이가 있습니다. 실제 브랜드 로고를 쓰지 않습니다. 클릭 또는 ☕ 도구로 메뉴를 열고 **메뉴 선택 → 추출하기**를 누릅니다. 약 2.4초 추출 후 손에 컵이 생깁니다.
- 음료: 에스프레소, 아메리카노, 라떼, 카푸치노, 바닐라라떼 + 기존 초코라떼. 데미타스·넓은 컵·키 큰 컵과 색·띠 장식이 구분됩니다. `마시기`로 컵을 입으로 가져가며 내용물이 줄어듭니다. 4번 마신 후 빈 컵을 정리할 수 있습니다.
- 디저트: 따뜻한 조명의 유리 쇼케이스에 크루아상·마카롱·쿠키·딸기 케이크·치즈케이크를 진열합니다. 기존 컵케이크·랜덤 선택도 유지합니다. 원하는 메뉴를 접시에 받고 `먹기`를 누르면 한입씩 작아지며 3회 후 접시를 정리합니다.
- 테이블: 앉았을 때 컵·접시를 내려놓거나 다시 들 수 있습니다. 먹고 마실 때는 손으로 가져갔다가 다시 놓습니다. 일어나거나 방을 옮기면 소지품을 손으로 회수합니다.
- 비눗방울: 🫧 탭으로 5~8개, 650ms 길게 눌러 대왕 방울 1개. Enter/Space, Shift+Enter/Space도 지원합니다. 약 7% 확률의 특별 무지개 방울, 반짝이·pop 효과음, 10.5초 수명, 1.8초 쿨다운, 방당 50개 상한을 적용합니다.
- 사운드: 상단 ON/OFF 또는 설정의 전체 음소거. 음악+실내 분위기 / 효과음 볼륨을 따로 조절하고 `latte:audio`에 저장합니다. 재방문 시 설정은 복원하지만 **사용자가 켜기 전에는 AudioContext를 만들거나 소리를 재생하지 않습니다**. 커피 추출, 도자기 컵, 마시기, 먹기, pop, 발걸음, 실내 공기·잔잔한 멜로디는 모두 Web Audio 자체 합성입니다. 음소거와 효과음 볼륨은 모든 동작에 적용됩니다.

## 기존 Supabase 프로젝트 연결

`cafe_rooms`, `room_presence`를 생성·삭제·수정하지 않습니다. `cafe_rooms`는 `id` 정렬의 첫 10개 행에서 `name`을 읽습니다. 스키마나 SELECT 권한이 다르면 기본 방 이름을 사용합니다. 방 식별자는 기존 앱의 1~10 번호입니다.

Realtime의 public channel 연결을 허용해야 합니다. Postgres Changes 설정과 별개로 아바타는 Presence/Broadcast를 사용합니다.

- 브라우저당 Supabase 클라이언트 / WebSocket 하나. 평소 현재 방 + 전체 접속 현황 2채널, 방명록을 열었을 때 INSERT 구독 1채널을 추가합니다.
- Presence로 실제 입·퇴장과 방별 인원수를 계산합니다. 전체 현황에는 방 가입을 마친 이용자의 현재 방만 track합니다. `room_presence`의 행 수를 실제 동접으로 간주하지 않습니다.
- 위치·방향·좌석·컵/디저트 종류·양·테이블 배치·동작/시작 시각을 변경 시에만 **최대 5Hz**로 보냅니다. 입장 스냅샷에도 같은 제한을 적용하고 원격 위치·회전·손동작은 각 기기에서 보간/애니메이션합니다.
- 방울은 생성 목록과 pop ID만 전송합니다. seed/시각으로 궤적을 계산하며 고유 UUID·tombstone으로 중복/역순 이벤트를 처리합니다. 새 입장자는 기존 방울 스냅샷을 받습니다.
- 방 이동 시 구독과 방울을 정리하고 진행 중 섭취·추출을 취소합니다. SDK 자동 재접속, 재가입 시 Presence·방울 재동기화, 오류 상태 표시를 제공합니다. 오프라인 중 만든 방울은 재접속 후 재전송하지 않습니다.
- 기존 형태의 아바타 메시지도 수신합니다. 새 음료/동작을 표시하려면 배포 후 모든 브라우저를 새로고침하세요. 좌석은 클라이언트 확인 방식이므로 동시 착석 경쟁의 독점 예약을 보장하지 않습니다.

## 영구 방명록 설정

왼쪽 벽 코르크 게시판 또는 `방명록` 버튼에서 엽니다. 모든 방이 같은 최신 50개 메모를 공유하고 새 INSERT를 Realtime으로 갱신합니다. 닉네임 1~16자, 메시지 1~100자, 기본 비속어·링크·반복 문자 검증을 적용하며 JSX 텍스트로만 렌더링합니다.

### Supabase에 적용

1. SQL Editor에서 [202611020001_guestbook.sql](supabase/migrations/202611020001_guestbook.sql)을 **한 번 실행**합니다. 또는 Supabase CLI로 해당 migration을 적용합니다. 이 파일은 새 `public.cafe_guestbook`, 비공개 `latte_private.guestbook_rate`, 저장 RPC와 읽기 정책을 생성합니다. 같은 SQL을 중복 실행하는 용도는 아닙니다.
2. Auth → Providers / Sign In 설정에서 **Anonymous Sign-ins**를 활성화합니다. 앱이 첫 작성 때 `signInAnonymously()`를 호출하며 로그인 화면은 없습니다. 세션은 Supabase SDK가 유지합니다.
3. 공개 운영 전 Auth의 익명 가입 rate limit을 확인하고 **CAPTCHA를 활성화하는 것을 권장합니다**. Cloudflare Turnstile 사이트를 만들어 실제 도메인과 개발 도메인을 등록합니다. Turnstile **secret은 Supabase Auth의 CAPTCHA 설정에만** 입력하고 공개 site key만 `VITE_TURNSTILE_SITE_KEY`에 입력합니다. Auth CAPTCHA를 켰다면 site key도 반드시 설정해야 새 익명 세션을 만들 수 있습니다. 기존 프로젝트의 다른 익명 인증 사용처에도 CAPTCHA 활성화가 영향을 줍니다.
4. migration이 `supabase_realtime` publication이 있으면 방명록 테이블을 추가합니다. 없다면 프로젝트의 Realtime 설정에서 `public.cafe_guestbook` INSERT를 publication에 추가하세요.
5. Supabase 연결 후 서로 다른 브라우저에서 작성·재접속·다른 방의 새 글 갱신을 확인하세요. 사람 확인 실패, 익명 인증 비활성화, 미적용 SQL/권한 오류는 화면에 안내합니다.

### 서버 측 남용 방지

- `anon`/`authenticated`는 공개 글 읽기만 가능하며 **테이블 INSERT/UPDATE/DELETE 권한이 없습니다**. 무제한 공개 쓰기 정책을 만들지 않습니다.
- 저장은 `authenticated` 역할의 제한된 `post_cafe_guestbook` RPC만 허용합니다. 익명 Auth 사용자도 이 역할을 받습니다. 클라이언트의 임의 visitor ID를 신뢰하지 않고 JWT의 `auth.uid()`를 사용합니다.
- `SECURITY DEFINER` + 빈 `search_path`, 비공개 rate log, 트랜잭션 advisory lock으로 검사와 쓰기를 묶습니다.
- 사용자당 60초 1회, 시간당 5회, 같은 메시지 하루 1회. **익명 계정을 바꿔도 전체 시간당 100회**의 서버 상한을 적용합니다. 이 상한은 프로젝트 규모에 맞춰 SQL에서 신중하게 조정하세요. IP 제한은 구현했다고 주장하지 않습니다.
- rate log는 24시간이 지나면 다음 RPC 호출 시 정리합니다. 공개 글에는 인증 UUID를 저장하지 않습니다. 글 삭제는 관리자 SQL/서버 권한으로 처리합니다.
- 기본 금칙어 검사는 완전한 콘텐츠 모더레이션이 아닙니다. Auth CAPTCHA·가입 제한·대시보드 모니터링과 관리자 삭제를 병행하세요. 더 큰 공개 서비스에서는 신뢰할 수 있는 Edge Function에서 검증한 IP/추가 제한과 신고·관리 화면을 확장할 수 있습니다.

## 검증

```bash
npm run typecheck    # TypeScript
npm test             # 모델·입력 검증 + PGlite 실제 PostgreSQL SQL/권한 테스트
npm run build        # 프로덕션 번들
npm run preview      # 빌드 실행
npx playwright install chromium
npm run test:browser # 자동으로 5173/5174 개발 서버 실행
```

Chromium이 `/usr/bin/chromium`에 있으면 사용하고 없으면 Playwright 설치본을 사용합니다. `CHROMIUM_PATH`로 경로를 지정할 수 있습니다.

브라우저 테스트는 실제 WebGL과 PC/모바일 입력, 마우스 회전·휠·리셋, CDP 한 손가락/두 손가락 제스처, 이동 분리, 기존 좌석·방울, 추출·섭취·접시 정리, 음량 저장·오디오 초기화 방지를 확인합니다. 2개 브라우저가 실제 Supabase SDK와 **모의** Phoenix/PostgREST/Auth 서버를 사용해 Presence·Broadcast·섭취 동작·방 분리·재접속·공유 방명록을 검증합니다. SQL은 PGlite에서 실제 PostgreSQL 권한과 RPC 제한을 검사합니다. GitHub Actions에서 타입/빌드·로직·브라우저 검증을 실행합니다.

**로컬 테스트와 실제 서비스 검증은 별개입니다.** 실제 Supabase 자격 정보가 없는 환경에서는 hosted Auth/Realtime/SQL 적용, Turnstile 실서비스, 실물 모바일 성능, Vercel 배포가 확인되었다고 주장하지 않습니다. 전체 100명 동접은 목표이며 보장 수치가 아닙니다. DPR 최대 1.5, 저폴리곤 메시, 초기 프레임 접촉 그림자, 방울 50개/파티클 그룹 20개 제한을 적용하지만 100명 실부하 테스트는 별도로 필요합니다. Broadcast는 수신자 수만큼 메시지 비용이 늘어나므로 Supabase 무료 플랜의 최신 연결·메시지·처리량 한도를 확인하세요.

## Vercel 배포 및 실서비스 확인

GitHub main에 push해도 **Vercel 프로젝트 연결 여부를 확인하지 않았다면 자동 배포를 확정할 수 없습니다**. 연결된 Vercel Git 프로젝트에서 Production Branch가 `main`이고 자동 배포가 켜져 있으면 새 커밋이 배포됩니다.

1. Vercel에서 저장소 Import 또는 기존 프로젝트 연결 확인.
2. Vite / Install `npm ci` / Build `npm run build` / Output `dist`.
3. Production/Preview의 Supabase 변수와 필요한 Turnstile site key 등록. 변경 후 Redeploy.
4. Deployments에서 해당 Git 커밋이 **Ready**인지 확인하고 배포 URL에서 새로고침.
5. PC + 모바일(서로 다른 브라우저)의 같은 방에서 인원·이동·컵·마시기/먹기·방울/pop을 서로 확인.
6. 마우스/터치 카메라 조작 중 캐릭터가 이동하거나 의자가 선택되지 않는지, 리셋/줌 한도와 음소거·볼륨 저장을 확인.
7. 다른 방에 있는 두 브라우저에서 방명록 작성 → 실시간 목록 갱신 → 새로고침 후 유지 확인. 1분 내 두 번째 작성이 서버에서 거부되는지도 확인.
8. 네트워크를 끊고 복구해 재접속과 방 인원을 확인. Auth CAPTCHA가 켜졌다면 새 시크릿 브라우저에서 사람 확인도 테스트.

## 코드 위치

`Scene.tsx`는 기존 월드/아바타/방울, `CameraRig.tsx`는 안전한 회전·줌과 입력 분리, `CafeObjects.tsx`는 머신·컵·디저트·쇼케이스·게시판, `App.tsx`는 UI/동작 수명, `realtime.ts`는 기존 Supabase 연결, `audio.ts`는 자체 합성 음원과 설정, `Guestbook.tsx`와 SQL migration은 영구 방명록을 담당합니다.
