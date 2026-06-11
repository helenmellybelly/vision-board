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
import StoryModal from '@/components/StoryModal';
import VisionBoardCollage from '@/components/VisionBoardCollage';
import WallpaperSheet from '@/components/WallpaperSheet';
import CollageMosaic from '@/components/collage/CollageMosaic';
import CollageMinimal from '@/components/collage/CollageMinimal';
import CollageCustom, { CollageItem, defaultLayout } from '@/components/collage/CollageCustom';

const TEMPLATES: { id: CollageTemplate; label: string }[] = [
  { id: 'polaroid', label: '폴라로이드' },
  { id: 'mosaic', label: '모자이크' },
  { id: 'minimal', label: '미니멀' },
  { id: 'custom', label: '내 배치' },
];

export default function CollagePage() {
  const router = useRouter();
  const [board, setBoard] = useState<BoardData | null>(null);
  const [wallpaperOpen, setWallpaperOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setBoard(loadBoard());
  }, []);

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

  // 커스텀 배치용 — 섹션·슬롯 키와 함께 (사진 교체·삭제에도 배치가 안정적)
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

  function selectTemplate(id: CollageTemplate) {
    saveCollageTemplate(id);
    setBoard(loadBoard());
    if (id !== 'custom') setEditing(false);
  }

  function handleYearChange(y: string) {
    saveBoardYear(y);
    setBoard(loadBoard());
  }

  function resetCustomLayout() {
    saveCollageLayout(defaultLayout(keyedItems));
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
                  className={`flex-1 py-2 rounded-lg text-caption font-semibold transition-colors ${
                    template === t.id ? 'bg-white text-[#1C1B19] shadow-sm' : 'text-[#6E6962]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {template === 'polaroid' && (
              <VisionBoardCollage
                compact={false}
                images={collageImages}
                year={boardYear}
                onYearChange={handleYearChange}
              />
            )}
            {template === 'mosaic' && (
              <CollageMosaic images={collageImages} year={boardYear} onYearChange={handleYearChange} />
            )}
            {template === 'minimal' && (
              <CollageMinimal images={collageImages} year={boardYear} onYearChange={handleYearChange} />
            )}
            {template === 'custom' && (
              <>
                <CollageCustom
                  items={keyedItems}
                  layout={board.collageLayout}
                  onLayoutChange={(l) => {
                    saveCollageLayout(l);
                    setBoard(loadBoard());
                  }}
                  editing={editing}
                  year={boardYear}
                  onYearChange={handleYearChange}
                />
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setEditing((e) => !e)}
                    className={`flex-1 py-3 rounded-2xl text-body font-semibold transition-opacity active:opacity-70 ${
                      editing
                        ? 'bg-[#1C1B19] text-white'
                        : 'bg-white border border-[#E5E3DF] text-[#1C1B19]'
                    }`}
                  >
                    {editing ? '편집 완료' : '배치 편집'}
                  </button>
                  {editing && (
                    <button
                      onClick={resetCustomLayout}
                      className="px-4 py-3 rounded-2xl text-caption text-[#6E6962] bg-white border border-[#E5E3DF] active:opacity-70"
                    >
                      기본 배치로
                    </button>
                  )}
                </div>
                {editing && (
                  <p className="text-micro text-[#6E6962] text-center mt-2">
                    사진을 끌어 옮기고, 오른쪽 아래 손잡이로 크기를 바꿔봐. 겹쳐도 좋아.
                  </p>
                )}
              </>
            )}

            <button
              onClick={() => setWallpaperOpen(true)}
              className="mt-4 w-full py-3.5 rounded-2xl text-body font-semibold bg-white border border-[#E5E3DF] text-[#1C1B19] active:opacity-70 transition-opacity"
            >
              📱🖥️ 배경화면으로 저장
            </button>
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

      {wallpaperOpen && (
        <WallpaperSheet
          groups={sectionGroups}
          year={boardYear}
          onClose={() => setWallpaperOpen(false)}
        />
      )}
    </main>
  );
}
