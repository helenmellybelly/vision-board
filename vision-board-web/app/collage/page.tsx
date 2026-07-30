'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { track } from '@/lib/analytics';
import AccountButton from '@/components/AccountButton';
import {
  clearCollageDeviceLayouts,
  loadBoard,
  saveTargetDate,
  saveCollageDeviceLayout,
  saveCollageDevicePreset,
  saveCollageTemplate,
  saveFutureDayStory,
  saveUploadedImage,
} from '@/lib/storage';
import { getTargetDate, getTargetYear, withYear } from '@/lib/targetDate';
import { SECTIONS, getSection } from '@/lib/questions';
import { BoardData, CollageLayout, CollageTemplate, SectionId } from '@/lib/types';
import { ASPECT, CollageItem, DEFAULT_TEMPLATE, TEMPLATE_ORDER, aspectsEqual, resolveLayout } from '@/lib/collageTemplates';
import { WALLPAPER_PRESETS, WallpaperPreset, loadOne } from '@/lib/wallpaper';
import { compressImage } from '@/lib/imageUtils';
import { removeSlotImage } from '@/lib/photoSlots';
import { FIRST_BOARD_THRESHOLD, isStoryStale } from '@/lib/milestone';
import StoryModal from '@/components/StoryModal';
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

// id 'polaroid'는 localStorage 키 계약이라 유지 — v7.6에서 UI 라벨만 '숲'으로.
// v8.0 — 순서·기본값은 lib/collageTemplates.ts의 TEMPLATE_ORDER/DEFAULT_TEMPLATE 단일 소스
const TEMPLATE_LABELS: Record<CollageTemplate, string> = {
  polaroid: '숲',
  mosaic: '모자이크',
  minimal: '미니멀',
};
const TEMPLATES: { id: CollageTemplate; label: string }[] = TEMPLATE_ORDER.map((id) => ({
  id,
  label: TEMPLATE_LABELS[id],
}));

// 첫 진입 코치마크 1회 노출 여부 — BoardData 스키마와 분리해 별도 키로 관리
const COACH_KEY = 'vb-collage-coach-v1';

// 템플릿 탭 미니 스와치 — 글자만으로는 모드 차이가 안 보인다는 피드백(v6.17)
function TemplateSwatch({ id }: { id: CollageTemplate }) {
  if (id === 'polaroid') {
    return (
      <span className="inline-block w-4 h-4 rounded-[3px] bg-[#1F2E22] relative flex-shrink-0" aria-hidden="true">
        <span className="absolute left-[3px] top-[3px] w-2 h-2 bg-white/90 rounded-[2px] rotate-[-8deg]" />
      </span>
    );
  }
  if (id === 'mosaic') {
    return (
      <span className="inline-grid w-4 h-4 grid-cols-2 gap-[2px] flex-shrink-0" aria-hidden="true">
        <span className="rounded-[2px] bg-[#C4C2BE]" />
        <span className="rounded-[2px] bg-[#8A8784]" />
        <span className="rounded-[2px] bg-[#8A8784]" />
        <span className="rounded-[2px] bg-[#C4C2BE]" />
      </span>
    );
  }
  return (
    <span className="inline-block w-4 h-4 rounded-[3px] bg-white border border-[#C4C2BE] relative flex-shrink-0" aria-hidden="true">
      <span className="absolute left-[3px] top-[3px] right-[3px] bottom-[3px] grid grid-cols-2 gap-[1.5px]">
        <span className="bg-[#E5E3DF] rounded-[1px]" />
        <span className="bg-[#E5E3DF] rounded-[1px]" />
        <span className="bg-[#E5E3DF] rounded-[1px]" />
        <span className="bg-[#E5E3DF] rounded-[1px]" />
      </span>
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
  // 사진 교체 인라인 패널 대상 — key는 `${sectionId}-${slotIdx}` (v8.1)
  const [replaceTarget, setReplaceTarget] = useState<{ view: CollageView; key: string } | null>(null);
  const [replaceUrl, setReplaceUrl] = useState('');
  const [replaceChecking, setReplaceChecking] = useState(false);
  const [replaceNotice, setReplaceNotice] = useState('');
  const replaceFileRef = useRef<HTMLInputElement>(null);
  // 로드 실패 사진 키 — 저장 전 경고 배너의 재료 (v8.1)
  const [brokenKeys, setBrokenKeys] = useState<string[]>([]);
  const [saveWarnView, setSaveWarnView] = useState<CollageView | null>(null);

  useEffect(() => {
    const b = loadBoard();
    // 온보딩 전 딥링크 진입 시 온보딩으로 (v7.4 감사 M3)
    if (!b.onboardingDone) {
      router.replace('/onboarding');
      return;
    }
    setBoard(b);
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

  // 보드 배치용 — 섹션·슬롯 키와 함께 (사진 교체·삭제에도 배치가 안정적)
  const keyedItems: CollageItem[] = SECTIONS.flatMap((section) => {
    const sec = board.sections[section.id];
    const uploaded = sec.uploadedImages ?? [];
    const generated = sec.generatedImages ?? [];
    return [0, 1, 2]
      .map((i) => ({ key: `${section.id}-${i}`, src: uploaded[i] || generated[i] || '' }))
      .filter((item) => !!item.src);
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
  function applyReplacement(src: string): boolean {
    if (!replaceTarget) return false;
    const parsed = parsePhotoKey(replaceTarget.key);
    if (!parsed) return false;
    if (!saveUploadedImage(parsed.sectionId, parsed.slot, src)) {
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
    // /scenes URL 게이트와 같은 규칙 (v8.1 T3) — 핀 페이지 주소 차단 + 실로드 프로브
    if (/\/pin\//.test(url)) {
      setReplaceNotice("그건 핀 페이지 주소야. 사진을 꾹 눌러서(PC는 우클릭) '이미지 주소 복사'로 가져와줘.");
      return;
    }
    setReplaceChecking(true);
    setReplaceNotice('');
    try {
      await loadOne(url);
    } catch {
      setReplaceNotice('이 주소에선 사진을 못 불러왔어. 이미지 자체 주소(…jpg 같은)를 붙여넣어줘.');
      setReplaceChecking(false);
      return;
    }
    setReplaceChecking(false);
    applyReplacement(url);
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
      const compressed = await compressImage(raw, 0.60, 800);
      // 브라우저가 디코드 못 한 포맷(HEIC 등)은 JPEG 재인코딩에 실패한다 — 깨진 썸네일 방지 (v7.4 감사 M5)
      if (!compressed.startsWith('data:image/jpeg')) {
        setReplaceNotice('이 사진은 형식을 지원하지 않아. JPG나 PNG로 다시 올려줄래?');
        return;
      }
      applyReplacement(compressed);
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
    <div className="flex gap-1.5 mb-4 bg-[#F5F5F3] rounded-xl p-1" role="radiogroup" aria-label="콜라주 템플릿">
      {TEMPLATES.map((t) => (
        <button
          key={t.id}
          role="radio"
          aria-checked={template === t.id}
          onClick={() => selectTemplate(t.id)}
          className={`flex-1 py-2 rounded-lg text-caption font-semibold transition-colors flex items-center justify-center gap-1.5 ${
            template === t.id ? 'bg-white text-[#1C1B19] shadow-sm' : 'text-[#6E6962]'
          }`}
        >
          <TemplateSwatch id={t.id} />
          {t.label}
        </button>
      ))}
    </div>
  );

  // 뷰 하나의 전체 패널 (v8.2) — 좁은 화면은 세로 스택, 폰 뷰 lg+는 좌 스테이지·우 컨트롤 레일.
  // 세로형 보드는 lg에서 좌우가 비기 마련이라, 남는 폭을 컨트롤 레일로 쓰고 보드는 은은한 스테이지 위에 올린다.
  function renderViewPanel(v: CollageView) {
    const { preset, aspect, savedLayout } = forView(v);
    const rail = v === 'phone';
    const replaceSection =
      replaceTarget?.view === v ? getSection(parsePhotoKey(replaceTarget.key)?.sectionId ?? (1 as SectionId)) : null;
    return (
      <div
        className={`[--board-reserve:13rem] lg:[--board-reserve:10rem] ${
          rail ? 'lg:grid lg:grid-cols-[1fr_20rem] lg:gap-8 lg:items-start' : ''
        }`}
      >
        {/* 상단 컨트롤 — 사이즈 칩 + 리시드 확인 */}
        <div className={rail ? 'lg:col-start-2 lg:row-start-1' : undefined}>
        <DevicePresetPicker
          groups={v === 'phone' ? ['휴대폰', '태블릿'] : ['PC']}
          selectedId={preset?.id}
          onSelect={(p) => handleSelectPreset(v, p)}
        />
        {confirmReseed && confirmReseed.view === v && (
          <div className="mb-4 rounded-xl bg-[#FEF9C3] px-4 py-3 animate-fadeIn">
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
        {/* 스테이지 — 보드가 주인공. 폰 뷰 lg+는 은은한 프레임 위 중앙 배치 (v8.2) */}
        {preset && (
          <div className={rail ? 'mt-1 lg:mt-0 lg:col-start-1 lg:row-start-1 lg:row-span-2 lg:bg-[#F5F5F3] lg:rounded-3xl lg:p-4' : 'mt-1'}>
            <CollageBoard
              key={`${v}-${preset.id}-${template}`}
              view={v}
              template={template}
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
            <p className="text-micro text-[#6E6962] text-center mt-2">
              {v === 'phone'
                ? '선택한 폰 화면 비율 그대로야. 배치를 다듬고 저장해봐.'
                : '선택한 PC 화면 비율 그대로야. 배치를 다듬고 저장해봐.'}
            </p>
          </div>
        )}
        {/* 하단 컨트롤 — 사진 교체 패널·깨진 사진 경고 (레일에선 우측 아래 칸) */}
        {preset && (
          <div className={rail ? 'lg:col-start-2 lg:row-start-2' : undefined}>
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
                <button
                  onClick={() => { setSaveWarnView(null); setSheetView(v); }}
                  className="text-caption font-semibold text-[#92400E]"
                >
                  그래도 저장할래
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  const sheetData = sheetView ? forView(sheetView) : null;

  return (
    <main className="min-h-screen flex flex-col max-w-md md:max-w-3xl lg:max-w-6xl mx-auto w-full pb-10">
      {/* 헤더 — 상위는 대시보드 하나 (v7.2 한 화면 통합) */}
      <div className="px-6 pt-4 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => router.push('/dashboard')}
            aria-label="대시보드로 돌아가기"
            className="p-2 -ml-2 text-[#6B7280] active:opacity-60"
          >
            ←
          </button>
          <h1 className="text-title font-bold">내 비전보드</h1>
          {/* 계정 진입점 (v7.9 P-1) — 대시보드 밖에서도 로그인·로그아웃 접근 */}
          <div className="ml-auto">
            <AccountButton />
          </div>
        </div>
        {/* 뷰 토글 — 전 뷰포트 공통 2탭. 보드가 전폭을 쓰도록 한 번에 한 뷰만 렌더 (v8.2) */}
        <div className="flex gap-1.5 bg-[#F5F5F3] rounded-xl p-1 max-w-md" role="radiogroup" aria-label="보기 방식">
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

      <div className="px-4 md:px-6 animate-fadeIn">
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
            {/* 템플릿은 뷰 공통 단일 값 — 셀렉터는 하나 */}
            {templateSelector}
            {renderViewPanel(view)}
          </>
        )}

        {/* 미래의 하루 이야기 / 완성 CTA — 구 보드 뷰 전용에서 공통 노출로 (v7.5 보드 탭 제거) */}
        {collageImages.length > 0 && board.futureDayStory ? (
          <div className="mt-8 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-body">미래의 하루 이야기</span>
              <button
                onClick={() => router.push('/finish')}
                className="text-caption text-[#6E6962] active:opacity-70"
              >
                {/* 재작성 넛지 (v7.8) — 스토리 작성 후 보드가 더 자랐으면 라벨로 초대 */}
                {isStoryStale(board) ? '보드가 자랐네 — 다시 써줄까? →' : '다시 쓰러 가기 →'}
              </button>
            </div>
            <StoryModal
              story={board.futureDayStory}
              color="#1C1B19"
              label="미래의 하루 읽기"
              title="미래의 하루 이야기"
              onSave={(s) => {
                saveFutureDayStory(s);
                setBoard(loadBoard());
              }}
            />
          </div>
        ) : collageImages.length > 0 && completedCount >= FIRST_BOARD_THRESHOLD ? (
          // 첫 보드 조기 개방 (v7.8) — 임계값부터 최종 스토리로 초대. 6/6 라벨은 불변(v75r1 계약)
          <div className="mt-8 space-y-2">
            <button
              onClick={() => router.push('/finish')}
              className="w-full bg-[#1C1B19] text-white py-4 rounded-2xl text-heading font-semibold active:opacity-80 transition-opacity"
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
        <div className="sticky bottom-0 z-40 px-4 md:px-6 pt-6 pb-4 bg-gradient-to-t from-[#FAF9F7] via-[#FAF9F7]/85 to-transparent pointer-events-none">
          <button
            onClick={() => handleOpenSheet(view)}
            className="pointer-events-auto block w-full max-w-md mx-auto py-3.5 rounded-2xl text-heading font-semibold text-white bg-[#1C1B19] active:opacity-80 transition-opacity shadow-[0_8px_24px_rgba(28,27,25,0.22)]"
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
          board={{ template, layout: sheetData.currentLayout, items: keyedItems }}
          onClose={() => setSheetView(null)}
        />
      )}
    </main>
  );
}
