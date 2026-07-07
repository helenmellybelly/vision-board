'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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

// 화면 구조 (v7.0-r5) — 진입 시 '어디에 둘까'(폰/PC/보드) 선택이 먼저, 그 다음 해당 뷰로.
// 폰/PC 배경은 사이즈를 먼저 고르고 그 비율 그대로 편집하는 플로우 (v6.19)
type CollageView = 'choose' | 'board' | 'phone' | 'desktop';

const VIEW_TITLES: Record<CollageView, string> = {
  choose: '내 비전보드',
  board: '한눈에 보기',
  phone: '폰 배경 만들기',
  desktop: 'PC 배경 만들기',
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
  const [view, setView] = useState<CollageView>('choose');
  const [picking, setPicking] = useState(false); // 기기 플로우 1단계 — 사이즈 선택
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmReseed, setConfirmReseed] = useState<WallpaperPreset | null>(null);
  const [showCoach, setShowCoach] = useState(false);

  useEffect(() => {
    setBoard(loadBoard());
    if (!localStorage.getItem(COACH_KEY)) setShowCoach(true);
  }, []);

  function dismissCoach() {
    localStorage.setItem(COACH_KEY, '1');
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

  // 기기 플로우 진입 — 사이즈 미선택이면 선택 단계부터, 선택돼 있으면 바로 편집
  function enterDevice(t: 'phone' | 'desktop') {
    setView(t);
    setPicking(!board?.collageDevicePresets?.[t]);
  }

  // 모든 뷰의 상위는 선택 화면 (v7.0-r5) — 보드·기기 어디서든 ←는 여기로
  function backToChoose() {
    setView('choose');
    setPicking(false);
    setConfirmReseed(null);
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
    setPicking(false);
  }

  function applyReseed() {
    if (!confirmReseed || (view !== 'phone' && view !== 'desktop')) return;
    clearCollageDeviceLayouts(view);
    saveCollageDevicePreset(view, confirmReseed.id);
    setBoard(loadBoard());
    setConfirmReseed(null);
    setPicking(false);
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
      {/* 헤더 — 모든 뷰의 상위는 선택 화면(choose), 선택 화면의 상위는 대시보드 (v7.0-r5) */}
      <div className="px-6 pt-4 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => (view === 'choose' ? router.push('/dashboard') : backToChoose())}
            aria-label={view === 'choose' ? '대시보드로 돌아가기' : '어디에 둘까 선택으로 돌아가기'}
            className="p-2 -ml-2 text-[#6B7280] active:opacity-60"
          >
            ←
          </button>
          <h1 className="text-title font-bold">{VIEW_TITLES[view]}</h1>
        </div>
        {view === 'choose' ? (
          <p className="text-caption text-[#6E6962] pl-8">완성된 보드, 어디에 둘까?</p>
        ) : view === 'board' ? (
          <p className="text-caption text-[#6E6962] pl-8">내 비전보드를 하나로.</p>
        ) : devicePreset && !picking ? (
          <div className="flex items-center gap-2 pl-8">
            <p className="text-caption text-[#6E6962]">
              {devicePreset.label} · {devicePreset.w}×{devicePreset.h}
            </p>
            <button
              onClick={() => setPicking(true)}
              className="text-caption text-[#1C1B19] underline active:opacity-70"
            >
              사이즈 바꾸기
            </button>
          </div>
        ) : (
          <p className="text-caption text-[#6E6962] pl-8">어떤 기기에 쓸지 사이즈부터 골라줘.</p>
        )}
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
        ) : view === 'choose' ? (
          <>
            {/* 어디에 둘까 — 기기 선택 퍼스트 (v7.0-r5). 지난번 사이즈가 있으면 부제로 표시 */}
            <div className="space-y-2.5">
              {([
                {
                  target: 'phone' as const,
                  icon: '📱',
                  label: '폰 배경 만들기',
                  desc: board.collageDevicePresets?.phone
                    ? `지난번: ${WALLPAPER_PRESETS.find((p) => p.id === board.collageDevicePresets?.phone)?.label ?? ''}`
                    : '잠금화면에서 매일 보게',
                },
                {
                  target: 'desktop' as const,
                  icon: '🖥️',
                  label: 'PC 배경 만들기',
                  desc: board.collageDevicePresets?.desktop
                    ? `지난번: ${WALLPAPER_PRESETS.find((p) => p.id === board.collageDevicePresets?.desktop)?.label ?? ''}`
                    : '일하는 화면에서 매일 보게',
                },
              ]).map((opt) => (
                <button
                  key={opt.target}
                  onClick={() => enterDevice(opt.target)}
                  className="w-full flex items-center gap-4 rounded-2xl bg-white border border-[#E5E3DF] px-5 py-4 text-left active:opacity-70 transition-opacity"
                >
                  <span className="text-title" aria-hidden="true">{opt.icon}</span>
                  <span>
                    <span className="block text-body font-semibold text-[#1C1B19]">{opt.label} →</span>
                    <span className="block text-caption text-[#6E6962] mt-0.5">{opt.desc}</span>
                  </span>
                </button>
              ))}
              <button
                onClick={() => setView('board')}
                className="w-full flex items-center gap-4 rounded-2xl bg-white border border-[#E5E3DF] px-5 py-4 text-left active:opacity-70 transition-opacity"
              >
                <span className="text-title" aria-hidden="true">🖼️</span>
                <span>
                  <span className="block text-body font-semibold text-[#1C1B19]">그냥 보드로 보기 →</span>
                  <span className="block text-caption text-[#6E6962] mt-0.5">4:5 비율로 보고 꾸미기</span>
                </span>
              </button>
            </div>
          </>
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

            {/* 기기 배경 플로우 진입 — 사이즈 선택 → 그 비율로 편집 → 저장 */}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => enterDevice('phone')}
                className="flex-1 py-3.5 rounded-2xl text-body font-semibold bg-white border border-[#E5E3DF] text-[#1C1B19] active:opacity-70 transition-opacity"
              >
                폰 배경 만들기 →
              </button>
              <button
                onClick={() => enterDevice('desktop')}
                className="flex-1 py-3.5 rounded-2xl text-body font-semibold bg-white border border-[#E5E3DF] text-[#1C1B19] active:opacity-70 transition-opacity"
              >
                PC 배경 만들기 →
              </button>
            </div>
          </>
        ) : picking || !devicePreset ? (
          <>
            {/* 기기 플로우 1단계 — 사이즈 선택. PC도 FHD/맥북(16:10)/울트라와이드 등 비율이 다르다 */}
            <DevicePresetPicker
              groups={view === 'phone' ? ['휴대폰', '태블릿'] : ['PC']}
              selectedId={devicePreset?.id}
              onSelect={handleSelectPreset}
            />

            {confirmReseed && (
              <div className="mt-4 rounded-xl bg-[#FEF9C3] px-4 py-3">
                <p className="text-caption text-[#92400E] mb-2">
                  비율이 달라져서 배치를 새로 짜야 해. 지금까지 꾸민 배치는 사라져. 계속할까?
                </p>
                <div className="flex gap-3">
                  <button onClick={applyReseed} className="text-caption font-semibold text-[#92400E]">
                    계속
                  </button>
                  <button
                    onClick={() => setConfirmReseed(null)}
                    className="text-caption text-[#6E6962]"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}

            {devicePreset && !confirmReseed && (
              <button
                onClick={() => setPicking(false)}
                className="mt-4 w-full py-2 text-caption text-[#6E6962] text-center active:opacity-70"
              >
                그대로 둘게 (편집으로 돌아가기)
              </button>
            )}
          </>
        ) : (
          <>
            {/* 기기 플로우 2단계 — 선택한 비율 그대로 편집 */}
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

        {/* 미래의 하루 이야기 — 선택·보드 뷰에서 / 6개 영역 완성 시에만 노출 */}
        {(view === 'choose' || view === 'board') && board.futureDayStory ? (
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
        ) : (view === 'choose' || view === 'board') && completedCount === 6 ? (
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
        ) : null}
      </div>

      {/* 첫 진입 코치마크 — 보드 편집 화면에서 1회 안내 (v6.17 발견성 피드백, v7.0-r5: 보드 뷰에서만) */}
      {showCoach && view === 'board' && collageImages.length > 0 && (
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
                  아래 <span className="font-semibold">폰 배경·PC 배경 만들기</span>에선 기기 사이즈를 고르고, 그 비율 그대로 꾸며서 저장할 수 있어.
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

      {sheetOpen && (view === 'phone' || view === 'desktop') && devicePreset && (
        <WallpaperSheet
          year={boardYear}
          preset={devicePreset}
          board={{ template, layout: currentLayout, items: keyedItems }}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </main>
  );
}
