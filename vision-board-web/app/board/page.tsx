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
    <main className="h-dvh overflow-hidden flex flex-col max-w-md md:max-w-3xl mx-auto w-full">
      <ProcessBar board={board} />
      {/* 헤더 */}
      <div className="px-4 md:px-6 pt-2 pb-2 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="p-2 -ml-2 text-[#6B7280] active:opacity-60"
          >
            ←
          </button>
          <h1 className="text-title font-bold">내 비전보드</h1>
          <span className="text-body text-[#6E6962] ml-auto">{completedCount}/6</span>
        </div>
        <p className="text-caption text-[#6E6962] pl-8">막연했던 바람이, 생생한 장면이 되는 곳.</p>
      </div>

      {/* 섹션별 이미지 그룹 — 2열, 행은 콘텐츠 높이(auto-rows-min). 잉여 세로 공간은 content-evenly로
          그리드 위·행 사이·아래에 균등 분배 — content-center는 잉여가 상·하단에만 몰려
          부제목 아래/하단 버튼 위 간격이 과대해졌다(v6.18 간격 피드백) */}
      <div className="flex-1 min-h-0 grid grid-cols-2 auto-rows-min content-evenly gap-x-3 gap-y-2 px-4 md:px-6 animate-fadeIn">
          {SECTIONS.map((section) => {
            const sectionData = board.sections[section.id];
            const uploaded = sectionData.uploadedImages ?? [];
            const generated = sectionData.generatedImages ?? [];
            const images: (string | null)[] = [0, 1, 2].map(
              (i) => uploaded[i] || (generated[i] || null)
            );
            const keyword = sectionData.extractedSlots?.keyword ?? sectionData.slots[2 as SlotId]?.text;

            return (
              <div key={section.id} className="flex flex-col">
                {/* 섹션 헤더 — 무스크롤 예산을 위해 한 줄에 압축, 스토리는 아이콘으로 */}
                <div className="flex items-center gap-1.5 mb-2.5 flex-shrink-0">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: section.color }} />
                  <span className="font-semibold text-caption md:text-body whitespace-nowrap">{section.title.split(' — ')[0]}</span>
                  {keyword && (
                    <span
                      className="hidden md:inline-block text-caption px-2 py-0.5 rounded-full font-medium truncate min-w-0"
                      style={{ backgroundColor: section.lightColor, color: section.color }}
                    >
                      {keyword}
                    </span>
                  )}
                  {/* 스토리 — 있으면 헤더 아이콘으로 팝업 */}
                  {sectionData.miniStory && (
                    <StoryModal
                      story={sectionData.miniStory}
                      color={section.color}
                      title={`${section.title.split(' — ')[0]} 스토리`}
                      triggerVariant="icon"
                      onSave={(s) => {
                        saveMiniStory(section.id, s);
                        setBoard(loadBoard());
                      }}
                    />
                  )}
                  {/* 사진만 있고 채팅·스토리가 남았으면 pill로 강조 — 다음 단계를 권유 */}
                  <button
                    onClick={() => router.push(getSectionRoute(sectionData, section.id))}
                    className={
                      shouldHighlightCta(sectionData)
                        ? 'ml-auto text-caption font-semibold px-2.5 py-1 rounded-full min-w-0 truncate active:opacity-70'
                        : 'ml-auto text-caption text-[#6E6962] min-w-0 truncate active:opacity-70'
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

                {/* 이미지 3칸 — 정사각형 고정(세로로 길어지는 문제 방지), 빈 칸은 탭해서 바로 사진 업로드 */}
                <div className="grid grid-cols-3 gap-1.5 flex-shrink-0">
                  {images.map((img, imgIdx) => (
                    <div key={imgIdx} className="relative aspect-square">
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
                              className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/50 text-white text-caption flex items-center justify-center"
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
                          <span className="text-heading leading-none" style={{ color: section.color + '90' }}>+</span>
                          <span className="hidden md:inline text-micro font-medium" style={{ color: section.color + '80' }}>
                            사진 추가
                          </span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
      </div>

      {/* 하단 — 한눈에 보기 (별도 페이지로 이동) */}
      <div className="px-4 md:px-6 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex-shrink-0 animate-fadeIn">
        <button
          onClick={handleCollageClick}
          className={
            collageImageCount > 0
              ? 'w-full bg-[#1C1B19] text-white py-3 rounded-2xl text-heading font-semibold active:opacity-80 transition-opacity'
              : 'w-full bg-[#F0EFEC] text-[#6E6962] py-3 rounded-2xl text-heading font-semibold cursor-default'
          }
        >
          내 비전보드 한눈에 보기 →
        </button>
        {showCollageHint && (
          <p className="text-micro text-[#6E6962] text-center mt-1 animate-fadeIn">
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
