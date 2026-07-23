'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { track } from '@vercel/analytics';
import {
  clearCollageDeviceLayouts,
  loadBoard,
  saveTargetDate,
  saveCollageDeviceLayout,
  saveCollageDevicePreset,
  saveCollageLayout,
  saveCollageTemplate,
  saveFutureDayStory,
} from '@/lib/storage';
import { getTargetDate, getTargetYear, withYear } from '@/lib/targetDate';
import { SECTIONS } from '@/lib/questions';
import { BoardData, CollageLayout, CollageTemplate } from '@/lib/types';
import { ASPECT, CollageItem, aspectsEqual, resolveLayout } from '@/lib/collageTemplates';
import { WALLPAPER_PRESETS, WallpaperPreset } from '@/lib/wallpaper';
import StoryModal from '@/components/StoryModal';
import WallpaperSheet from '@/components/WallpaperSheet';
import CollageBoard from '@/components/collage/CollageBoard';
import DevicePresetPicker from '@/components/collage/DevicePresetPicker';

// 화면 구조 (v7.2) — choose 뷰 제거, 한 화면에서 [보드|폰|PC] 토글 + 인라인 사이즈 선택
// v7.3 — 기본 뷰 PC, 사이즈는 패널 대신 상단 칩 상시 노출, 모든 뷰에서 저장 가능, ?view= URL 동기화
type CollageView = 'board' | 'phone' | 'desktop';

// 보드 뷰 저장용 임시 프리셋 — 화면과 같은 4:5 비율이라 WYSIWYG (WallpaperSheet는 id/label/w/h만 사용)
const BOARD_EXPORT_PRESET: WallpaperPreset = {
  id: 'board',
  label: '보드 이미지 (4:5)',
  w: 1600,
  h: 2000,
  group: 'PC',
};

const TEMPLATES: { id: CollageTemplate; label: string }[] = [
  { id: 'polaroid', label: '폴라로이드' },
  { id: 'mosaic', label: '모자이크' },
  { id: 'minimal', label: '미니멀' },
];

// 첫 진입 코치마크 1회 노출 여부 — BoardData 스키마와 분리해 별도 키로 관리
const COACH_KEY = 'vb-collage-coach-v1';

// 템플릿 탭 미니 스와치 — 글자만으로는 모드 차이가 안 보인다는 피드백(v6.17)
function TemplateSwatch({ id }: { id: CollageTemplate }) {
  if (id === 'polaroid') {
    return (
      <span className="inline-block w-4 h-4 rounded-[3px] bg-[#2D2B29] relative flex-shrink-0" aria-hidden="true">
        <span className="absolute left-[3px] top-[3px] w-2 h-2.5 bg-white rounded-[1px] rotate-[-8deg]" />
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
  const [view, setView] = useState<CollageView>('desktop'); // 기본 PC — 가로 시야 확보 (v7.3)
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmReseed, setConfirmReseed] = useState<WallpaperPreset | null>(null);
  const [showCoach, setShowCoach] = useState(false);

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
    // ?view= 우선, 레거시 ?device=(/finish 딥링크) 호환 — URL은 ?view=로 정규화해
    // 페이지뷰 분석에서 서브뷰가 구분되게 남긴다 (v7.3)
    // useSearchParams는 Suspense 바운더리를 요구하므로 클라이언트 마운트에서 직접 파싱
    const params = new URLSearchParams(window.location.search);
    const v = params.get('view');
    const device = params.get('device');
    let initial: CollageView = 'desktop';
    if (v === 'board' || v === 'phone' || v === 'desktop') initial = v;
    else if (device === 'phone' || device === 'desktop') initial = device;
    setView(initial);
    history.replaceState(null, '', `${window.location.pathname}?view=${initial}`);
  }, [router]);

  // 기기 뷰 첫 진입 — 프리셋 미선택이면 표준값 자동 선택 (v7.3, 빈 피커 화면 제거)
  // 시드 id는 반드시 실존 프리셋만 ('phone', 'pc-fhd')
  useEffect(() => {
    if (!board) return;
    if (view !== 'phone' && view !== 'desktop') return;
    if (board.collageDevicePresets?.[view]) return;
    saveCollageDevicePreset(view, view === 'phone' ? 'phone' : 'pc-fhd');
    setBoard(loadBoard());
  }, [view, board]);

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

  const template: CollageTemplate = board.collageTemplate ?? 'polaroid';

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

  // 기기 뷰의 선택 사이즈 — 편집·내보내기 비율을 이 프리셋이 결정한다 (v6.19)
  const isDevice = view === 'phone' || view === 'desktop';
  const devicePresetId =
    view === 'phone' || view === 'desktop' ? board.collageDevicePresets?.[view] : undefined;
  const devicePreset = WALLPAPER_PRESETS.find((p) => p.id === devicePresetId);
  const aspect = !isDevice || !devicePreset ? ASPECT : devicePreset.w / devicePreset.h;

  // 뷰별 저장된 배치 — 보드는 collageLayouts, 폰/PC는 collageDeviceLayouts
  const savedLayout =
    view === 'phone' || view === 'desktop'
      ? board.collageDeviceLayouts?.[view]?.[template]
      : board.collageLayouts?.[template];

  // 화면에 보이는 배치 그대로 — 배경화면 내보내기와 공유
  const currentLayout = resolveLayout(template, keyedItems, savedLayout, aspect);

  function selectTemplate(id: CollageTemplate) {
    saveCollageTemplate(id);
    setBoard(loadBoard());
  }

  function handleLayoutChange(l: CollageLayout) {
    const stamped = { ...l, aspect };
    if (view === 'phone' || view === 'desktop') saveCollageDeviceLayout(view, template, stamped);
    else saveCollageLayout(template, stamped);
    setBoard(loadBoard());
  }

  function handleYearChange(y: string) {
    saveTargetDate(withYear(getTargetDate(loadBoard()), y));
    setBoard(loadBoard());
  }

  // 탭 전환 — reseed 확인은 뷰 이동 시 접고, URL을 ?view=로 동기화 (분석 구분용)
  function switchView(v: CollageView) {
    setView(v);
    setConfirmReseed(null);
    history.replaceState(null, '', `${window.location.pathname}?view=${v}`);
    track('collage_view', { view: v }); // Pro 플랜에서만 수집 — Hobby에선 무해한 no-op
  }

  // 사이즈 선택 — 비율이 거의 같으면 배치 유지, 다르면 리시드 확인
  function handleSelectPreset(preset: WallpaperPreset) {
    if ((view !== 'phone' && view !== 'desktop') || !board) return;
    const hasLayouts =
      Object.keys(board.collageDeviceLayouts?.[view] ?? {}).length > 0;
    const newAspect = preset.w / preset.h;
    if (devicePreset && hasLayouts && !aspectsEqual(devicePreset.w / devicePreset.h, newAspect)) {
      setConfirmReseed(preset);
      return;
    }
    saveCollageDevicePreset(view, preset.id);
    setBoard(loadBoard());
    setConfirmReseed(null);
  }

  function applyReseed() {
    if (!confirmReseed || (view !== 'phone' && view !== 'desktop')) return;
    clearCollageDeviceLayouts(view);
    saveCollageDevicePreset(view, confirmReseed.id);
    setBoard(loadBoard());
    setConfirmReseed(null);
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

  return (
    <main className="min-h-screen flex flex-col max-w-md md:max-w-3xl mx-auto w-full pb-10">
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
        </div>
        <div className="flex gap-1.5 bg-[#F5F5F3] rounded-xl p-1" role="radiogroup" aria-label="보기 방식">
          {([
            { id: 'board' as const, label: '보드' },
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
        ) : view === 'board' ? (
          <>
            {templateSelector}

            {/* 보드 — 탭하면 바로 편집 */}
            <CollageBoard
              key={`board-${template}`}
              template={template}
              items={keyedItems}
              layout={savedLayout}
              aspect={ASPECT}
              onLayoutChange={handleLayoutChange}
              year={boardYear}
              onYearChange={handleYearChange}
            />
            <p className="text-micro text-[#6E6962] text-center mt-2">
              위 탭에서 폰·PC를 고르면 배경화면으로 만들 수 있어.
            </p>
            {/* 보드 뷰도 바로 저장 가능 (v7.3) — 화면과 같은 4:5 이미지로 */}
            <button
              onClick={() => setSheetOpen(true)}
              className="mt-3 w-full py-3.5 rounded-2xl text-heading font-semibold text-white bg-[#1C1B19] active:opacity-80 transition-opacity"
            >
              🖼️ 이미지로 저장
            </button>
          </>
        ) : (
          <>
            {/* 표준 사이즈 칩 — 상단 상시 노출, 탭 즉시 적용 (v7.3, 구 '사이즈 바꾸기' 패널 대체) */}
            <DevicePresetPicker
              groups={view === 'phone' ? ['휴대폰', '태블릿'] : ['PC']}
              selectedId={devicePreset?.id}
              onSelect={handleSelectPreset}
            />
            {devicePreset && (
              <p className="text-caption text-[#6E6962] mt-1.5 mb-3">
                {devicePreset.label} · {devicePreset.w}×{devicePreset.h}
              </p>
            )}
            {confirmReseed && (
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
            {devicePreset && (
              <>
                {templateSelector}
                <CollageBoard
                  key={`${view}-${devicePreset.id}-${template}`}
                  template={template}
                  items={keyedItems}
                  layout={savedLayout}
                  aspect={aspect}
                  onLayoutChange={handleLayoutChange}
                  year={boardYear}
                  onYearChange={handleYearChange}
                />
                <p className="text-micro text-[#6E6962] text-center mt-2">
                  {view === 'phone'
                    ? '선택한 폰 화면 비율 그대로야. 배치를 다듬고 저장해봐.'
                    : '선택한 PC 화면 비율 그대로야. 배치를 다듬고 저장해봐.'}
                </p>
                <button
                  onClick={() => setSheetOpen(true)}
                  className="mt-3 w-full py-3.5 rounded-2xl text-heading font-semibold text-white bg-[#1C1B19] active:opacity-80 transition-opacity"
                >
                  {view === 'phone' ? '폰 배경화면 저장' : 'PC 배경화면 저장'}
                </button>
              </>
            )}
          </>
        )}

        {/* 미래의 하루 이야기 — 보드 뷰에서 / 6개 영역 완성 시에만 노출 */}
        {view === 'board' && board.futureDayStory ? (
          <div className="mt-8 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-body">미래의 하루 이야기</span>
              <button
                onClick={() => router.push('/finish')}
                className="text-caption text-[#6E6962] active:opacity-70"
              >
                다시 쓰러 가기 →
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
        ) : view === 'board' && completedCount === 6 ? (
          <div className="mt-8 space-y-2">
            <button
              onClick={() => router.push('/finish')}
              className="w-full bg-[#1C1B19] text-white py-4 rounded-2xl text-heading font-semibold active:opacity-80 transition-opacity"
            >
              내 비전보드 완성하기 🐿️
            </button>
            <p className="text-micro text-[#6E6962] text-center">
              완성하면 미래의 하루 이야기를 써줄게.
            </p>
          </div>
        ) : view === 'board' && collageImages.length > 0 ? (
          // 부분 완성 상태 (v7.4) — 다 채우기 전에도 배경화면 저장이 이미 가능하다는 걸 알린다
          <p className="mt-8 text-micro text-[#6E6962] text-center">
            지금 이대로도 폰·PC 배경화면으로 저장할 수 있어 — 위에서 탭을 골라봐 🐿️
          </p>
        ) : null}
      </div>

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
            <p className="text-title font-bold text-[#1C1B19]">이 보드, 직접 꾸밀 수 있어 🐿️</p>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-xl bg-[#F5F5F3] flex items-center justify-center flex-shrink-0 text-body" aria-hidden="true">✋</span>
                <p className="text-body text-[#1C1B19] leading-snug">
                  보드를 탭하면 <span className="font-semibold">사진을 끌어 옮기고, 크기를 바꾸고, 문구도 더할 수 있어.</span>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-xl bg-[#F5F5F3] flex items-center justify-center flex-shrink-0 text-body" aria-hidden="true">🖼️</span>
                <p className="text-body text-[#1C1B19] leading-snug">
                  위 탭에서 <span className="font-semibold">폴라로이드·모자이크·미니멀</span> 스타일을 바꿔봐.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-xl bg-[#F5F5F3] flex items-center justify-center flex-shrink-0 text-body" aria-hidden="true">📱</span>
                <p className="text-body text-[#1C1B19] leading-snug">
                  위 <span className="font-semibold">보드·폰·PC 탭</span>에서 기기 사이즈를 고르면, 그 비율 그대로 꾸며서 저장할 수 있어.
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

      {sheetOpen && (view === 'board' ? true : !!devicePreset) && (
        <WallpaperSheet
          year={boardYear}
          preset={view === 'board' ? BOARD_EXPORT_PRESET : devicePreset!}
          board={{ template, layout: currentLayout, items: keyedItems }}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </main>
  );
}
