'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { track } from '@/lib/analytics';
import AccountButton from '@/components/AccountButton';
import {
  clearCollageDeviceLayouts,
  consumeCollageNotice,
  loadBoard,
  saveTargetDate,
  saveCollageDeviceLayout,
  saveCollageBgColor,
  saveCollageTitle,
  saveCollageDevicePreset,
  saveCollageTemplate,
  savePhotoDims,
  saveUploadedImage,
} from '@/lib/storage';
import { getTargetDate, getTargetYear, withYear } from '@/lib/targetDate';
import { SECTIONS, getSection } from '@/lib/questions';
import { BoardData, CollageLayout, CollageTemplate, SectionId } from '@/lib/types';
import { ASPECT, CollageItem, DEFAULT_TEMPLATE, TEMPLATE_ORDER, aspectsEqual, resolveLayout } from '@/lib/collageTemplates';
import { BG_PALETTE, normalizeBgColor, titleInkFor } from '@/lib/collageTokens';
import { WALLPAPER_PRESETS, WallpaperPreset } from '@/lib/wallpaper';
import { IMPORT_NOTICES, importRemoteImage } from '@/lib/imagePick';
import { findRemoteSlots, normalizeSlots } from '@/lib/imageNormalize';
import { compressImageWithDims } from '@/lib/imageUtils';
import { fingerprint, measureMany, ratioOf } from '@/lib/imageDims';
import { removeSlotImage } from '@/lib/photoSlots';
import { FIRST_BOARD_THRESHOLD } from '@/lib/milestone';
import WallpaperSheet from '@/components/WallpaperSheet';
import CollageBoard from '@/components/collage/CollageBoard';
import DevicePresetPicker from '@/components/collage/DevicePresetPicker';

// 화면 구조 (v7.2) — choose 뷰 제거, 한 화면에서 뷰 토글 + 인라인 사이즈 선택
// v7.3 — 사이즈는 패널 대신 상단 칩 상시 노출, ?view= URL 동기화
// v7.5 — 보드 탭 제거(폰/PC 2탭): 결과물은 결국 배경화면이라 중간 산출물 뷰를 치움
// v8.1 — 편집 모드: 출처 섹션 배지 + 사진 교체/삭제 + 깨진 사진 ⚠️
// v8.2 — 나란히(lg+ 동시 렌더) 철회: 보드 폭이 절반이 되어 사진이 너무 작아짐.
//        전 뷰포트 2탭 + 보드 전폭, 저장 버튼은 sticky 하단 바, 폰 뷰 lg+는 우측 컨트롤 레일
type CollageView = 'phone' | 'desktop';

// 순서·기본값은 lib/collageTemplates.ts의 TEMPLATE_ORDER/DEFAULT_TEMPLATE 단일 소스.
// v10 — 모자이크/미니멀/매트 폐기. 세 템플릿이 배치·타이틀 위치·기본 스티커까지 함께 갈린다
const TEMPLATE_LABELS: Record<CollageTemplate, string> = {
  editorial: '에디토리얼',
  magazine: '매거진',
  studio: '스튜디오',
};
/** 탭 아래 한 줄 설명 — 이름만으로는 뭐가 다른지 모른다 */
const TEMPLATE_HINTS: Record<CollageTemplate, string> = {
  editorial: '순서대로 조밀하게',
  magazine: '한 장이 주인공',
  studio: '방향별로 정렬',
};
const TEMPLATES: { id: CollageTemplate; label: string }[] = TEMPLATE_ORDER.map((id) => ({
  id,
  label: TEMPLATE_LABELS[id],
}));

// 첫 진입 코치마크 1회 노출 여부 — BoardData 스키마와 분리해 별도 키로 관리
const COACH_KEY = 'vb-collage-coach-v1';

/** 보드의 모든 사진 슬롯 — 키 계약은 CollageBoard·parsePhotoKey와 같은 `${sectionId}-${slot}`.
 *  keyedItems와 **같은 순서·같은 우선순위**(업로드 > AI 생성)로 뽑아야 치수가 어긋나지 않는다 (v10) */
function photoSlotsOf(b: BoardData): { key: string; src: string }[] {
  const out: { key: string; src: string }[] = [];
  for (const section of SECTIONS) {
    const sec = b.sections[section.id];
    for (let i = 0; i < 3; i++) {
      const src = sec.uploadedImages?.[i] || sec.generatedImages?.[i] || '';
      if (src) out.push({ key: `${section.id}-${i}`, src });
    }
  }
  return out;
}

// 템플릿 탭 미니 스와치 (v10) — 배치뿐 아니라 **타이틀 카드 위치**까지 보여준다.
// 세 템플릿의 차이가 배치·타이틀·킷 세 축에 걸쳐 있는데 배치만 그리면 또 "비슷해 보인다"가 된다
function TemplateSwatch({ id }: { id: CollageTemplate }) {
  const cell = 'bg-[#C4C2BE] rounded-[1px]';
  const bar = 'absolute bg-[#1C1B19] rounded-[1px]';
  if (id === 'magazine') {
    // 왼쪽 히어로 한 장 + 나머지, 타이틀은 좌상단
    return (
      <span className="relative inline-block w-4 h-4 flex-shrink-0" aria-hidden="true">
        <span className={`absolute left-0 top-0 w-[7px] h-4 ${cell}`} />
        <span className={`absolute left-[8px] top-0 w-[8px] h-[7px] ${cell}`} />
        <span className={`absolute left-[8px] top-[8px] w-[8px] h-[8px] ${cell}`} />
        <span className={`${bar} left-0 top-0 w-[6px] h-[2px]`} />
      </span>
    );
  }
  if (id === 'studio') {
    // 위는 넓고 낮은 밴드(가로), 아래는 좁고 긴 밴드(세로). 타이틀은 상단 가운데
    return (
      <span className="relative inline-block w-4 h-4 flex-shrink-0" aria-hidden="true">
        <span className={`absolute left-0 top-0 w-[7.5px] h-[6px] ${cell}`} />
        <span className={`absolute left-[8.5px] top-0 w-[7.5px] h-[6px] ${cell}`} />
        <span className={`absolute left-0 top-[7px] w-[4.5px] h-[9px] ${cell}`} />
        <span className={`absolute left-[5.5px] top-[7px] w-[4.5px] h-[9px] ${cell}`} />
        <span className={`absolute left-[11px] top-[7px] w-[5px] h-[9px] ${cell}`} />
        <span className={`${bar} left-[4px] top-[2px] w-[8px] h-[1.5px]`} />
      </span>
    );
  }
  // 에디토리얼 — 행마다 높이가 다른 조밀 배치, 타이틀은 정중앙
  return (
    <span className="relative inline-block w-4 h-4 flex-shrink-0" aria-hidden="true">
      <span className={`absolute left-0 top-0 w-[6px] h-[7px] ${cell}`} />
      <span className={`absolute left-[7px] top-0 w-[4px] h-[7px] ${cell}`} />
      <span className={`absolute left-[12px] top-0 w-[4px] h-[7px] ${cell}`} />
      <span className={`absolute left-0 top-[8px] w-[9px] h-[8px] ${cell}`} />
      <span className={`absolute left-[10px] top-[8px] w-[6px] h-[8px] ${cell}`} />
      <span className={`${bar} left-[3px] top-[7px] w-[10px] h-[2px]`} />
    </span>
  );
}

export default function CollagePage() {
  const router = useRouter();
  const [board, setBoard] = useState<BoardData | null>(null);
  const [view, setView] = useState<CollageView>('phone');
  const [sheetView, setSheetView] = useState<CollageView | null>(null);
  const [confirmReseed, setConfirmReseed] = useState<{ view: CollageView; preset: WallpaperPreset } | null>(null);
  const [showCoach, setShowCoach] = useState(false);
  const [showV10Notice, setShowV10Notice] = useState(false);
  // 사진 치수 백필 진행 중 플래그 (v10) — board가 바뀔 때마다 재진입해 중복 측정하는 걸 막는다
  const backfillRef = useRef(false);
  // 사진 교체 인라인 패널 대상 — key는 `${sectionId}-${slotIdx}` (v8.1)
  const [replaceTarget, setReplaceTarget] = useState<{ view: CollageView; key: string } | null>(null);
  const [replaceUrl, setReplaceUrl] = useState('');
  const [replaceChecking, setReplaceChecking] = useState(false);
  const [replaceNotice, setReplaceNotice] = useState('');
  const replaceFileRef = useRef<HTMLInputElement>(null);
  // 로드 실패 사진 키 — 저장 전 경고 배너의 재료 (v8.1)
  const [brokenKeys, setBrokenKeys] = useState<string[]>([]);
  const [saveWarnView, setSaveWarnView] = useState<CollageView | null>(null);
  const [importingBroken, setImportingBroken] = useState(false);
  const [importBrokenNotice, setImportBrokenNotice] = useState('');

  useEffect(() => {
    const b = loadBoard();
    // 온보딩 전 딥링크 진입 시 온보딩으로 (v7.4 감사 M3)
    if (!b.onboardingDone) {
      router.replace('/onboarding');
      return;
    }
    setBoard(b);
    // 콜라주 v10 전환 안내 — loadBoard가 마이그레이션하며 세운 플래그를 1회 소비
    if (consumeCollageNotice()) setShowV10Notice(true);
    try {
      if (!localStorage.getItem(COACH_KEY)) setShowCoach(true);
    } catch {
      // iOS 프라이빗 모드 등 localStorage 접근 불가 — 코치마크 없이 진행
    }
    // ?view= 우선, 레거시 ?device=(구 /finish 딥링크) 호환 — URL은 ?view=로 정규화해
    // 페이지뷰 분석에서 서브뷰가 구분되게 남긴다 (v7.3)
    // useSearchParams는 Suspense 바운더리를 요구하므로 클라이언트 마운트에서 직접 파싱
    const params = new URLSearchParams(window.location.search);
    const v = params.get('view');
    const device = params.get('device');
    // 기본값 (v8.1): 좁은 화면은 phone(결과물 1순위가 폰 배경화면), 넓은 화면은 desktop 강조
    let initial: CollageView = window.matchMedia('(min-width: 1024px)').matches ? 'desktop' : 'phone';
    if (v === 'phone' || v === 'desktop') initial = v;
    else if (device === 'phone' || device === 'desktop') initial = device;
    else if (v === 'board') initial = 'desktop'; // 레거시 ?view=board (v7.3 이전 북마크·공유 URL)
    setView(initial);
    history.replaceState(null, '', `${window.location.pathname}?view=${initial}`);
  }, [router]);

  // 첫 진입 — 프리셋 미선택이면 양쪽 뷰 모두 표준값 자동 시드 (v7.3 → v8.1 양쪽 확장)
  // 시드 id는 반드시 실존 프리셋만 ('phone', 'pc-fhd')
  useEffect(() => {
    if (!board) return;
    const presets = board.collageDevicePresets ?? {};
    if (presets.phone && presets.desktop) return;
    if (!presets.phone) saveCollageDevicePreset('phone', 'phone');
    if (!presets.desktop) saveCollageDevicePreset('desktop', 'pc-fhd');
    setBoard(loadBoard());
  }, [board]);

  // 사진 실측 치수 백필 (v10) — v9.0의 "첫 사진 1장만 측정"을 전 사진으로 확장했다.
  // 치수를 모르면 배치 엔진이 세로 사진을 가로 자리에 우겨넣는다(그게 v9의 근본 문제였다).
  //
  // 업로드·붙여넣기 경로는 이제 저장 시점에 치수를 함께 기록하므로, 여기 걸리는 건
  // **v10 이전에 담은 사진**뿐이다. 한 번 재고 나면 다시 돌지 않는다.
  // ⚠️ measureMany는 displaySrc()를 거치고 crossOrigin을 설정하지 않는다 —
  //    DOM <img>와 캐시를 공유해야 실질 네트워크가 0이다 (v8.7 교훈, lib/imageDims.ts 헤더).
  useEffect(() => {
    if (!board || backfillRef.current) return;
    const missing = photoSlotsOf(board).filter(
      (s) => ratioOf(board.photoDims, s.key, s.src) === undefined
    );
    if (!missing.length) return;
    backfillRef.current = true;
    let alive = true;
    measureMany(missing, 6, { deadlineMs: 6000 })
      .then((map) => {
        backfillRef.current = false;
        if (!map.size) return;
        // ⚠️ 저장은 alive와 무관하게 한다. React StrictMode는 이 이펙트를 두 번 실행하는데,
        //    첫 번째의 cleanup이 alive=false로 만들고 두 번째는 backfillRef 가드에 걸려 조기 반환한다.
        //    저장까지 alive로 막으면 **측정은 끝났는데 아무것도 저장되지 않는다**(실측: photoDims 0건).
        //    측정 결과는 순수한 파생 캐시라 언마운트 뒤에 써도 안전하다.
        savePhotoDims(Object.fromEntries(map));
        if (alive) setBoard(loadBoard());
      })
      .catch(() => {
        backfillRef.current = false;
      });
    return () => {
      alive = false;
    };
  }, [board]);

  function dismissCoach() {
    // iOS 프라이빗 모드에서 setItem이 throw해도 오버레이는 닫히게 (v7.4 감사 M6)
    try {
      localStorage.setItem(COACH_KEY, '1');
    } catch {
      // 저장 실패해도 이번 세션 동안은 닫힌 상태 유지
    }
    setShowCoach(false);
  }

  if (!board) return null;

  const template: CollageTemplate = board.collageTemplate ?? DEFAULT_TEMPLATE;
  // 미설정이면 템플릿 기본색 — 기존 사용자는 지금 화면 그대로 보인다(무회귀) (v9.0)
  const bgColor = normalizeBgColor(board.collageBgColor, template);

  const completedCount = Object.values(board.sections).filter(
    (s) => s.status === 'completed'
  ).length;

  // 전 섹션의 이미지(업로드 우선, AI 생성 보조)를 하나로 모음
  const collageImages = SECTIONS.flatMap((section) => {
    const sec = board.sections[section.id];
    const uploaded = sec.uploadedImages ?? [];
    const generated = sec.generatedImages ?? [];
    return [0, 1, 2]
      .map((i) => uploaded[i] || generated[i] || null)
      .filter((img): img is string => !!img);
  });

  // 보드 배치용 — 섹션·슬롯 키와 함께 (사진 교체·삭제에도 배치가 안정적).
  // ratio (v10): 각 사진의 실측 가로세로비. v9.0은 첫 장만 알았고 그것도 히어로 on/off 판정에만
  // 썼다 — 그래서 2번째부터는 가로인지 세로인지 몰라 정사각 셀에 우겨넣고 잘라냈다.
  // 아직 못 잰 사진은 undefined → 배치 엔진이 1로 간주해 결정성을 지킨다(백필이 곧 채운다).
  const keyedItems: CollageItem[] = photoSlotsOf(board).map((s) => {
    const ratio = ratioOf(board!.photoDims, s.key, s.src);
    return ratio === undefined ? s : { ...s, ratio };
  });

  // 중앙 연도의 소스는 targetDate(일기 날짜)로 통일 (v7.0-r3) — 연도 편집도 targetDate의 연도만 교체
  const boardYear = getTargetYear(board);

  // 뷰별 파생값 — 선택 프리셋이 편집·내보내기 비율을 결정한다 (v6.19)
  function forView(v: CollageView) {
    const presetId = board!.collageDevicePresets?.[v];
    const preset = WALLPAPER_PRESETS.find((p) => p.id === presetId);
    const aspect = !preset ? ASPECT : preset.w / preset.h;
    const savedLayout = board!.collageDeviceLayouts?.[v]?.[template];
    // 화면에 보이는 배치 그대로 — 배경화면 내보내기와 공유
    const currentLayout = resolveLayout(template, keyedItems, savedLayout, aspect);
    return { preset, aspect, savedLayout, currentLayout };
  }

  function selectTemplate(id: CollageTemplate) {
    saveCollageTemplate(id);
    setBoard(loadBoard());
  }

  function selectBgColor(hex: string) {
    saveCollageBgColor(hex);
    setBoard(loadBoard());
  }

  /** 타이틀 모양 (v11) — 배경색과 같은 전역 축이라 같은 패턴으로 잇는다 */
  function changeTitleGlobal(patch: NonNullable<BoardData['collageTitle']>) {
    saveCollageTitle(patch);
    setBoard(loadBoard());
  }

  function handleLayoutChange(v: CollageView, l: CollageLayout, aspect: number) {
    saveCollageDeviceLayout(v, template, { ...l, aspect });
    setBoard(loadBoard());
  }

  function handleYearChange(y: string) {
    saveTargetDate(withYear(getTargetDate(loadBoard()), y));
    setBoard(loadBoard());
  }

  // 탭 전환 — reseed 확인·경고는 접고, URL을 ?view=로 동기화 (분석 구분용)
  function switchView(v: CollageView) {
    setView(v);
    setConfirmReseed(null);
    setSaveWarnView(null);
    setReplaceTarget(null);
    history.replaceState(null, '', `${window.location.pathname}?view=${v}`);
    track('collage_view', { view: v }); // Pro 플랜에서만 수집 — Hobby에선 무해한 no-op
  }

  // 사이즈 선택 — 비율이 거의 같으면 배치 유지, 다르면 리시드 확인
  function handleSelectPreset(v: CollageView, preset: WallpaperPreset) {
    if (!board) return;
    const { preset: current } = forView(v);
    const hasLayouts = Object.keys(board.collageDeviceLayouts?.[v] ?? {}).length > 0;
    const newAspect = preset.w / preset.h;
    if (current && hasLayouts && !aspectsEqual(current.w / current.h, newAspect)) {
      setConfirmReseed({ view: v, preset });
      return;
    }
    saveCollageDevicePreset(v, preset.id);
    setBoard(loadBoard());
    setConfirmReseed(null);
  }

  function applyReseed() {
    if (!confirmReseed) return;
    clearCollageDeviceLayouts(confirmReseed.view);
    saveCollageDevicePreset(confirmReseed.view, confirmReseed.preset.id);
    setBoard(loadBoard());
    setConfirmReseed(null);
  }

  // 사진 키 `${sectionId}-${slotIdx}` 파싱 — CollageBoard 배지와 같은 키 계약
  function parsePhotoKey(key: string): { sectionId: SectionId; slot: number } | null {
    const m = /^(\d+)-(\d+)$/.exec(key);
    if (!m) return null;
    return { sectionId: Number(m[1]) as SectionId, slot: Number(m[2]) };
  }

  // 깨진 사진을 내 저장소로 수입한다 (v8.7) — 남의 호스트 URL이 원인일 때의 진짜 해결.
  // 성공한 슬롯은 data URL이 되어 CORS·핫링크·만료와 무관해진다.
  async function handleImportBroken() {
    if (importingBroken) return;
    setImportingBroken(true);
    setImportBrokenNotice('');
    try {
      const slots = findRemoteSlots(brokenKeys);
      if (slots.length === 0) {
        setImportBrokenNotice('이 사진들은 다시 가져올 수 없어. 다른 사진으로 바꿔줄래?');
        return;
      }
      const result = await normalizeSlots(slots);
      if (result.converted > 0) {
        setBrokenKeys([]);
        setBoard(loadBoard());
      }
      if (result.quotaHit) {
        setImportBrokenNotice(`${result.converted}장까지 가져왔어. 저장 공간이 부족해 나머지는 사진을 몇 장 지운 뒤 다시 해줘.`);
      } else if (result.expired.length > 0) {
        setImportBrokenNotice('일부 사진은 만료돼서 다시 가져올 수 없어. 다른 사진으로 바꿔줄래?');
      } else if (result.converted === 0) {
        setImportBrokenNotice('사진을 가져오지 못했어. 잠시 후 다시 시도해줘.');
      } else {
        setSaveWarnView(null);
      }
    } finally {
      setImportingBroken(false);
    }
  }

  function handleRemovePhoto(key: string) {
    const parsed = parsePhotoKey(key);
    if (!parsed) return;
    removeSlotImage(parsed.sectionId, parsed.slot);
    if (replaceTarget?.key === key) setReplaceTarget(null);
    setBoard(loadBoard());
  }

  function openReplace(v: CollageView, key: string) {
    setReplaceTarget({ view: v, key });
    setReplaceUrl('');
    setReplaceNotice('');
  }

  // 같은 key(슬롯)에 새 사진 저장 — 배치·z·회전은 key 기준이라 그대로 유지된다.
  // 업로드 슬롯이 우선 소스라 여기 쓰면 생성 이미지가 있던 슬롯도 이 사진으로 교체된다
  function applyReplacement(src: string, dims?: { w: number; h: number }): boolean {
    if (!replaceTarget) return false;
    const parsed = parsePhotoKey(replaceTarget.key);
    if (!parsed) return false;
    if (
      !saveUploadedImage(
        parsed.sectionId,
        parsed.slot,
        src,
        undefined,
        // 교체하며 잰 치수 (v10). 못 쟀으면 null로 지워 백필이 새로 재게 한다 —
        // 옛 사진의 치수가 남아 있으면 새 사진을 엉뚱한 비율로 배치한다
        dims ? { ...dims, f: fingerprint(src) } : null
      )
    ) {
      setReplaceNotice('저장 공간이 부족해 담지 못했어. 사진을 지우고 다시 시도해줘.');
      return false;
    }
    setBoard(loadBoard());
    setReplaceTarget(null);
    setReplaceUrl('');
    setReplaceNotice('');
    return true;
  }

  async function handleReplaceUrl() {
    const url = replaceUrl.trim();
    if (!url || replaceChecking) return;
    // /scenes URL 게이트와 같은 규칙 — 핀 차단·로드 검증·내 저장소 복사를 importRemoteImage가 일괄 (v8.7)
    setReplaceChecking(true);
    setReplaceNotice('');
    const imported = await importRemoteImage(url);
    setReplaceChecking(false);
    if (!imported.ok) {
      setReplaceNotice(IMPORT_NOTICES[imported.reason]);
      return;
    }
    applyReplacement(imported.dataUrl, imported.dims);
  }

  async function handleReplaceFile(file: File) {
    setReplaceNotice('');
    try {
      const raw = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error('read-failed'));
        reader.readAsDataURL(file);
      });
      const compressed = await compressImageWithDims(raw, 0.60, 800);
      // 브라우저가 디코드 못 한 포맷(HEIC 등)은 JPEG 재인코딩에 실패한다 — 깨진 썸네일 방지 (v7.4 감사 M5)
      if (!compressed.dataUrl.startsWith('data:image/jpeg')) {
        setReplaceNotice('이 사진은 형식을 지원하지 않아. JPG나 PNG로 다시 올려줄래?');
        return;
      }
      applyReplacement(
        compressed.dataUrl,
        compressed.w > 0 ? { w: compressed.w, h: compressed.h } : undefined
      );
    } catch {
      setReplaceNotice('사진을 읽지 못했어. 다른 사진으로 다시 시도해줘.');
    }
  }

  function handleOpenSheet(v: CollageView) {
    // 깨진 사진이 있으면 한 번 경고 — 저장을 막지는 않는다 (v8.1)
    if (brokenKeys.length > 0 && saveWarnView !== v) {
      setSaveWarnView(v);
      return;
    }
    setSaveWarnView(null);
    setSheetView(v);
  }

  const templateSelector = (
    // mb-2 (v8.7) — 바로 아래 기기 사이즈 칩과 한 덩어리로 읽히게(템플릿 → 기기 순서)
    <div className="flex gap-1.5 mb-2 lg:mb-1 bg-[#F5F5F3] rounded-xl p-1" role="radiogroup" aria-label="콜라주 템플릿">
      {TEMPLATES.map((t) => (
        <button
          key={t.id}
          role="radio"
          aria-checked={template === t.id}
          onClick={() => selectTemplate(t.id)}
          className={`flex-1 py-1.5 rounded-lg transition-colors duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] flex flex-col items-center justify-center ${
            template === t.id ? 'bg-white text-[#1C1B19] shadow-sm' : 'text-[#6E6962]'
          }`}
        >
          <span className="flex items-center gap-1.5 text-caption font-semibold">
            <TemplateSwatch id={t.id} />
            {t.label}
          </span>
          {/* 이름만으로는 뭐가 다른지 모른다 — 한 줄 설명이 곧 선택 기준이다 (v10).
              lg에서는 숨긴다: PC 세로 예산이 빠듯해 이 한 줄이 무스크롤 계약을 깨뜨린다.
              PC는 스와치가 배치·타이틀 위치를 그림으로 이미 보여준다
              aria-hidden: 라디오 이름은 라벨 하나로 읽혀야 스크린리더가 장황해지지 않는다 */}
          <span className="lg:hidden text-micro text-[#8A8784] leading-none mt-0.5" aria-hidden="true">
            {TEMPLATE_HINTS[t.id]}
          </span>
        </button>
      ))}
    </div>
  );

  // 배경색 팔레트 (v9.0) — 세 템플릿 공통.
  // 배경색은 어느 한 템플릿의 특권이 아니라 세 템플릿을 가로지르는 축이다.
  const bgPalette = (
    <div className="mb-2 lg:mb-1">
      <div
        className="flex gap-2 overflow-x-auto scroll-soft lg:flex-wrap lg:overflow-visible pb-0.5"
        role="radiogroup"
        aria-label="보드 배경색"
      >
        {BG_PALETTE.map((s) => {
          const on = bgColor.toUpperCase() === s.hex.toUpperCase();
          return (
            <button
              key={s.id}
              role="radio"
              aria-checked={on}
              aria-label={s.label}
              onClick={() => selectBgColor(s.hex)}
              className={`flex-shrink-0 flex items-center gap-1.5 rounded-full border pl-1 pr-2.5 py-1 transition-colors ${
                on ? 'border-[#1C1B19] bg-white' : 'border-[#E5E3DF] bg-[#F5F5F3]'
              }`}
            >
              <span
                aria-hidden="true"
                className="w-5 h-5 rounded-full border border-black/10 flex items-center justify-center"
                style={{ backgroundColor: s.hex }}
              >
                {on && (
                  <span
                    className="text-[10px] leading-none font-bold"
                    style={{ color: titleInkFor(s.hex).title }}
                  >
                    ✓
                  </span>
                )}
              </span>
              <span className={`text-micro font-medium ${on ? 'text-[#1C1B19]' : 'text-[#6E6962]'}`}>
                {s.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  // 기기 사이즈 칩 (v8.7) — 템플릿 탭 바로 아래 전폭. 구 v8.2는 폰 뷰 lg+에서 이걸 보드 우측
  // 20rem 레일에 넣었는데, 칩 7개가 그 폭에 안 들어가 화면 밖으로 잘렸다. "모자이크·숲·미니멀
  // 다음에 기기를 고른다"는 실제 순서와도 어긋났다. 레일은 폐지 — 칩이 빠지면 상주 콘텐츠가
  // 없어 평소엔 빈 칸이 보드를 왼쪽으로 밀 뿐이었다.
  function renderDevicePicker(v: CollageView) {
    const { preset } = forView(v);
    return (
      <div className="mb-3 lg:mb-1">
        <DevicePresetPicker
          groups={v === 'phone' ? ['휴대폰', '태블릿'] : ['PC']}
          selectedId={preset?.id}
          onSelect={(p) => handleSelectPreset(v, p)}
        />
        {confirmReseed && confirmReseed.view === v && (
          <div className="mt-2 rounded-xl bg-[#FEF9C3] px-4 py-3 animate-fadeIn">
            <p className="text-caption text-[#92400E] mb-2">
              비율이 달라져서 배치를 새로 짜야 해. 지금까지 꾸민 배치는 사라져. 계속할까?
            </p>
            <div className="flex gap-3">
              <button onClick={applyReseed} className="text-caption font-semibold text-[#92400E]">
                계속
              </button>
              <button onClick={() => setConfirmReseed(null)} className="text-caption text-[#6E6962]">
                취소
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 뷰 하나의 보드 패널 — 보드가 주인공, 그 아래 일시적 컨트롤(교체 패널·경고)
  function renderViewPanel(v: CollageView) {
    const { preset, aspect, savedLayout } = forView(v);
    const replaceSection =
      replaceTarget?.view === v ? getSection(parsePhotoKey(replaceTarget.key)?.sectionId ?? (1 as SectionId)) : null;
    return (
      <div>
        {/* 스테이지 — lg+는 은은한 프레임 위 중앙 배치 (v8.2).
            세로 보드는 lg에서 프레임을 보드 폭에 맞춰 좁힌다 (v8.7) — 전폭 회색 판 위에 작은
            보드가 떠 있으면 빈 공간이 실수처럼 보인다. 구 레일이 쓰던 자리이기도 하다 */}
        {preset && (
          <div
            // lg:py-3 → lg:py-1 (v10): 타이틀 밴드 예약이 사라져 보드 자체가 커진 만큼
            // 크롬을 깎아야 PC 무스크롤(V87-4d)과 보드 폭 ≥1000(V87-4e)이 함께 산다
            className={`mt-1 lg:mt-0 lg:bg-[#F5F5F3] lg:rounded-3xl lg:px-2 lg:py-1 ${
              v === 'phone' ? 'lg:max-w-md lg:mx-auto' : ''
            }`}
          >
            <CollageBoard
              key={`${v}-${preset.id}-${template}`}
              view={v}
              template={template}
              bgColor={bgColor}
              titleGlobal={board?.collageTitle}
              onTitleGlobalChange={changeTitleGlobal}
              items={keyedItems}
              layout={savedLayout}
              aspect={preset.w / preset.h}
              onLayoutChange={(l) => handleLayoutChange(v, l, aspect)}
              year={boardYear}
              onYearChange={handleYearChange}
              onRequestReplace={(key) => openReplace(v, key)}
              onRequestRemove={handleRemovePhoto}
              onBrokenChange={setBrokenKeys}
            />
            {/* lg에선 선택한 칩이 해상도를 이미 보여준다 — 세로 예산을 보드에 양보 (v8.7) */}
            <p className="text-micro text-[#6E6962] text-center mt-2 lg:hidden">
              {v === 'phone'
                ? '선택한 폰 화면 비율 그대로야. 배치를 다듬고 저장해봐.'
                : '선택한 PC 화면 비율 그대로야. 배치를 다듬고 저장해봐.'}
            </p>
          </div>
        )}
        {/* 하단 컨트롤 — 사진 교체 패널·깨진 사진 경고 */}
        {preset && (
          <div className="max-w-md mx-auto">
            {replaceTarget && replaceTarget.view === v && (
              <div className="mt-3 rounded-2xl border border-[#E5E3DF] bg-white px-4 py-3 animate-fadeIn">
                <p className="text-caption font-semibold text-[#1C1B19] mb-0.5">
                  {replaceSection ? `${replaceSection.shortTitle ?? replaceSection.title.split(' — ')[0]} 사진 바꾸기` : '사진 바꾸기'}
                </p>
                <p className="text-caption text-[#6E6962] mb-2.5">
                  이 자리에 넣을 사진을 골라줘. 링크를 붙여넣거나 내 사진을 올려도 돼.
                </p>
                <button
                  onClick={() => replaceFileRef.current?.click()}
                  className="w-full py-2.5 rounded-xl text-caption font-semibold text-white active:opacity-80"
                  style={{ backgroundColor: replaceSection?.color ?? '#1C1B19' }}
                >
                  📷 내 사진 올리기
                </button>
                <input
                  ref={replaceFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleReplaceFile(file);
                    e.target.value = '';
                  }}
                />
                <div className="flex gap-2 mt-2">
                  <input
                    type="url"
                    value={replaceUrl}
                    onChange={(e) => setReplaceUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleReplaceUrl(); }}
                    placeholder="이미지 URL 주소 붙여넣기"
                    className="flex-1 text-caption px-3 py-2.5 rounded-xl border border-[#E5E3DF] bg-white outline-none focus:border-[#9CA3AF] placeholder:text-[#C9C5BE]"
                  />
                  <button
                    onClick={handleReplaceUrl}
                    disabled={!replaceUrl.trim() || replaceChecking}
                    className="px-3 py-2.5 rounded-xl text-caption font-medium text-white bg-[#1C1B19] disabled:opacity-40 transition-opacity"
                  >
                    {replaceChecking ? '사진 확인 중…' : '불러오기'}
                  </button>
                </div>
                {replaceNotice && <p className="text-micro text-[#B45309] mt-1.5">{replaceNotice}</p>}
                <button
                  onClick={() => setReplaceTarget(null)}
                  className="text-caption text-[#6E6962] underline mt-2 active:opacity-70"
                >
                  그대로 둘래
                </button>
              </div>
            )}
            {saveWarnView === v && brokenKeys.length > 0 && (
              <div className="mt-3 rounded-xl bg-[#FEF9C3] px-4 py-3 animate-fadeIn">
                <p className="text-caption text-[#92400E] mb-2">
                  몇 장은 못 불러와서 배경화면엔 안 들어가. ⚠️ 사진을 바꾸거나 지우고 저장해봐.
                </p>
                <div className="flex gap-4">
                  {/* 남의 호스트에 있는 사진이 원인일 때의 진짜 해결 — 내 저장소로 복사 (v8.7) */}
                  <button
                    onClick={() => void handleImportBroken()}
                    disabled={importingBroken}
                    className="text-caption font-semibold text-[#92400E] disabled:opacity-40"
                  >
                    {importingBroken ? '가져오는 중...' : '내 보드로 가져오기'}
                  </button>
                  <button
                    onClick={() => { setSaveWarnView(null); setSheetView(v); }}
                    className="text-caption font-semibold text-[#92400E]"
                  >
                    그래도 저장할래
                  </button>
                </div>
                {importBrokenNotice && (
                  <p className="text-caption text-[#92400E] mt-2">{importBrokenNotice}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  const sheetData = sheetView ? forView(sheetView) : null;

  return (
    // lg:pb-4 (v8.7) — 데스크톱 세로 예산 다이어트. sticky 저장 바 아래 여백은 크롬일 뿐이다
    <main className="min-h-screen flex flex-col max-w-md md:max-w-3xl lg:max-w-6xl mx-auto w-full pb-10 lg:pb-1">
      {/* 헤더 — 상위는 대시보드 하나 (v7.2 한 화면 통합).
          v8.7: flex-wrap 한 컨테이너로 통합 — 좁은 화면은 [← 제목 … 도토리] / [뷰 탭] 2줄,
          lg+는 한 줄([← 제목 … 뷰 탭 도토리])로 접어 세로 한 행(≈52px)을 보드에 돌려준다.
          ⚠️ 계정 버튼·뷰 탭은 각각 DOM에 하나뿐이어야 한다(중복 렌더는 aria 이름 strict 매칭을 깬다) */}
      <div className="px-6 pt-4 pb-3 lg:pt-1 lg:pb-1 flex flex-wrap items-center gap-x-3 gap-y-3 lg:flex-nowrap lg:gap-x-6">
        <button
          onClick={() => router.push('/dashboard')}
          aria-label="대시보드로 돌아가기"
          className="p-2 -ml-2 text-[#6B7280] active:opacity-60"
        >
          ←
        </button>
        <h1 className="text-title font-bold">내 비전보드</h1>
        {/* 계정 진입점 (v7.9 P-1) — 대시보드 밖에서도 로그인·로그아웃 접근 */}
        <div className="ml-auto lg:ml-0 lg:order-2">
          <AccountButton />
        </div>
        {/* 뷰 토글 — 전 뷰포트 공통 2탭. 보드가 전폭을 쓰도록 한 번에 한 뷰만 렌더 (v8.2) */}
        <div
          className="w-full lg:w-64 lg:ml-auto lg:order-1 flex gap-1.5 bg-[#F5F5F3] rounded-xl p-1 max-w-md"
          role="radiogroup"
          aria-label="보기 방식"
        >
          {([
            { id: 'phone' as const, label: '📱 폰' },
            { id: 'desktop' as const, label: '🖥️ PC' },
          ]).map((v) => (
            <button
              key={v.id}
              role="radio"
              aria-checked={view === v.id}
              onClick={() => switchView(v.id)}
              className={`flex-1 py-2 rounded-lg text-caption font-semibold transition-colors ${
                view === v.id ? 'bg-white text-[#1C1B19] shadow-sm' : 'text-[#6E6962]'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* --board-reserve (v8.7) — 보드 높이 예산의 소유자를 공용 래퍼로 올렸다(CSS 변수는 상속).
          칩이 뷰 패널 밖으로 나오면서 예산의 주인도 바깥이어야 맞다. PC 뷰가 더 큰 이유:
          16:9 보드는 폭 바운드라 예산을 키워야 헤더+탭+칩+저장 바가 한 화면에 들어온다.
          ⚠️ Tailwind JIT 스캔을 위해 완성된 클래스 리터럴을 삼항으로 고를 것(문자열 조립 금지).
          ⚠️ 이 수치의 진실 원천은 verify-v87r1 V87-4d(무스크롤)·V87-4e(보드 폭 ≥1000px)다.
          두 계약은 서로 반대 방향이라 눈대중으로 정하면 안 되고 테스트로 역산해야 한다.
          v9.0에서 배경색 팔레트 행과 보드 위 가이드 알약이 추가돼 PC 예산을 17→20rem으로 올렸다.
          v10에서 타이틀 밴드 예약(상단 15~22%)이 사라져 보드가 커진 만큼 세로가 모자라졌다.
          예산을 크게 올리면 보드 폭이 1000 밑으로 떨어지므로, 먼저 크롬을 깎고(헤더·CTA·저장 바·
          패널 패딩 lg 축소, 가이드 알약을 보드 안으로) 남은 7px만 예산으로 흡수했다 —
          20 → 20.5rem, 900px 뷰포트에서 보드 폭 약 1017px로 V87-4e를 여전히 만족한다. */}
      <div
        className={`px-4 md:px-6 animate-fadeIn ${
          view === 'desktop'
            ? '[--board-reserve:13rem] lg:[--board-reserve:20.5rem]'
            : '[--board-reserve:13rem] lg:[--board-reserve:10rem]'
        }`}
      >
        {collageImages.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-body text-[#6E6962]">
              아직 담긴 사진이 없어.
              <br />
              사진을 1장 이상 담으면 여기서 볼 수 있어.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-6 px-6 py-3 rounded-2xl text-body font-semibold text-white bg-[#1C1B19] active:opacity-80"
            >
              사진 담으러 가기 →
            </button>
          </div>
        ) : (
          <>
            {/* v10 전환 안내 — 배치가 조용히 바뀌면 "내 보드가 망가졌다"로 읽힌다 */}
            {showV10Notice && (
              <div className="mb-2 rounded-xl bg-[#FEF9C3] px-4 py-3 animate-fadeIn">
                <p className="text-caption text-[#92400E]">
                  보드 만드는 방식이 새로워졌어 — 이제 세로 사진도 안 잘려. 배치는 새로 깔렸고, 사진이랑 색은 그대로야.
                </p>
                <button
                  onClick={() => setShowV10Notice(false)}
                  className="text-caption font-semibold text-[#92400E] underline mt-1.5 active:opacity-70"
                >
                  알겠어
                </button>
              </div>
            )}
            {/* 템플릿 → 배경색 → 기기 사이즈 순 (v9.0). 뷰 공통 단일 값이라 셀렉터는 각각 하나 */}
            {templateSelector}
            {bgPalette}
            {renderDevicePicker(view)}
            {renderViewPanel(view)}
          </>
        )}

        {/* 하단 동선 — v9.0: '📖 미래 일기 읽기' 링크 삭제. 보드를 꾸미는 맥락에 읽기 동선이
            섞여 있을 이유가 없다는 오너 피드백. 일기 진입점은 대시보드(app/dashboard/page.tsx)에
            그대로 있고 /diary가 읽기의 단일 홈이다. 여기 남는 건 완성 CTA뿐 */}
        {collageImages.length > 0 && !board.futureDayStory && completedCount >= FIRST_BOARD_THRESHOLD ? (
          // 첫 보드 조기 개방 (v7.8) — 임계값부터 최종 스토리로 초대. 6/6 라벨은 불변(v75r1 계약)
          <div className="mt-8 lg:mt-3 space-y-2 lg:space-y-1">
            {/* lg에서 세로를 아낀다 (v10) — PC 무스크롤(V87-4d)과 보드 폭 ≥1000px(V87-4e)이
                반대 방향이라, 예산을 늘리는 대신 크롬을 깎아야 둘 다 산다. 임계는 테스트로 역산했다 */}
            <button
              onClick={() => router.push('/finish')}
              className="w-full bg-[#1C1B19] text-white py-4 lg:py-2 rounded-2xl text-heading font-semibold active:opacity-80 transition-opacity"
            >
              {completedCount === 6 ? '내 비전보드 완성하기 🐿️' : '첫 보드 완성하기 🐿️'}
            </button>
            <p className="text-micro text-[#6E6962] text-center">
              {completedCount === 6
                ? '완성하면 미래의 하루 이야기를 써줄게.'
                : '지금 자란 나무들로 첫 이야기를 써줄게. 보드가 자라면 다시 쓸 수도 있어.'}
            </p>
          </div>
        ) : null}
      </div>

      {/* 저장 — sticky 하단 바 (v8.2): 보드가 화면보다 길어도 저장 버튼은 항상 손닿는 곳에.
          z-40 — 시트(z-50)·코치마크(z-[60]) 아래 */}
      {collageImages.length > 0 && forView(view).preset && (
        <div className="sticky bottom-0 z-40 px-4 md:px-6 pt-6 pb-4 lg:pt-2 lg:pb-1.5 bg-gradient-to-t from-[#FAF9F7] via-[#FAF9F7]/85 to-[#FAF9F7]/0 pointer-events-none">
          <button
            onClick={() => handleOpenSheet(view)}
            className="pointer-events-auto block w-full max-w-md mx-auto py-3.5 lg:py-3 rounded-2xl text-heading font-semibold text-white bg-[#1C1B19] active:opacity-80 transition-opacity shadow-[0_8px_24px_rgba(28,27,25,0.22)]"
          >
            {view === 'phone' ? '폰 배경화면 저장' : 'PC 배경화면 저장'}
          </button>
        </div>
      )}

      {/* 첫 진입 코치마크 — 1회 안내 (v6.17 발견성 피드백, v7.2: 딥링크 직행 시에도 노출) */}
      {showCoach && collageImages.length > 0 && (
        <div
          className="fixed inset-0 z-[60] bg-black/55 flex items-center justify-center px-6 animate-fadeIn"
          role="dialog"
          aria-label="콜라주 편집 안내"
          onClick={dismissCoach}
        >
          <div
            className="w-full max-w-sm bg-white rounded-3xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* v7.7: 정원사 토리가 안내하는 발화자 구도 — 아바타가 🐿️ 이모지를 대체 */}
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/tori-profile-bust.png"
                alt=""
                aria-hidden="true"
                className="w-12 h-12 rounded-full object-cover shadow-md flex-shrink-0"
              />
              <div>
                <p className="text-caption font-semibold text-[#78716C]">정원사 토리</p>
                <p className="text-title font-bold text-[#1C1B19]">이 보드, 직접 꾸밀 수 있어</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-xl bg-[#F5F5F3] flex items-center justify-center flex-shrink-0 text-body" aria-hidden="true">✋</span>
                <p className="text-body text-[#1C1B19] leading-snug">
                  보드를 탭하면 <span className="font-semibold">사진을 끌어 옮기고, 크기를 바꾸고, 문구도 더할 수 있어.</span>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-xl bg-[#F5F5F3] flex items-center justify-center flex-shrink-0 text-body" aria-hidden="true">🔄</span>
                <p className="text-body text-[#1C1B19] leading-snug">
                  {/* v8.1: 편집 모드 교체·삭제 — 사진 단위 재조치 동선 안내 */}
                  편집 중에 <span className="font-semibold">사진을 탭하면 바꾸거나 지울 수 있어.</span> 색 테두리가 사진의 출처 칸이야.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-xl bg-[#F5F5F3] flex items-center justify-center flex-shrink-0 text-body" aria-hidden="true">📱</span>
                <p className="text-body text-[#1C1B19] leading-snug">
                  폰·PC <span className="font-semibold">기기 사이즈를 고르면, 그 비율 그대로</span> 꾸며서 저장할 수 있어.
                </p>
              </div>
            </div>
            <button
              onClick={dismissCoach}
              className="w-full py-3 rounded-2xl text-heading font-semibold text-white bg-[#1C1B19] active:opacity-80"
            >
              알겠어!
            </button>
          </div>
        </div>
      )}

      {sheetView && sheetData?.preset && (
        <WallpaperSheet
          year={boardYear}
          preset={sheetData.preset}
          board={{
            template,
            layout: sheetData.currentLayout,
            items: keyedItems,
            bgColor,
            title: board.collageTitle,
          }}
          onClose={() => setSheetView(null)}
          // 시트에서 사진을 수입하면 보드도 갱신 — 배치는 key 기준이라 그대로 유지된다 (v8.7)
          onPhotosNormalized={() => {
            setBrokenKeys([]);
            setBoard(loadBoard());
          }}
        />
      )}
    </main>
  );
}
