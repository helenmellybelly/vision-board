'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  loadBoard,
  saveBoardYear,
  saveCollageDeviceLayout,
  saveCollageLayout,
  saveCollageTemplate,
  saveFutureDayStory,
} from '@/lib/storage';
import { SECTIONS } from '@/lib/questions';
import { BoardData, CollageTarget, CollageTemplate } from '@/lib/types';
import { CollageItem, resolveLayout } from '@/lib/collageTemplates';
import StoryModal from '@/components/StoryModal';
import WallpaperSheet from '@/components/WallpaperSheet';
import CollageBoard from '@/components/collage/CollageBoard';

// 편집 타깃 탭 — 세 탭 모두 같은 편집 엔진, 타깃별 배치는 따로 저장된다 (v6.18)
const TARGET_TABS: { id: CollageTarget; label: string }[] = [
  { id: 'board', label: '보드' },
  { id: 'phone', label: '폰 배경' },
  { id: 'desktop', label: 'PC 배경' },
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
  const [sheetTarget, setSheetTarget] = useState<'phone' | 'desktop' | null>(null);
  const [showCoach, setShowCoach] = useState(false);
  const [target, setTarget] = useState<CollageTarget>('board');

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

  // 타깃별 저장된 배치 — 보드는 collageLayouts, 폰/PC는 collageDeviceLayouts
  const savedLayout =
    target === 'board'
      ? board.collageLayouts?.[template]
      : board.collageDeviceLayouts?.[target]?.[template];

  // 화면에 보이는 배치 그대로 — 배경화면 내보내기와 공유
  const currentLayout = resolveLayout(template, keyedItems, savedLayout, target);

  function selectTemplate(id: CollageTemplate) {
    saveCollageTemplate(id);
    setBoard(loadBoard());
  }

  function handleLayoutChange(l: Parameters<typeof saveCollageLayout>[1]) {
    if (target === 'board') saveCollageLayout(template, l);
    else saveCollageDeviceLayout(target, template, l);
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

            {/* 편집 타깃 — 보드/폰/PC 모두 직접 편집 가능, 배치는 타깃별로 따로 저장 (v6.18) */}
            <div className="flex gap-1.5 mb-4 bg-[#F5F5F3] rounded-xl p-1" role="radiogroup" aria-label="편집 타깃">
              {TARGET_TABS.map((m) => (
                <button
                  key={m.id}
                  role="radio"
                  aria-checked={target === m.id}
                  onClick={() => setTarget(m.id)}
                  className={`flex-1 py-2 rounded-lg text-caption font-semibold transition-colors ${
                    target === m.id ? 'bg-white text-[#1C1B19] shadow-sm' : 'text-[#6E6962]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* 보드 — 탭하면 바로 편집 (모든 템플릿·타깃 공통 엔진) */}
            <CollageBoard
              key={`${target}-${template}`}
              template={template}
              items={keyedItems}
              layout={savedLayout}
              target={target}
              onLayoutChange={handleLayoutChange}
              year={boardYear}
              onYearChange={handleYearChange}
            />

            {target === 'board' ? (
              /* 보드 탭 — 배경화면은 기기 탭에서 규격에 맞게 다듬은 뒤 저장 */
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setTarget('phone')}
                  className="flex-1 py-3.5 rounded-2xl text-body font-semibold bg-white border border-[#E5E3DF] text-[#1C1B19] active:opacity-70 transition-opacity"
                >
                  폰 배경 만들기 →
                </button>
                <button
                  onClick={() => setTarget('desktop')}
                  className="flex-1 py-3.5 rounded-2xl text-body font-semibold bg-white border border-[#E5E3DF] text-[#1C1B19] active:opacity-70 transition-opacity"
                >
                  PC 배경 만들기 →
                </button>
              </div>
            ) : (
              <>
                <p className="text-micro text-[#6E6962] text-center mt-2">
                  {target === 'phone'
                    ? '실제 폰 화면 비율 그대로야. 배치를 다듬고 저장해봐.'
                    : '실제 PC 화면 비율 그대로야. 배치를 다듬고 저장해봐.'}
                </p>
                <button
                  onClick={() => setSheetTarget(target as 'phone' | 'desktop')}
                  className="mt-3 w-full py-3.5 rounded-2xl text-heading font-semibold text-white bg-[#1C1B19] active:opacity-80 transition-opacity"
                >
                  {target === 'phone' ? '폰 배경화면 저장' : 'PC 배경화면 저장'}
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
              <div className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-xl bg-[#F5F5F3] flex items-center justify-center flex-shrink-0 text-body" aria-hidden="true">📱</span>
                <p className="text-body text-[#1C1B19] leading-snug">
                  <span className="font-semibold">폰 배경·PC 배경 탭</span>에선 실제 화면 비율로 따로 꾸며서 저장할 수 있어.
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

      {sheetTarget && (
        <WallpaperSheet
          year={boardYear}
          target={sheetTarget}
          board={{ template, layout: currentLayout, items: keyedItems }}
          onClose={() => setSheetTarget(null)}
        />
      )}
    </main>
  );
}
