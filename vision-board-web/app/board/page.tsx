'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  loadBoard,
  saveUploadedImage,
  saveBoardYear,
  saveMiniStory,
  saveFutureDayStory,
} from '@/lib/storage';
import { SECTIONS } from '@/lib/questions';
import { getSectionRoute, getSectionCtaLabel } from '@/lib/sectionRoute';
import { compressImage } from '@/lib/imageUtils';
import { BoardData, SectionId, SlotId } from '@/lib/types';
import ProcessBar from '@/components/ProcessBar';
import StoryModal from '@/components/StoryModal';
import VisionBoardCollage from '@/components/VisionBoardCollage';

export default function BoardPage() {
  const router = useRouter();
  const [board, setBoard] = useState<BoardData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<{ sectionId: SectionId; index: number } | null>(null);

  useEffect(() => {
    setBoard(loadBoard());
  }, []);

  function openUpload(sectionId: SectionId, index: number) {
    uploadTargetRef.current = { sectionId, index };
    fileInputRef.current?.click();
  }

  function handleFileSelected(file: File) {
    const target = uploadTargetRef.current;
    if (!target) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const raw = e.target?.result as string;
      const compressed = await compressImage(raw, 0.60, 800);
      saveUploadedImage(target.sectionId, target.index, compressed);
      setBoard(loadBoard());
    };
    reader.readAsDataURL(file);
  }

  function removeUploaded(sectionId: SectionId, index: number) {
    saveUploadedImage(sectionId, index, null);
    setBoard(loadBoard());
  }

  if (!board) return null;

  const completedCount = Object.values(board.sections).filter(
    (s) => s.status === 'completed'
  ).length;

  // 콜라주용 — 전 섹션의 이미지(업로드 우선, AI 생성 보조)를 하나로 모음
  const collageImages = SECTIONS.flatMap((section) => {
    const sec = board.sections[section.id];
    const uploaded = sec.uploadedImages ?? [];
    const generated = sec.generatedImages ?? [];
    const merged = [0, 1, 2].map((i) => uploaded[i] || generated[i] || null);
    return [...merged, uploaded[3], uploaded[4]].filter((img): img is string => !!img);
  });
  const boardYear = board.boardYear ?? String(new Date().getFullYear());

  // 한눈에 보기 + 미래의 하루 — 모바일(하단)과 웹(우측 패널)에서 공용
  const summaryPane = (compact: boolean) => (
    <>
      {collageImages.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="font-semibold text-sm">한눈에 보기</span>
            <span className="text-xs text-[#9CA3AF]">내 비전보드를 하나로</span>
          </div>
          <VisionBoardCollage
            compact={compact}
            images={collageImages}
            year={boardYear}
            onYearChange={(y) => {
              saveBoardYear(y);
              setBoard(loadBoard());
            }}
          />
        </div>
      )}

      {/* 미래의 하루 이야기 */}
      <div className="mt-6">
        {board.futureDayStory ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm">미래의 하루 이야기</span>
              <button
                onClick={() => router.push('/finish')}
                className="text-xs text-[#9CA3AF] active:opacity-70"
              >
                다시 쓰러 가기 →
              </button>
            </div>
            <StoryModal
              story={board.futureDayStory}
              color="#1C1B19"
              label="📖 미래의 하루 읽기"
              title="미래의 하루 이야기"
              onSave={(s) => {
                saveFutureDayStory(s);
                setBoard(loadBoard());
              }}
            />
          </div>
        ) : completedCount === 6 ? (
          <div className="space-y-2">
            <button
              onClick={() => router.push('/finish')}
              className="w-full bg-[#1C1B19] text-white py-4 rounded-2xl text-base font-semibold active:opacity-80 transition-opacity"
            >
              내 비전보드 완성하기 🐿️
            </button>
            <p className="text-[11px] text-[#9CA3AF] text-center">
              완성하면 미래의 하루 이야기를 써줄게.
            </p>
          </div>
        ) : (
          <p className="text-[11px] text-[#9CA3AF] text-center leading-relaxed">
            미래의 하루 이야기는 6개 영역을 모두 완성하면 열려. (현재 {completedCount}/6)
          </p>
        )}
      </div>
    </>
  );

  return (
    <main className="min-h-screen flex flex-col max-w-md md:max-w-5xl mx-auto w-full pb-10">
      <ProcessBar board={board} />
      {/* 헤더 */}
      <div className="px-6 pt-4 pb-6">
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => router.push('/dashboard')}
            className="p-2 -ml-2 text-[#6B7280] active:opacity-60"
          >
            ‹
          </button>
          <h1 className="text-xl font-bold">내 비전보드</h1>
          <span className="text-sm text-[#9CA3AF] ml-auto">{completedCount}/6</span>
        </div>
        <p className="text-xs text-[#9CA3AF] pl-8">막연했던 바람이, 생생한 장면이 되는 곳.</p>
      </div>

      <div className="md:grid md:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] md:gap-8 md:items-start md:px-6">
        {/* 섹션별 이미지 그룹 */}
        <div className="px-4 md:px-0 space-y-6 md:grid md:grid-cols-2 md:gap-6 md:space-y-0 animate-fadeIn">
          {SECTIONS.map((section) => {
            const sectionData = board.sections[section.id];
            const uploaded = sectionData.uploadedImages ?? [];
            const generated = sectionData.generatedImages ?? [];
            const images: (string | null)[] = [0, 1, 2].map(
              (i) => uploaded[i] || (generated[i] || null)
            );
            const keyword = sectionData.extractedSlots?.keyword ?? sectionData.slots[2 as SlotId]?.text;

            return (
              <div key={section.id}>
                {/* 섹션 헤더 */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: section.color }} />
                  <span className="font-semibold text-sm">{section.title.split(' — ')[0]}</span>
                  {keyword && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: section.lightColor, color: section.color }}
                    >
                      {keyword}
                    </span>
                  )}
                  <button
                    onClick={() => router.push(getSectionRoute(sectionData, section.id))}
                    className="ml-auto text-xs text-[#9CA3AF] whitespace-nowrap flex-shrink-0 active:opacity-70"
                  >
                    {getSectionCtaLabel(sectionData)}
                  </button>
                </div>

                {/* 이미지 3칸 — 빈 칸은 탭해서 바로 사진 업로드 */}
                <div className="grid grid-cols-3 gap-2">
                  {images.map((img, imgIdx) => (
                    <div key={imgIdx} className="aspect-square relative">
                      {img ? (
                        <>
                          <img
                            src={img}
                            alt=""
                            className="w-full h-full object-cover rounded-xl"
                          />
                          {uploaded[imgIdx] && (
                            <button
                              onClick={() => removeUploaded(section.id, imgIdx)}
                              className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/50 text-white text-xs flex items-center justify-center"
                            >
                              ×
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          onClick={() => openUpload(section.id, imgIdx)}
                          className="w-full h-full rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-0.5 active:opacity-70"
                          style={{ borderColor: section.color + '40', backgroundColor: section.lightColor }}
                        >
                          <span className="text-base leading-none" style={{ color: section.color + '90' }}>+</span>
                          <span className="text-[10px] font-medium" style={{ color: section.color + '80' }}>
                            사진 추가
                          </span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* 스토리 — 있으면 언제나 팝업으로 볼 수 있음 */}
                {sectionData.miniStory && (
                  <StoryModal
                    story={sectionData.miniStory}
                    color={section.color}
                    title={`${section.title.split(' — ')[0]} 스토리`}
                    triggerClassName="mt-2"
                    onSave={(s) => {
                      saveMiniStory(section.id, s);
                      setBoard(loadBoard());
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* 웹(md+) — 우측 고정 패널 */}
        <aside className="hidden md:block md:sticky md:top-4 md:max-h-[calc(100vh-2rem)] md:overflow-y-auto md:pb-4 animate-fadeIn">
          {summaryPane(true)}
        </aside>
      </div>

      {/* 모바일 — 기존처럼 섹션 아래 배치 */}
      <div className="md:hidden px-4 mt-10 animate-fadeIn">
        {summaryPane(false)}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelected(file);
          e.target.value = '';
        }}
      />
    </main>
  );
}
