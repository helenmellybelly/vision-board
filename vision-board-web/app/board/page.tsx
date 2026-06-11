'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  loadBoard,
  saveUploadedImage,
  saveMiniStory,
} from '@/lib/storage';
import { SECTIONS } from '@/lib/questions';
import { getSectionRoute, getSectionCtaLabel, shouldHighlightCta } from '@/lib/sectionRoute';
import { compressImage } from '@/lib/imageUtils';
import { BoardData, SectionId, SlotId } from '@/lib/types';
import ProcessBar from '@/components/ProcessBar';
import StoryModal from '@/components/StoryModal';

export default function BoardPage() {
  const router = useRouter();
  const [board, setBoard] = useState<BoardData | null>(null);
  const [showCollageHint, setShowCollageHint] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<{ sectionId: SectionId; index: number } | null>(null);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // 한눈에 보기 버튼 활성화 판단 — 전 섹션에 담긴 이미지 수
  const collageImageCount = SECTIONS.flatMap((section) => {
    const sec = board.sections[section.id];
    const uploaded = sec.uploadedImages ?? [];
    const generated = sec.generatedImages ?? [];
    return [0, 1, 2]
      .map((i) => uploaded[i] || generated[i] || null)
      .filter((img): img is string => !!img);
  }).length;

  function handleCollageClick() {
    if (collageImageCount > 0) {
      router.push('/collage');
      return;
    }
    // 비활성 상태에서 누르면 안내 문구를 잠깐 보여줌
    setShowCollageHint(true);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => setShowCollageHint(false), 2500);
  }

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
          <span className="text-sm text-[#6E6962] ml-auto">{completedCount}/6</span>
        </div>
        <p className="text-xs text-[#6E6962] pl-8">막연했던 바람이, 생생한 장면이 되는 곳.</p>
      </div>

      <div className="md:px-6">
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
                      className="text-xs px-2 py-0.5 rounded-full font-medium truncate min-w-0"
                      style={{ backgroundColor: section.lightColor, color: section.color }}
                    >
                      {keyword}
                    </span>
                  )}
                  {/* 사진만 있고 채팅·스토리가 남았으면 pill로 강조 — 다음 단계를 권유 */}
                  <button
                    onClick={() => router.push(getSectionRoute(sectionData, section.id))}
                    className={
                      shouldHighlightCta(sectionData)
                        ? 'ml-auto text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0 active:opacity-70'
                        : 'ml-auto text-xs text-[#6E6962] whitespace-nowrap flex-shrink-0 active:opacity-70'
                    }
                    style={
                      shouldHighlightCta(sectionData)
                        ? { backgroundColor: section.lightColor, color: section.color }
                        : undefined
                    }
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

      </div>

      {/* 하단 — 한눈에 보기 (별도 페이지로 이동) */}
      <div className="px-4 md:px-6 mt-10 animate-fadeIn">
        <button
          onClick={handleCollageClick}
          title={collageImageCount === 0 ? '비전보드 사진을 1개 이상 올리면 활성화돼요' : undefined}
          className={
            collageImageCount > 0
              ? 'w-full bg-[#1C1B19] text-white py-4 rounded-2xl text-base font-semibold active:opacity-80 transition-opacity'
              : 'w-full bg-[#F0EFEC] text-[#6E6962] py-4 rounded-2xl text-base font-semibold cursor-default'
          }
        >
          내 비전보드 한눈에 보기 →
        </button>
        {showCollageHint && (
          <p className="text-[11px] text-[#6E6962] text-center mt-2 animate-fadeIn">
            비전보드 사진을 1개 이상 올리면 활성화돼요.
          </p>
        )}
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
