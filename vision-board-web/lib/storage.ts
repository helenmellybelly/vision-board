import { BoardData, CollageLayout, CollageTemplate, SectionData, SectionId, ChatMessage, ExtractedSlots } from './types';
import { STORY_PROMPT_VERSION } from './milestone';
import { bumpBoardRev } from './syncStamp';

const STORAGE_KEY = 'vision-board-data';

// 현재 스키마 버전 — 비멱등 마이그레이션(migrateBoard)의 게이트. 올릴 때 migrateBoard에 체인 추가
const SCHEMA_VERSION = 4;

function createEmptySection(id: SectionId): SectionData {
  return {
    id,
    status: 'not_started',
    currentPhase: 1,
    currentSlotIndex: 0,
    images: [null, null, null],
    uploadedImages: [null, null, null, null, null],
  };
}

function createEmptyBoard(): BoardData {
  return {
    sections: {
      1: createEmptySection(1),
      2: createEmptySection(2),
      3: createEmptySection(3),
      4: createEmptySection(4),
      5: createEmptySection(5),
      6: createEmptySection(6),
    },
    onboardingDone: false,
    userName: '',
    startedAt: Date.now(),
    schemaVersion: SCHEMA_VERSION,
  };
}

export function loadBoard(): BoardData {
  if (typeof window === 'undefined') return createEmptyBoard();
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return createEmptyBoard();
  try {
    const parsed = JSON.parse(raw) as BoardData;
    if (parsed.userName === undefined) parsed.userName = '';
    migrateCollage(parsed);
    migrateBoard(parsed);
    return parsed;
  } catch {
    // 손상된 JSON(quota truncation·크래시 등) — 빈 보드를 돌려주면 곧 첫 저장이
    // 이 값을 덮어써 영구 소멸한다. 원본 raw를 백업 키에 보관해 복구 여지를 남긴다 (v7.4 감사 H4).
    try {
      localStorage.setItem(`${STORAGE_KEY}-corrupt-backup`, raw);
    } catch {
      // 백업 저장조차 실패(공간 부족)하면 어쩔 수 없이 진행
    }
    return createEmptyBoard();
  }
}

/** 숲 → 매트 갤러리 전환 안내 1회 노출 플래그 (v9.0). BoardData 스키마와 분리 — 안내는 기기 사정이다 */
export const MATTE_NOTICE_KEY = 'vb-collage-matte-notice';

/** 안내를 띄워야 하는가. 읽는 즉시 소비(1회 노출) */
export function consumeMatteNotice(): boolean {
  try {
    if (localStorage.getItem(MATTE_NOTICE_KEY) !== '1') return false;
    localStorage.removeItem(MATTE_NOTICE_KEY);
    return true;
  } catch {
    return false;
  }
}

// 콜라주 필드 가드형 마이그레이션 (멱등) — schemaVersion 체인과 달리 매 로드 시 돌아도 안전하다.
// v6.15: '내 배치'(custom) 탭 제거 / v9.0: 숲(polaroid) 템플릿 삭제 → 매트 갤러리(matte)
function migrateCollage(board: BoardData): void {
  let dirty = false;

  // v9.0 — 숲 삭제. 배치 좌표는 회전·지터 산포라 매트 갤러리의 균일 그리드로 재해석할 수 없다.
  // 버리면 seedLayout이 새로 깔아준다(사진 자체는 섹션 데이터에 있어 무손실).
  const LEGACY_TEMPLATES = ['polaroid', 'custom'];
  if (LEGACY_TEMPLATES.includes(board.collageTemplate as string)) {
    board.collageTemplate = 'matte';
    dirty = true;
    // 왜 템플릿이 바뀌었는지 1회 알린다 — 조용히 바뀌면 "내 보드가 망가졌다"로 읽힌다
    try {
      localStorage.setItem(MATTE_NOTICE_KEY, '1');
    } catch {
      // 프라이빗 모드 등 저장 불가 — 안내를 못 띄울 뿐 마이그레이션은 계속
    }
  }
  if (board.collageLayout) {
    board.collageLayout = undefined;
    dirty = true;
  }
  const dropLegacy = (bucket: Partial<Record<CollageTemplate, CollageLayout>> | undefined) => {
    if (!bucket) return;
    for (const t of LEGACY_TEMPLATES) {
      if (t in bucket) {
        delete (bucket as Record<string, unknown>)[t];
        dirty = true;
      }
    }
  };
  dropLegacy(board.collageLayouts);
  dropLegacy(board.collageDeviceLayouts?.phone);
  dropLegacy(board.collageDeviceLayouts?.desktop);

  // v6.19: 기존 배치에 제작 당시 비율 스탬프 — v6.18 배치는 보드 4:5 / 폰 1170×2532 / PC 1920×1080 고정이었다
  const stampAspect = (
    layouts: Partial<Record<CollageTemplate, CollageLayout>> | undefined,
    aspect: number
  ) => {
    if (!layouts) return;
    for (const layout of Object.values(layouts)) {
      if (layout && layout.aspect === undefined) {
        layout.aspect = aspect;
        dirty = true;
      }
    }
  };
  stampAspect(board.collageLayouts, 4 / 5);
  stampAspect(board.collageDeviceLayouts?.phone, 1170 / 2532);
  stampAspect(board.collageDeviceLayouts?.desktop, 1920 / 1080);
  // 기기 배치가 있는데 사이즈 미선택이면 v6.18 캐논 캔버스와 비율이 일치하는 기본 프리셋으로 — 기존 배치 무손실
  if (!board.collageDevicePresets && board.collageDeviceLayouts) {
    board.collageDevicePresets = { phone: 'phone', desktop: 'pc-fhd' };
    dirty = true;
  }

  if (dirty) saveBoard(board);
}

// 버전 게이트 마이그레이션 체인 (v7.0-r1) — migrateCollage(필드 가드형)와 달리
// 재실행하면 결과가 달라지는 마이그레이션을 schemaVersion으로 정확히 1회만 수행한다
function migrateBoard(board: BoardData): void {
  const from = board.schemaVersion ?? 0;
  if (from >= SCHEMA_VERSION) return;
  if (from < 1) {
    // v1: 온보딩 Act 0~5 → /onboarding/[step] 1~3 리맵 (Act0+1→스텝1, Act2→스텝2, Act3~5→스텝3)
    if (!board.onboardingDone && board.onboardingStep !== undefined) {
      const s = board.onboardingStep;
      board.onboardingStep = s <= 1 ? 1 : s === 2 ? 2 : 3;
    }
    // 기존 완료 사용자는 구 Act5(6영역 안내)를 이미 봤다 — 대시보드 인트로 시트 재노출 방지
    if (board.onboardingDone) {
      board.dashboardIntroSeen = true;
    }
  }
  if (from < 2) {
    // v2: /scene+/moment 통합 (r2) — 스토리 생성 전이면 순간 입력을 하루 서술에 병합해 보존.
    // 텍스트 병합은 재실행 시 중복되므로 반드시 이 게이트 안에서만 수행한다
    for (const sec of Object.values(board.sections)) {
      if (sec.situationText) {
        if (!sec.miniStory) {
          sec.sceneText = [sec.sceneText, sec.situationText]
            .filter((t): t is string => !!t?.trim())
            .join('\n');
        }
        sec.situationText = undefined;
      }
    }
  }
  if (from < 3) {
    // v3: boardYear(연도만) → targetDate(전체 날짜)로 흡수 (r3) — 연도는 유지, 월일은 오늘 기준
    if (board.boardYear && !board.targetDate) {
      const y = Number(board.boardYear);
      if (Number.isFinite(y) && y >= 1000 && y <= 9999) {
        const now = new Date();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        board.targetDate = `${y}-${m}-${d}`;
      }
      board.boardYear = undefined;
    }
  }
  if (from < 4) {
    // v4: 레거시 slots[1|2|3|5] → extractedSlots 백필 (r6) — 이후 코드는 extractedSlots만 읽는다.
    // slots 필드는 v7.1에서 타입 제거 — 저장된 레거시 JSON을 읽기 위해 로컬 캐스트로만 접근
    for (const sec of Object.values(board.sections)) {
      if (!sec.extractedSlots) {
        const slots = (sec as { slots?: Record<number, { text?: string } | undefined> }).slots;
        const legacy: ExtractedSlots = {};
        if (slots?.[1]?.text) legacy.current = slots[1].text;
        if (slots?.[2]?.text) legacy.keyword = slots[2].text;
        if (slots?.[3]?.text) legacy.want = slots[3].text;
        if (slots?.[5]?.text) legacy.feeling = slots[5].text;
        if (Object.keys(legacy).length > 0) sec.extractedSlots = legacy;
      }
    }
  }
  board.schemaVersion = SCHEMA_VERSION;
  saveBoard(board);
}

// 저장 성공 여부 반환 — base64 이미지 누적으로 localStorage 5MB 한도(QuotaExceededError)에 닿을 수 있다 (v6.17)
// skipRevBump: 방문 스탬프 등 휘발 필드만 바꾸는 저장 — 병합 판정의 "로컬 무변경" rev를 오염시키지 않게 (v8.6)
export function trySaveBoard(data: BoardData, opts?: { skipRevBump?: boolean }): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    if (!opts?.skipRevBump) bumpBoardRev(); // 이벤트 리스너가 최신 rev를 읽도록 dispatch 전에 (v8.6)
    window.dispatchEvent(new Event('vb:board-saved')); // 로그인 시 디바운스 서버 동기화 트리거 (R2-1)
    return true;
  } catch {
    return false;
  }
}

export function saveBoard(data: BoardData): void {
  trySaveBoard(data);
}

export function saveUserName(name: string): void {
  const board = loadBoard();
  board.userName = name;
  saveBoard(board);
}

export function saveSectionImage(
  sectionId: SectionId,
  index: number,
  dataUrl: string | null
): void {
  const board = loadBoard();
  board.sections[sectionId].images[index] = dataUrl;
  saveBoard(board);
}

export function saveSectionScene(sectionId: SectionId, text: string): void {
  const board = loadBoard();
  board.sections[sectionId].sceneText = text;
  saveBoard(board);
}

export function markSectionTextComplete(sectionId: SectionId): void {
  const board = loadBoard();
  // completed는 답변 편집·재진입으로 강등되지 않는다 — 사진까지 담은 완성 상태가 유일한 상위 상태 (v8.1)
  if (board.sections[sectionId].status === 'completed') return;
  board.sections[sectionId].status = 'text_complete';
  saveBoard(board);
}

export function markSectionComplete(sectionId: SectionId): void {
  const board = loadBoard();
  board.sections[sectionId].status = 'completed';
  board.sections[sectionId].completedAt = Date.now();
  saveBoard(board);
}

export function saveOnboardingStep(step: number): void {
  const board = loadBoard();
  board.onboardingStep = step;
  saveBoard(board);
}

export function markOnboardingDone(): void {
  const board = loadBoard();
  board.onboardingDone = true;
  board.onboardingStep = undefined;
  saveBoard(board);
}

// 대시보드 첫 진입 6영역 안내 시트 — 한 번 닫으면 다시 보이지 않는다 (v7.0-r1, 구 온보딩 Act5 대체)
export function saveDashboardIntroSeen(): void {
  const board = loadBoard();
  board.dashboardIntroSeen = true;
  saveBoard(board);
}

// ── R2-2: 게스트 로그인 유도 ──

// B 소프트 게이트 1회 노출 완료 — 배너 쿨다운도 같이 시작해 게이트 직후 배너가 바로 이어 뜨지 않게 한다
export function saveLoginNudgeSeen(): void {
  const board = loadBoard();
  board.loginNudgeSeen = true;
  board.loginBannerDismissedAt = Date.now();
  saveBoard(board);
}

// 재유도 배너 닫기 — 7일 후 재노출
export function dismissLoginBanner(): void {
  const board = loadBoard();
  board.loginBannerDismissedAt = Date.now();
  saveBoard(board);
}

export function markBoardFinished(): void {
  const board = loadBoard();
  board.finishedAt = Date.now();
  saveBoard(board);
}

// 첫 완주 축하 연출 1회 스탬프 (v8.3) — 대시보드 잎 파티클이 재방문마다 반복되지 않게
export function saveFinishCelebrated(): void {
  const board = loadBoard();
  board.finishCelebrated = true;
  saveBoard(board);
}

// ── 사진 먼저 플로우 (v7.1-r4) ──

// 답변 없이 사진부터 담은 섹션 — in_progress로만 승격 (completed는 답변+사진의 의미 불변)
export function markSectionPhotoStarted(sectionId: SectionId): void {
  const board = loadBoard();
  if (board.sections[sectionId].status === 'not_started') {
    board.sections[sectionId].status = 'in_progress';
    saveBoard(board);
  }
}

// '사진 먼저' 넛지 배너 닫기 — 한 번 닫으면 재노출 없음
export function dismissPhotoFirstNudge(sectionId: SectionId): void {
  const board = loadBoard();
  board.sections[sectionId].photoFirstNudgeDismissed = true;
  saveBoard(board);
}

// 복귀 인사 갭 판정용 마지막 방문 시각 — 매 대시보드 마운트마다 저장되는 휘발 필드라
// rev를 올리면 "로컬 무변경" 병합 분기가 절대 성립하지 않는다 (v8.6)
export function saveLastVisit(): void {
  const board = loadBoard();
  board.lastVisitAt = Date.now();
  trySaveBoard(board, { skipRevBump: true });
}

export function resetBoard(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

// ── 채팅 기반 신규 함수 ──

export function saveSectionChat(sectionId: SectionId, messages: ChatMessage[]): void {
  const board = loadBoard();
  board.sections[sectionId].chatMessages = messages;
  if (board.sections[sectionId].status === 'not_started' && messages.length > 1) {
    board.sections[sectionId].status = 'in_progress';
  }
  saveBoard(board);
}

export function saveExtractedSlots(sectionId: SectionId, slots: ExtractedSlots): void {
  const board = loadBoard();
  board.sections[sectionId].extractedSlots = slots;
  if (board.sections[sectionId].status === 'not_started') {
    board.sections[sectionId].status = 'in_progress';
  }
  // 구 slots[1|2|3|5] 이중 쓰기 제거 (v7.0-r6) — 레거시 데이터는 마이그레이션 v4가 백필
  saveBoard(board);
}

export function saveOneSentence(sentence: string): void {
  const board = loadBoard();
  board.oneSentence = sentence;
  saveBoard(board);
}

// 목표 날짜(ISO YYYY-MM-DD) — 섹션 일기 헤더·콜라주 연도 공용 (v7.0-r3)
export function saveTargetDate(iso: string): void {
  const board = loadBoard();
  board.targetDate = iso;
  saveBoard(board);
}

export function saveCollageTemplate(template: CollageTemplate): void {
  const board = loadBoard();
  board.collageTemplate = template;
  saveBoard(board);
}

// 보드 배경색 (v9.0) — 세 템플릿 공통 전역 1개. 템플릿을 바꿔도 고른 색이 따라온다
export function saveCollageBgColor(hex: string): void {
  const board = loadBoard();
  board.collageBgColor = hex;
  saveBoard(board);
}

/** 사진 실측 치수 병합 저장 (v10) — 키는 콜라주 슬롯 키 `${sectionId}-${slotIdx}`.
 *  백필·기회적 되먹임이 여러 번 호출하므로 **병합**이지 교체가 아니다.
 *  실패(quota)해도 조용히 넘어간다 — 치수는 없으면 비율 1로 폴백하는 선택적 정보다.
 *
 *  ⚠️ skipRevBump 필수 (v8.6 계약) — 이건 /collage 마운트에서 자동으로 도는 휘발 저장이다.
 *  rev를 올리면 병합 판정의 "로컬 무변경 + 서버 앞섬 → useServer" 분기가 영영 성립하지 않아,
 *  다른 기기에서 이어하기를 눌러도 서버 보드를 못 받아온다. photoDims는 어느 기기에서든
 *  다시 측정할 수 있는 파생 캐시라 동기화 대상이 아니다(lib/merge.ts VOLATILE_BOARD_KEYS와 락스텝). */
export function savePhotoDims(entries: Record<string, { w: number; h: number; f: string }>): boolean {
  if (!Object.keys(entries).length) return true;
  const board = loadBoard();
  board.photoDims = { ...board.photoDims, ...entries };
  return trySaveBoard(board, { skipRevBump: true });
}

export function saveCollageLayout(template: CollageTemplate, layout: CollageLayout): void {
  const board = loadBoard();
  board.collageLayouts = { ...board.collageLayouts, [template]: layout };
  saveBoard(board);
}

// 기기 타깃별(폰/PC) 배치 — 보드(collageLayouts)와 분리 저장 (v6.18)
export function saveCollageDeviceLayout(
  target: 'phone' | 'desktop',
  template: CollageTemplate,
  layout: CollageLayout
): void {
  const board = loadBoard();
  board.collageDeviceLayouts = {
    ...board.collageDeviceLayouts,
    [target]: { ...board.collageDeviceLayouts?.[target], [template]: layout },
  };
  saveBoard(board);
}

// 기기별 선택 사이즈(WALLPAPER_PRESETS id) 저장 (v6.19)
export function saveCollageDevicePreset(target: 'phone' | 'desktop', presetId: string): void {
  const board = loadBoard();
  board.collageDevicePresets = { ...board.collageDevicePresets, [target]: presetId };
  saveBoard(board);
}

// 비율이 다른 사이즈로 변경 시 — 해당 기기의 모든 템플릿 배치를 비우고 새 비율로 리시드 (v6.19)
export function clearCollageDeviceLayouts(target: 'phone' | 'desktop'): void {
  const board = loadBoard();
  if (board.collageDeviceLayouts?.[target]) {
    delete board.collageDeviceLayouts[target];
    saveBoard(board);
  }
}

export function saveFutureDayStory(story: string): void {
  const board = loadBoard();
  board.futureDayStory = story;
  // 저장 시점의 완성 칸 수 스탬프 (v7.8) — 생성·수동 수정 모두 "현재 보드 기준 최신본"이므로
  // 함께 갱신해 재작성 넛지를 접는다
  board.storyWrittenAtCount = Object.values(board.sections).filter(
    (s) => s.status === 'completed'
  ).length;
  // 프롬프트 버전 스탬프 (v8.4) — 최신 프롬프트로 다시 쓰면 업그레이드 넛지가 접힌다
  board.storyPromptVersion = STORY_PROMPT_VERSION;
  saveBoard(board);
}

// 프롬프트 업그레이드 재작성 넛지 닫기 (v8.4) — 한 번 닫으면 재노출 없음
export function dismissStoryUpgradeNudge(): void {
  const board = loadBoard();
  board.storyUpgradeNudgeDismissed = true;
  saveBoard(board);
}

export function saveMiniStory(sectionId: SectionId, story: string): void {
  const board = loadBoard();
  board.sections[sectionId].miniStory = story;
  saveBoard(board);
}

// 성공 여부 반환(v7.4 감사 H1) — base64 이미지 누적으로 quota에 닿을 수 있어 호출부가 확인해야 한다
export function saveGeneratedImages(sectionId: SectionId, urls: string[]): boolean {
  const board = loadBoard();
  board.sections[sectionId].generatedImages = urls;
  return trySaveBoard(board);
}

export function saveImageDescriptions(sectionId: SectionId, descriptions: string[]): void {
  const board = loadBoard();
  board.sections[sectionId].imageDescriptions = descriptions;
  saveBoard(board);
}

export function saveImageKeywords(sectionId: SectionId, keywords: string[]): void {
  const board = loadBoard();
  board.sections[sectionId].imageKeywords = keywords;
  saveBoard(board);
}

// 성공 여부 반환 — false면 저장 공간 부족 (호출부에서 무시해도 무방)
// sourceId(v7.1-r2): 원격 픽(큐레이션·Unsplash)의 photo.id. 비우기(null)·수동 업로드가
// 자동으로 출처를 소거하도록 항상 함께 기록한다 — 별도 클린업 경로 없음
// dims(v10): 저장하는 이미지의 실측 치수. 여기서 함께 기록해야 콜라주가 가로/세로를 안다.
// 슬롯을 비우면(dataUrl null) 치수도 함께 지운다 — 남겨두면 지문만 어긋난 쓰레기가 쌓인다.
export function saveUploadedImage(
  sectionId: SectionId,
  index: number,
  dataUrl: string | null,
  sourceId?: string | null,
  dims?: { w: number; h: number; f: string } | null
): boolean {
  const board = loadBoard();
  const sec = board.sections[sectionId];
  const current = sec.uploadedImages ?? [null, null, null, null, null];
  while (current.length < 5) current.push(null);
  current[index] = dataUrl;
  sec.uploadedImages = current;
  const sources = sec.uploadedImageSources ?? [null, null, null, null, null];
  while (sources.length < 5) sources.push(null);
  sources[index] = dataUrl ? sourceId ?? null : null;
  sec.uploadedImageSources = sources;
  const dimKey = `${sectionId}-${index}`;
  if (!dataUrl) {
    if (board.photoDims?.[dimKey]) delete board.photoDims[dimKey];
  } else if (dims && dims.w > 0 && dims.h > 0) {
    board.photoDims = { ...board.photoDims, [dimKey]: dims };
  }
  return trySaveBoard(board);
}

// 성공 여부 반환(v7.4 감사 H1) — quota 초과 시 false, 호출부가 완료 처리를 막아야 한다
export function saveUploadedImages(sectionId: SectionId, images: (string | null)[]): boolean {
  const board = loadBoard();
  const sec = board.sections[sectionId];
  // 벌크 저장 시 출처 정합(v7.1-r2): 인덱스별로 이미지가 그대로면 출처 보존, 바뀌었으면 소거
  const prev = sec.uploadedImages ?? [];
  const sources = sec.uploadedImageSources ?? [];
  sec.uploadedImageSources = images.map((img, i) =>
    img && img === prev[i] ? sources[i] ?? null : null
  );
  sec.uploadedImages = images;
  return trySaveBoard(board);
}

// AI 이미지만 초기화 (업로드 이미지 유지)
export function resetAiImages(sectionId: SectionId): void {
  const board = loadBoard();
  const sec = board.sections[sectionId];
  sec.generatedImages = undefined;
  sec.completedAt = undefined;
  sec.status = 'text_complete';
  saveBoard(board);
}

// ── v7.4: 일기 재생성 제한 · 슬롯 유예 · pathSheet 선택 기억 ──

/** 일기 재생성 1회 기록 후 누적 횟수 반환 — "하루 다시 쓰기"·"더 담고 싶은 장면" 합산 */
export function incrementDiaryRegen(sectionId: SectionId): number {
  const board = loadBoard();
  const sec = board.sections[sectionId];
  sec.diaryRegenCount = (sec.diaryRegenCount ?? 0) + 1;
  saveBoard(board);
  return sec.diaryRegenCount;
}

/** 슬롯 유예 설정/해제 — keyword는 장면·finish 재료라 유예 불가(호출부에서 차단, 여기서도 무시) */
export function setSlotDeferred(
  sectionId: SectionId,
  key: keyof ExtractedSlots,
  deferred: boolean
): void {
  if (key === 'keyword') return;
  const board = loadBoard();
  const sec = board.sections[sectionId];
  const list = (sec.deferredSlots ?? []).filter((k) => k !== key);
  if (deferred) list.push(key);
  sec.deferredSlots = list.length > 0 ? list : undefined;
  saveBoard(board);
}

/** 양경로 시트 선택 기록 — 같은 선택이 이어지면 streak 증가, 다르면 1로 리셋 */
export function recordPathChoice(kind: 'question' | 'photo'): void {
  const board = loadBoard();
  const prev = board.pathChoice;
  board.pathChoice =
    prev?.kind === kind ? { kind, streak: prev.streak + 1 } : { kind, streak: 1 };
  saveBoard(board);
}

// C1: 수정 캐스케이드 리셋 함수들

export function resetImages(sectionId: SectionId): void {
  const board = loadBoard();
  const sec = board.sections[sectionId];
  sec.generatedImages = undefined;
  sec.imageDescriptions = undefined;
  sec.imageKeywords = undefined;
  sec.uploadedImages = [null, null, null, null, null];
  sec.uploadedImageSources = [null, null, null, null, null];
  sec.completedAt = undefined;
  sec.status = 'text_complete';
  saveBoard(board);
}
