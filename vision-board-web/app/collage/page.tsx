'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  loadBoard,
  saveBoardYear,
  saveCollageLayout,
  saveCollageTemplate,
  saveFutureDayStory,
} from '@/lib/storage';
import { SECTIONS } from '@/lib/questions';
import { BoardData, CollageTemplate } from '@/lib/types';
import { CollageItem, resolveLayout } from '@/lib/collageTemplates';
import { WallpaperTarget } from '@/lib/wallpaper';
import StoryModal from '@/components/StoryModal';
import WallpaperSheet from '@/components/WallpaperSheet';
import CollageBoard from '@/components/collage/CollageBoard';
import WallpaperPreview from '@/components/collage/WallpaperPreview';

type ViewMode = 'edit' | 'mobile' | 'desktop';

const VIEW_MODES: { id: ViewMode; label: string }[] = [
  { id: 'edit', label: '보드 편집' },
  { id: 'mobile', label: '폰 미리보기' },
  { id: 'desktop', label: 'PC 미리보기' },
];

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
  const [wallpaperTarget, setWallpaperTarget] = useState<WallpaperTarget | null>(null);
  const [showCoach, setShowCoach] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('edit');

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

  const boardYear = board.boardYear ?? String(new Date().getFullYear());

  // 배경화면 렌더용 — 섹션별 이미지 묶음 (업로드 우선, AI 생성 보조)
  const sectionGroups = SECTIONS.map((section) => {
    const sec = board.sections[section.id];
    const uploaded = sec.uploadedImages ?? [];
    const generated = sec.generatedImages ?? [];
    return {
      label: section.title.split(' — ')[0],
      color: section.color,
      images: [0, 1, 2]
        .map((i) => uploaded[i] || generated[i] || null)
        .filter((img): img is string => !!img),
    };
  });

  // 화면에 보이는 배치 그대로 — 배경화면 내보내기와 공유
  const currentLayout = resolveLayout(template, keyedItems, board.collageLayouts?.[template]);

  function selectTemplate(id: CollageTemplate) {
    saveCollageTemplate(id);
    setBoard(loadBoard());
  }

  function handleYearChange(y: string) {
    saveBoardYear(y);
    setBoard(loadBoard());
  }

  return (
    <main className="min-h-screen flex flex-col max-w-md md:max-w-3xl mx-auto w-full pb-10">
      {/* 헤더 */}
      <div className="px-6 pt-4 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => router.push('/board')}
            className="p-2 -ml-2 text-[#6B7280] active:opacity-60"
          >
            ‹
          </button>
          <h1 className="text-title font-bold">한눈에 보기</h1>
        </div>
        <p className="text-caption text-[#6E6962] pl-8">내 비전보드를 하나로.</p>
      </div>

      <div className="px-4 md:px-6 animate-fadeIn">
        {collageImages.length > 0 ? (
          <>
            {/* 템플릿 선택 */}
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

            {/* 보기 모드 — 편집 보드 ↔ 폰/PC 배경화면 미리보기 전환 (v6.17) */}
            <div className="flex gap-1.5 mb-4 bg-[#F5F5F3] rounded-xl p-1" role="radiogroup" aria-label="보기 모드">
              {VIEW_MODES.map((m) => (
                <button
                  key={m.id}
                  role="radio"
                  aria-checked={viewMode === m.id}
                  onClick={() => setViewMode(m.id)}
                  className={`flex-1 py-2 rounded-lg text-caption font-semibold transition-colors ${
                    viewMode === m.id ? 'bg-white text-[#1C1B19] shadow-sm' : 'text-[#6E6962]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {viewMode === 'edit' ? (
              <>
                {/* 보드 — 탭하면 바로 편집 (모든 템플릿 공통) */}
                <CollageBoard
                  template={template}
                  items={keyedItems}
                  layout={board.collageLayouts?.[template]}
                  onLayoutChange={(l) => {
                    saveCollageLayout(template, l);
                    setBoard(loadBoard());
                  }}
                  year={boardYear}
                  onYearChange={handleYearChange}
                />

                {/* 저장 — 폰/PC 2버튼으로 명확하게 */}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setWallpaperTarget('mobile')}
                    className="flex-1 py-3.5 rounded-2xl text-body font-semibold bg-white border border-[#E5E3DF] text-[#1C1B19] active:opacity-70 transition-opacity"
                  >
                    폰 배경화면 저장
                  </button>
                  <button
                    onClick={() => setWallpaperTarget('desktop')}
                    className="flex-1 py-3.5 rounded-2xl text-body font-semibold bg-white border border-[#E5E3DF] text-[#1C1B19] active:opacity-70 transition-opacity"
                  >
                    PC 배경화면 저장
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* 배경화면 미리보기 — 읽기 전용, 편집은 '보드 편집' 탭에서 */}
                <WallpaperPreview
                  template={template}
                  layout={currentLayout}
                  items={keyedItems}
                  year={boardYear}
                  target={viewMode}
                />
                <button
                  onClick={() => setWallpaperTarget(viewMode)}
                  className="mt-4 w-full py-3.5 rounded-2xl text-heading font-semibold text-white bg-[#1C1B19] active:opacity-80 transition-opacity"
                >
                  이대로 저장하기
                </button>
              </>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <p className="text-body text-[#6E6962]">
              아직 담긴 사진이 없어.
              <br />
              비전보드에 사진을 1개 이상 올리면 여기서 볼 수 있어.
            </p>
            <button
              onClick={() => router.push('/board')}
              className="mt-6 px-6 py-3 rounded-2xl text-body font-semibold text-white bg-[#1C1B19] active:opacity-80"
            >
              비전보드로 가기 →
            </button>
          </div>
        )}

        {/* 미래의 하루 이야기 — 있을 때 / 6개 영역 완성 시에만 노출 */}
        {board.futureDayStory ? (
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
        ) : completedCount === 6 ? (
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

      {/* 첫 진입 코치마크 — 직접 편집할 수 있다는 걸 1회 안내 (v6.17 발견성 피드백) */}
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

      {wallpaperTarget && (
        <WallpaperSheet
          groups={sectionGroups}
          year={boardYear}
          target={wallpaperTarget}
          board={{ template, layout: currentLayout, items: keyedItems }}
          onClose={() => setWallpaperTarget(null)}
        />
      )}
    </main>
  );
}
