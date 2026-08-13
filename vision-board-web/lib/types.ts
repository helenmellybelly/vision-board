export type SectionId = 1 | 2 | 3 | 4 | 5 | 6;

// not_started → in_progress → text_complete → completed
// text_complete = 채팅 대화 완료
// completed = scene + images 까지 완료
export type SectionStatus = 'not_started' | 'in_progress' | 'text_complete' | 'completed';

export interface ChatMessage {
  role: 'assistant' | 'user';
  content: string;
}

// 채팅에서 추출된 슬롯 (내부 저장용)
export interface ExtractedSlots {
  current?: string;   // ① 지금 나는
  keyword?: string;   // ② 방향 키워드
  want?: string;      // ③ 원하는 것
  feeling?: string;   // ⑤ 이뤄졌을 때 기분
}

export interface SectionQuestion {
  key: keyof ExtractedSlots;
  label: string;
  cushionText: string;
  questionText: string;
  placeholder: string;
  /** v7.6 — 예시 세트 배열. 원소 1개 = 한 사람의 완결 답변(복수 항목은 \n), "다른 예시 보기"로 순환 */
  examples: string[];
  helpQuestions: string[];
}

// 미래의 하루(/scene) 단계 질문 정의 (v6.21 — 과거 phase-3 슬롯에서 이관)
export interface SceneStep {
  question: string;
  placeholder: string;
  /** v7.6 — 세트 0 = 산문 일기체, 세트 1 = 장면 불릿체. 두 형식 모두 유효함을 보여준다 */
  examples: string[];
  helpQuestions: string[];
}

export interface Section {
  id: SectionId;
  title: string;
  shortTitle?: string;
  subtitle: string;
  color: string;
  lightColor: string;
  sceneStep: SceneStep;
  imageHints: string[];
  imageHintIntro: string;
  introText: string;
  whyText: string;
  phaseOneQuestions: SectionQuestion[];
  imageQuery?: string; // Unsplash 추천 검색어 — 영어가 검색 품질이 좋다 (v6.17)
}

export interface SectionData {
  id: SectionId;
  status: SectionStatus;
  currentPhase: 1 | 2 | 3 | 4 | 5;
  currentSlotIndex: number;
  chatMessages?: ChatMessage[];          // 섹션 채팅 기록
  extractedSlots?: ExtractedSlots;      // 질문 답변 단일 소스 (current/keyword/want/feeling)
  images: (string | null)[];
  sceneText?: string;
  completedAt?: number;
  /** @deprecated v7.0-r2 — 마이그레이션 v2가 sceneText로 병합. 레거시 데이터 호환용 */
  situationText?: string;
  miniStory?: string;
  generatedImages?: string[];
  imageDescriptions?: string[];          // AI 제안 한국어 묘사 3개 (사용자 편집 가능)
  imageKeywords?: string[];              // 장면별 Unsplash 영어 검색어 3개 — 묘사가 바뀌면 다시 계산 (v6.20)
  uploadedImages?: (string | null)[];   // 사용자 직접 업로드 이미지 (최대 3개 — 보드·콜라주와 동일)
  /** 슬롯별 출처 사진 id (uploadedImages와 인덱스 정렬, v7.1-r2) — 큐레이션/Unsplash photo.id, 수동 업로드·URL은 null.
   *  갤러리 '담기 해제' 토글의 진실 원천: 슬롯은 압축 base64라 역매핑이 불가능하다 */
  uploadedImageSources?: (string | null)[];
  /** '사진 먼저' 넛지 배너 닫음 여부 (v7.1-r4) — 한 번 닫으면 재노출 없음 */
  photoFirstNudgeDismissed?: boolean;
  /** 일기 재생성 횟수 합산 — "하루 다시 쓰기"+"더 담고 싶은 장면" 공용 카운터 (v7.4).
   *  2회 이후에는 재생성 대신 직접 수정을 권한다. 첫 생성은 세지 않는다 */
  diaryRegenCount?: number;
  /** "나중에 답할게요" 유예 슬롯 키 목록 (v7.4) — keyword는 장면·finish 재료라 유예 불가.
   *  답변이 채워지면 해당 키를 목록에서 제거한다 */
  deferredSlots?: (keyof ExtractedSlots)[];
}

// 콜라주 템플릿 — v10 전면 교체. 구 id(mosaic/minimal/matte)는 storage.ts 스키마 v5가 이관한다.
// ⚠️ 템플릿은 배치 알고리즘이 아니라 **완성된 구성안**이다 — 배치 구조 + 타이틀 위치 +
//    기본 스티커 킷 + 갭. 여백 수치로만 구분하면 (a) 사진이 작아지거나 (b) 차이를 못 느낀다.
//    v9의 모자이크↔미니멀이 갭 0.025 vs 0.03 차이뿐이라 사실상 같은 템플릿이었던 게 그 증거다.
//    에디토리얼 = 순서대로 조밀 / 매거진 = 한 장이 주인공 / 스튜디오 = 방향별로 정렬
export type CollageTemplate = 'editorial' | 'magazine' | 'studio';

// 편집 타깃 — board = 한눈에 보기(4:5), phone = 폰 배경(9:19.5), desktop = PC 배경(16:9).
// 타깃마다 좌표 공간(가로세로비)이 달라 배치를 따로 저장한다 (v6.18)
export type CollageTarget = 'board' | 'phone' | 'desktop';

// 배치 항목 — 0..1 정규화 좌표 (4:5 보드 기준).
// 키는 사진 `${sectionId}-${slotIdx}` 또는 스티커 `sticker:${id}`
export interface CollageLayoutItem {
  x: number; // 좌상단 x (컨테이너 폭 대비)
  y: number; // 좌상단 y (컨테이너 높이 대비)
  w: number; // 폭 (컨테이너 폭 대비)
  z: number; // 쌓임 순서 (클수록 앞)
  rot?: number; // 회전(도) — 폴라로이드 산포·스티커용. 없으면 0
  h?: number; // 정규화 높이 — 없으면 정사각(w × 보드 가로/세로비). 모자이크 스팬 셀용
}

// 스티커 — 보드 위에 올리는 문구·장식. 위치/크기는 CollageLayout.items에 `sticker:${id}` 키로 저장
export type StickerStyle = 'script' | 'chip' | 'outline';

export interface CollageSticker {
  id: string;
  text: string;
  style: StickerStyle; // script = 손글씨(Enjoystories) / chip = 종이 라벨 / outline = 아웃라인 레터
  color?: string; // script 스타일 글자색 (기본: 테마에 맞는 흑/백)
  /** v10 — 'icon'이면 text 대신 icon(lib/stickerArt.ts의 IconId)을 그린다. 없으면 'text' */
  kind?: 'text' | 'icon';
  icon?: string;
}

export interface CollageLayout {
  items: Record<string, CollageLayoutItem>;
  stickers?: Record<string, CollageSticker>;
  /** 이 배치가 만들어진 캔버스 비율(w/h) — 비율이 바뀌면 리시드 판단에 쓴다 (v6.19). 레거시 데이터엔 없음 → 마이그레이션이 채움 */
  aspect?: number;
  /** v8.0 — 사용자가 직접 손댄 배치인지. false('기본 배치로' 직후)면 사진 추가 시 신선한 시드로 재배치,
   *  true(드래그·리사이즈·회전·스티커 조작)면 기존 위치 보존 + 새 키만 빈 공간 배치.
   *  없음(레거시) = 상호작용으로만 저장됐으므로 true 취급 */
  edited?: boolean;
  /** v10 — 배치의 진실 원천. 있으면 items는 이것으로부터 파생된 결과다.
   *  ⚠️ spec을 바꿨으면 반드시 applySpec()으로 items를 다시 만들어 둘을 일치시킬 것 —
   *  이 일관성 덕분에 spec을 모르는 코드가 읽어도 정상 렌더된다 */
  spec?: JustifiedSpec;
  /** 타이틀 카드 **위치**. 모양(스타일·크기·배경·표시·방향)은 BoardData.collageTitle(전역)에 있다 —
   *  화면 비율이 다르면 좋은 자리도 다르므로 위치만 기기·템플릿별로 둔다 (v11).
   *  pos가 있으면 자유 좌표(카드 좌상단, 0..1), 없으면 anchor 프리셋.
   *  @deprecated style — v10 저장분. migrateCollage가 1회 전역으로 승격하고 이후 읽지 않는다 */
  title?: { anchor?: string; style?: string; pos?: { x: number; y: number } };
  /** v10 — 사용자가 지운 기본 킷 스티커 id. '기본 배치로'를 누르면 비워져 킷이 되살아난다 */
  kitRemoved?: string[];
  /** v10 — 사용자가 배치(spec)를 직접 손댔는가(스왑·크게/작게).
   *  edited(스티커·연도까지 포함)와 달리, 이게 false면 사진 치수를 새로 알게 됐을 때
   *  더 나은 배치로 갈아준다 — 배치를 손대지 않은 사용자에게는 그게 맞다 */
  specTouched?: boolean;
  /** v9.0 — 사용자가 '자유 배치'를 명시적으로 켠 배치. 자동 정렬·스냅 대상이 아니며 회전이 살아난다 */
  freeform?: boolean;
  /** v12 — 자유 배치에서 사용자가 만든 **사진** 좌표. 정렬로 되돌려도 여기 보관해 다시 켜면 복원된다.
   *  v11까지 토글이 파괴적이라(끄면 좌표가 사라짐) 사용자가 겁나서 못 썼다.
   *  ⚠️ 사진 키 집합이 달라졌으면 폐기한다 — 안 그러면 지운 사진의 좌표가 유령으로 되살아난다
   *  (lib/collageTemplates.ts stashMatches, scripts/verify-sticker.js S-7d) */
  freeItems?: Record<string, CollageLayoutItem>;
}

/** 저스티파이드 배치 명세 — 실체는 lib/collageJustify.ts. 구조적 타입으로만 두어 types.ts의 무의존을 지킨다.
 *  rows는 hero를 뺀 나머지를 순서대로 자른 행별 장수다(합 = order.length − (hero?1:0)) */
export interface JustifiedSpec {
  v: 2;
  order: string[];
  hero?: { key: string; side: 'top' | 'left' };
  rows: number[];
  ambient?: string;
}

export interface BoardData {
  sections: Record<SectionId, SectionData>;
  onboardingDone: boolean;
  userName: string;
  startedAt: number;
  finishedAt?: number;
  /** 스키마 버전 — 비멱등 마이그레이션의 1회 실행 게이트 (v7.0-r1). 없으면 0으로 간주 */
  schemaVersion?: number;
  /** 온보딩 진행 스텝 — v7.0-r1부터 /onboarding/[step] 1~3 (구 Act 0~5는 마이그레이션 v1이 리맵) */
  onboardingStep?: number;
  /** 대시보드 첫 진입 6영역 안내 시트 표시 여부 — 구 온보딩 Act5 대체 (v7.0-r1) */
  dashboardIntroSeen?: boolean;
  /** 마지막 대시보드 방문 시각(ms) — 복귀 인사 갭 판정 (v7.1-r4) */
  lastVisitAt?: number;
  oneSentence?: string;
  futureDayStory?: string;
  /** 최종 스토리가 저장된 시점의 completed 섹션 수 (v7.8 첫 보드) — 보드가 이보다 자라면
   *  "이야기 다시 써줄까" 넛지를 띄운다. 없으면(구 데이터) 넛지 비노출 */
  storyWrittenAtCount?: number;
  /** 목표 날짜(ISO YYYY-MM-DD) — 섹션 일기 헤더·콜라주 연도의 단일 소스 (v7.0-r3). 기본 오늘+3년 */
  targetDate?: string;
  /** @deprecated v7.0-r3 — targetDate로 통일. 마이그레이션 v3가 흡수, R6에서 제거 예정 */
  boardYear?: string;
  collageTemplate?: CollageTemplate;     // 한눈에 보기 템플릿 선택값
  /** 사진 실측 치수 (v10) — 키는 슬롯 키 `${sectionId}-${slotIdx}`, f는 슬롯 내용 지문.
   *  실체는 lib/imageDims.ts. 구조적 타입으로만 두어 types.ts의 무의존을 지킨다.
   *  ⚠️ 기기 파생 캐시다(어느 기기에서든 다시 측정할 수 있다) — lib/merge.ts의
   *  VOLATILE_BOARD_KEYS에 포함해 이것만 다른 두 보드가 '충돌'로 잡히지 않게 한다 */
  photoDims?: Record<string, { w: number; h: number; f: string }>;
  /** 보드 배경색 (v9.0) — 세 템플릿 공통·전역 1개. lib/collageTokens BG_PALETTE의 hex.
   *  ⚠️ 템플릿별/타깃별로 두지 않는 게 계약 — 템플릿을 바꿔도 고른 색이 따라와야 "내 보드 색"이 성립한다.
   *  없으면(기존 사용자) TEMPLATE_DEFAULT_BG를 써서 지금 화면 그대로 보인다(무회귀) */
  collageBgColor?: string;
  /** 타이틀 카드 **모양** (v11) — 세 템플릿·폰/PC 공통.
   *  ⚠️ collageBgColor와 같은 계약: 템플릿별/타깃별로 두지 않는다. 템플릿을 바꿔도 고른 모양이
   *  따라와야 "내 타이틀"이 성립한다. 위치만 CollageLayout.title에 기기별로 둔다.
   *  각 필드가 없으면 템플릿 기본값으로 접힌다 — 그래야 세 템플릿이 계속 서로 달라 보인다
   *  (lib/collageTokens resolveTitleConfig가 유일한 해석기) */
  collageTitle?: {
    style?: string;
    /** 'v' 세로 쌓기 · 'h' 라벨 옆에 연도 */
    dir?: string;
    /** 'all' | 'label' | 'year' | 'none' */
    parts?: string;
    /** 'solid' | 'soft' | 'clear' */
    bg?: string;
    /** 'auto' | 'light' | 'dark' */
    ink?: string;
    scale?: number;
  };
  /** @deprecated v6.14 '내 배치' 레이아웃 — loadBoard()가 collageLayouts.polaroid로 이관 */
  collageLayout?: CollageLayout;
  collageLayouts?: Partial<Record<CollageTemplate, CollageLayout>>; // 템플릿별 편집 배치 (board 타깃)
  /** v10 마이그레이션이 구제한 사용자 문구 스티커 — 배치는 재해석 불가라 버리지만 글은 아깝다.
   *  첫 시드에서 빈 자리에 다시 얹고 비운다 */
  collageStickerSalvage?: CollageSticker[];
  // 기기 타깃별 편집 배치 — 폰/PC 배경화면 전용 (v6.18). 비율은 collageDevicePresets가 결정 (v6.19)
  collageDeviceLayouts?: Partial<
    Record<'phone' | 'desktop', Partial<Record<CollageTemplate, CollageLayout>>>
  >;
  // 기기별 선택 사이즈 — lib/wallpaper.ts WALLPAPER_PRESETS의 id (v6.19 사이즈 우선 플로우)
  collageDevicePresets?: { phone?: string; desktop?: string };
  /** 양경로(pathSheet) 직전 선택 기억 (v7.4) — 같은 선택 3연속이면 시트를 생략하고 직행한다 */
  pathChoice?: { kind: 'question' | 'photo'; streak: number };
  /** 로그인 소프트 게이트(B) 1회 노출 완료 (R2-2) — 첫 사진 이후 첫 대시보드 방문 시 시트.
   *  로그인하면 렌더 조건(unauthenticated)이 자동으로 접으므로 필드 정리는 불필요 */
  loginNudgeSeen?: boolean;
  /** 로그인 재유도 배너 마지막 닫은 시각(ms) (R2-2) — 7일 지나면 재노출 */
  loginBannerDismissedAt?: number;
  /** 첫 완주 축하 연출 1회 완료 (v8.3) — 스탬프형(storyWrittenAtCount 관례): 없으면 연출 후 스탬프 */
  finishCelebrated?: boolean;
  /** 최종 스토리를 생성한 프롬프트 버전 (v8.4) — lib/milestone STORY_PROMPT_VERSION보다 낮으면(없으면 1)
   *  "다시 써볼까" 업그레이드 넛지 대상. ⚠️ 구 데이터에 넛지가 뜨는 것이 의도 — storyWrittenAtCount와 반대 방향 */
  storyPromptVersion?: number;
  /** 프롬프트 업그레이드 재작성 넛지 닫음 (v8.4) — 한 번 닫으면 재노출 없음 */
  storyUpgradeNudgeDismissed?: boolean;
}
