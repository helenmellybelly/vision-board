export type SectionId = 1 | 2 | 3 | 4 | 5 | 6;

export type SlotId = 1 | 2 | 3 | 4 | 5 | 6;

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
  example: string;
  helpQuestions: string[];
}

// 미래의 하루(/scene) 단계 질문 정의 (v6.21 — 과거 phase-3 슬롯에서 이관)
export interface SceneStep {
  question: string;
  placeholder: string;
  example: string;
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
  reviewTemplate: string;
  situationChips?: string[];
  imageQuery?: string; // Unsplash 추천 검색어 — 영어가 검색 품질이 좋다 (v6.17)
}

export interface SlotAnswer {
  text: string;
  isDeferred: boolean;
  helpAnswers?: string[];
}

export interface SectionData {
  id: SectionId;
  status: SectionStatus;
  currentPhase: 1 | 2 | 3 | 4 | 5;
  currentSlotIndex: number;
  slots: Record<SlotId, SlotAnswer | undefined>;
  chatMessages?: ChatMessage[];          // 섹션 채팅 기록
  extractedSlots?: ExtractedSlots;      // 채팅에서 추출된 슬롯
  sceneMessages?: ChatMessage[];         // 장면 대화 기록
  images: (string | null)[];
  sceneText?: string;
  sceneTexts?: string[];
  completedAt?: number;
  situationText?: string;
  miniStory?: string;
  generatedImages?: string[];
  imageDescriptions?: string[];          // AI 제안 한국어 묘사 3개 (사용자 편집 가능)
  imageKeywords?: string[];              // 장면별 Unsplash 영어 검색어 3개 — 묘사가 바뀌면 다시 계산 (v6.20)
  uploadedImages?: (string | null)[];   // 사용자 직접 업로드 이미지 (최대 3개 — 보드·콜라주와 동일)
}

// 콜라주(한눈에 보기) 템플릿 — v6.15: '내 배치' 탭 제거, 모든 템플릿이 자유 편집 가능
export type CollageTemplate = 'polaroid' | 'mosaic' | 'minimal';

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

// 문구 스티커 — 보드 위에 올리는 텍스트. 위치/크기는 CollageLayout.items에 `sticker:${id}` 키로 저장
export type StickerStyle = 'script' | 'chip' | 'outline';

export interface CollageSticker {
  id: string;
  text: string;
  style: StickerStyle; // script = 손글씨(Enjoystories) / chip = 종이 라벨 / outline = 아웃라인 레터
  color?: string; // script 스타일 글자색 (기본: 테마에 맞는 흑/백)
}

export interface CollageLayout {
  items: Record<string, CollageLayoutItem>;
  stickers?: Record<string, CollageSticker>;
  /** 이 배치가 만들어진 캔버스 비율(w/h) — 비율이 바뀌면 리시드 판단에 쓴다 (v6.19). 레거시 데이터엔 없음 → 마이그레이션이 채움 */
  aspect?: number;
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
  /** @deprecated v6.21 — /welcome 페이지 제거로 미사용. 기존 저장 데이터 호환용으로만 남김 */
  welcomeSeen?: boolean;
  oneSentence?: string;
  futureDayStory?: string;
  /** 목표 날짜(ISO YYYY-MM-DD) — 섹션 일기 헤더·콜라주 연도의 단일 소스 (v7.0-r3). 기본 오늘+3년 */
  targetDate?: string;
  /** @deprecated v7.0-r3 — targetDate로 통일. 마이그레이션 v3가 흡수, R6에서 제거 예정 */
  boardYear?: string;
  collageTemplate?: CollageTemplate;     // 한눈에 보기 템플릿 선택값
  /** @deprecated v6.14 '내 배치' 레이아웃 — loadBoard()가 collageLayouts.polaroid로 이관 */
  collageLayout?: CollageLayout;
  collageLayouts?: Partial<Record<CollageTemplate, CollageLayout>>; // 템플릿별 편집 배치 (board 타깃)
  // 기기 타깃별 편집 배치 — 폰/PC 배경화면 전용 (v6.18). 비율은 collageDevicePresets가 결정 (v6.19)
  collageDeviceLayouts?: Partial<
    Record<'phone' | 'desktop', Partial<Record<CollageTemplate, CollageLayout>>>
  >;
  // 기기별 선택 사이즈 — lib/wallpaper.ts WALLPAPER_PRESETS의 id (v6.19 사이즈 우선 플로우)
  collageDevicePresets?: { phone?: string; desktop?: string };
}
