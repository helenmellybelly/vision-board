# 꿈의 정원 일지 — 디자인 시스템 (v6.15)

서비스 전체의 시각 언어 단일 소스. 코드의 단일 소스는 `app/globals.css`(@theme 토큰)와 `lib/colors.ts`(섹션 팔레트)이며, 이 문서는 그 사용 규칙을 설명한다.

## 1. 폰트

| 역할 | 폰트 | 사용처 |
|---|---|---|
| **UI 전체** | Pretendard Variable | 모든 UI 텍스트 — 헤드라인·본문·버튼·말풍선. 위계는 굵기·크기·자간으로만 표현 |
| **아트** | tvN Enjoystories (`.font-script`) | 콜라주 보드 타이틀·연도, 문구 스티커(script), 배경화면 — **`components/collage/**` 전용** |

규칙 (v6.15, 기계 검증됨): UI에는 Pretendard 하나만 쓴다 — 통일감이 최우선.
`.font-script`(손글씨)는 비전보드 "작품" 영역(콜라주·스티커·배경화면)에서만 허용된다.
구 `.font-display`(Gowun Batang)는 제거됨 — 어디서도 쓰지 않는다.
가드: `node scripts/check-typography.js` (verify 스크립트에 포함) — font-display 사용과 콜라주 밖 font-script 사용을 잡는다.

폰트 파일: `public/fonts/Enjoystories.woff` 셀프호스팅. canvas `ctx.font`와 family명을 공유해야 해서
next/font(해시 family) 대신 `globals.css`의 평문 `@font-face`를 쓴다. 라이선스: 무료·상업적 사용 가능.

## 2. 타입 스케일 (7단계)

`globals.css`의 `@theme`에 정의 — `text-[15px]` 같은 임의값과 `text-sm` 같은 기본 유틸리티 사용 금지.

| 토큰 | 크기 / 행간 | 용도 |
|---|---|---|
| `text-display-lg` | 32px / 1.3 | 히어로 헤드라인 |
| `text-display` | 24px / 1.35 | Act·페이지 대표 타이틀 |
| `text-title` | 20px / 1.4 | 페이지 제목, 섹션 타이틀 |
| `text-heading` | 17px / 1.5 | 섹션 헤더, CTA 버튼 |
| `text-body` | 15px / 1.65 | 본문, 말풍선 |
| `text-caption` | 13px / 1.5 | 보조 설명, 모드 탭 |
| `text-micro` | 11px / 1.4 | 힌트, 라벨, 캡션 |

예외: 콜라주 보드의 연도·스티커는 보드 폭 기반 `cqi` 단위(아트 타이포그래피)로 스케일 밖 허용.

## 3. 간격 스케일

Tailwind 4px 그리드 위에서 의도를 갖고 쓴다 — 같은 화면에서 임의로 섞지 않는다.

| 간격 | 클래스 | 용도 |
|---|---|---|
| 4~6px | `gap-1`~`gap-1.5`, `space-y-1.5` | 한 덩어리 안의 밀착 요소 (카드 내부, 도트, 사진 그리드 셀) |
| 8~10px | `mt-2`, `mb-2.5`, `gap-2` | 제목↔부속 텍스트, 헤더↔콘텐츠 — 같은 블록의 연결 |
| 12px | `gap-3`, `space-y-3` | 형제 카드·섹션 항목 사이 |
| 16px | `mt-4`, `mb-4` | **새 주제 블록**의 시작, 콘텐츠↔CTA |
| 24px+ | `mt-6`+ | 페이지 단위 구획 |

원칙: 결론 문구는 그 근거(이미지·카드)에 *바짝*, 새 주제는 *넉넉히*. flex-1로 잉여 공간을
중간 요소가 흡수하게 두지 말 것 — 잉여는 `justify-center`로 가장자리에 보낸다 (v6.15 온보딩 교훈).

## 4. 컬러

### 뉴트럴 (globals.css `:root`)

| 토큰 | 값 | 용도 |
|---|---|---|
| `--background` | `#FAF9F7` | 페이지 배경 (크림) |
| `--foreground` | `#1C1B19` | 본문 텍스트 |
| `--card` | `#FFFFFF` | 카드 배경 |
| `--text-hint` | `#6E6962` | 보조 텍스트 (크림 위 5.2:1) |
| `--border` | `#E5E3DF` | 보더 |

### 섹션 팔레트 (`lib/colors.ts` — v6.15 파스텔/뮤트 톤 복원)

| 영역 | 메인 | 크림 대비 | 라이트 틴트 |
|---|---|---|---|
| 나 | `#7868A9` | 4.59 | `#EFEDF5` |
| 건강 | `#4F7A5F` | 4.66 | `#EAEFEC` |
| 관계 | `#996826` | 4.57 | `#F5EFE5` |
| 일 | `#5273A3` | 4.60 | `#EBEFF5` |
| 돈 | `#B05A36` | 4.58 | `#F5EBE7` |
| 공간 | `#3D7B87` | 4.56 | `#E8F0F1` |

규칙: 메인 컬러는 텍스트·아이콘·보더 강조에 (4.5:1 검증됨), 라이트 틴트는 배경 채움에만.
색을 바꿀 때는 `lib/colors.ts`만 수정하고 크림·흰색 대비 ≥ 4.5:1을 재검증한다.

## 5. 버튼 상태 규칙

CTA 라벨은 사용자의 실제 상태를 반영한다 — 콘텐츠가 없는데 "수정"을 권하지 않는다.

| 상태 | 라벨 |
|---|---|
| 해당 단계 콘텐츠 없음 | **작성하기 →** (강조 굵기) |
| 콘텐츠 있음 | 수정하러 가기 → |

판별 기준은 표시 중인 콘텐츠 그 자체(슬롯 답변·sceneText·miniStory) — 사진 업로드 여부와 무관.

## 6. 단계 라벨 (v6.15 리네이밍)

시스템 구조가 아닌 사용자의 행동 언어로 쓴다 (`components/ProcessBar.tsx` · `ProcessGuide.tsx` 동기화).

꿈 꺼내기 → 하루 그리기 → 미래 스토리 → 사진 담기 → 완성

## 7. 포커스 & 인터랙션

- 전역 `:focus-visible`: 2px `#1C1B19` 아웃라인. 단 **텍스트 입력(input/textarea)은 예외** — 보더 색 전환(`focus:border-[#1C1B19]`)이 포커스 표시를 대신한다 (보더+아웃라인 이중선 방지).
- 트랜지션 150~300ms, `prefers-reduced-motion` 존중 (globals.css 처리됨).
- 콜라주 보드: 탭(이동 8px 미만) = 편집 진입 / 드래그 = 페이지 스크롤. 편집 중에만 `touch-action: none`.

## 8. 콜라주 보드 & 배경화면 (`lib/collageTemplates.ts` · `lib/wallpaper.ts`)

템플릿 3종 — 모두 같은 드래그 엔진(`CollageBoard`) 위에서 자유 편집되고, 편집 결과는 템플릿별로 저장된다(`collageLayouts`).

| 템플릿 | 배경 | 언어 |
|---|---|---|
| `polaroid` (UI 라벨 '숲') | 딥 포레스트 그라디언트 `#1F2E22→#2A3D2E` (v7.6) | 프레임리스 사진 산포·회전, 중앙 연도 카드 `#33473A`, 기본 스티커 시드 |
| `mosaic` | `#FAF9F7` 크림 | 매거진 스팬 그리드(2×2 히어로 셀), 상단 타이틀 |
| `minimal` | `#FFFFFF` 흰색 | 균일 정사각 그리드, 상단 타이틀 |

v7.6 숲 서피스 팔레트는 `lib/colors.ts`의 `FOREST` 단일 소스 — 산책길 지도(WalkPathMap)·미니보드·콜라주 숲 테마·
배경화면 내보내기(`wallpaper.ts`)가 같은 값을 공유한다. 흰 폴라로이드 프레임(턱 포함)은 v7.6에서 제거 —
전 템플릿이 라운드 사진 단일 경로(`drawRoundedPhoto`, dark 테마는 그림자 강화)를 쓴다.

### 문구 스티커 3스타일

| 스타일 | 모양 | 서체 |
|---|---|---|
| `script` | 손글씨, 색상 선택 가능 | Enjoystories 700 |
| `chip` | 흰 종이 라벨 + 그림자 | Pretendard 600 |
| `outline` | 흰 채움 + 잉크 아웃라인, 대문자 | Pretendard 800 |

글자 크기 = 항목 폭 × 보드 폭 × `STICKER_FONT_RATIO` — DOM(cqi)과 canvas가 같은 식을 써서
화면과 저장 이미지가 일치한다(WYSIWYG). 배경화면 '한 장 모아담기'는 `renderBoardLayout()`이
화면 배치를 1:1로 옮기고, '섹션 묶음'은 기존 polaroid/minimal 스타일을 유지한다.
저장 진입은 '폰 배경화면 저장'/'PC 배경화면 저장' 2버튼 — 시트 안에서 기기를 다시 고르지 않는다.
