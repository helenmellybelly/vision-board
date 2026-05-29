'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSection } from '@/lib/questions';
import { SECTIONS } from '@/lib/questions';
import { loadBoard, saveSectionSceneTexts, saveSectionImage, markSectionComplete } from '@/lib/storage';
import { BoardData, Section, SlotId, SectionId } from '@/lib/types';
import ProcessBar from '@/components/ProcessBar';

type Step = 'intro' | 'scene' | 'images' | 'done';

const SCENE_SUGGESTIONS: Record<number, string[]> = {
  1: [
    '{keyword}이 느껴지는 아침, 어떤 공간에서 혼자 조용히 앉아 있어.',
    '오래된 친구를 만났는데 "많이 달라졌다"는 말을 듣는 순간.',
    '내가 진짜 하고 싶은 걸 하고 있는 하루의 어느 한 장면.',
  ],
  2: [
    '{keyword}이 느껴지는 날, 가장 먼저 어떤 행동을 하고 있어?',
    '몸 상태가 딱 좋은 어느 날 아침, 기분 좋게 하루를 시작하는 장면.',
    '내가 원하는 에너지로 가득 찬 하루의 중간 어느 순간.',
  ],
  3: [
    '{keyword}이 있는 식탁, 함께 있는 사람들의 얼굴이 편안해 보여.',
    '소중한 사람에게 "네 덕분에"라는 말을 듣거나 하는 장면.',
    '아무 말 없이 옆에 있어도 편한 사람과 함께하는 조용한 순간.',
  ],
  4: [
    '{keyword}이 느껴지는 출근길 또는 작업을 시작할 때의 장면.',
    '내가 만든 무언가를 누군가가 좋아하거나 인정해주는 순간.',
    '퇴근 후 오늘 하루가 의미 있었다고 느끼며 마무리하는 장면.',
  ],
  5: [
    '{keyword}이 있는 삶, 지갑 걱정 없이 하고 싶은 걸 선택하는 순간.',
    '내가 번 돈으로 의미 있는 무언가에 쓰는 장면.',
    '재정적으로 여유 있다는 걸 처음 실감하는 어느 평범한 하루.',
  ],
  6: [
    '{keyword}이 느껴지는 공간에서, 아침에 눈을 떠 주위를 둘러보는 장면.',
    '집에 들어서는 순간 "아, 여기 내 공간이다" 하고 느끼는 순간.',
    '내가 꿈꾸는 환경에서 가장 좋아하는 시간을 보내는 장면.',
  ],
};

function buildSuggestions(sectionId: number, keyword: string): string[] {
  const templates = SCENE_SUGGESTIONS[sectionId] || [];
  const kw = keyword || '그 감각';
  return templates.map((t) => t.replace(/{keyword}/g, kw));
}

export default function SceneSectionPage() {
  const router = useRouter();
  const params = useParams();
  const sectionId = Number(params.id) as SectionId;

  const section = getSection(sectionId);
  const [board, setBoard] = useState<BoardData | null>(null);
  const [step, setStep] = useState<Step>('intro');
  const [sceneTexts, setSceneTexts] = useState<string[]>(['', '', '']);
  const [images, setImages] = useState<(string | null)[]>([null, null, null]);
  const [answersExpanded, setAnswersExpanded] = useState(true);
  const [imageMode, setImageMode] = useState<'upload' | 'suggest'>('upload');
  const [suggestions, setSuggestions] = useState<string[]>(['', '', '']);

  const refreshBoard = useCallback(() => setBoard(loadBoard()), []);

  useEffect(() => {
    const b = loadBoard();
    setBoard(b);
    const saved = b.sections[sectionId]?.sceneTexts;
    if (saved && saved.length === 3) {
      setSceneTexts([...saved]);
      if (b.sections[sectionId]?.status !== 'completed') {
        setStep('images');
      }
    } else if (b.sections[sectionId]?.sceneText) {
      setSceneTexts([b.sections[sectionId].sceneText!, '', '']);
    }
    const savedImgs = b.sections[sectionId]?.images;
    if (savedImgs?.some((img) => img !== null)) {
      setImages([...savedImgs]);
    }
  }, [sectionId]);

  if (!section || !board) return null;

  const sectionData = board.sections[sectionId];
  const keyword = sectionData.slots[2 as SlotId]?.text || '';

  function handleStartScene() {
    const built = buildSuggestions(sectionId, keyword);
    setSuggestions(built);
    setStep('scene');
  }

  function handleSceneSave() {
    saveSectionSceneTexts(sectionId, sceneTexts);
    refreshBoard();
    setStep('images');
  }

  function handleFileChange(index: number, file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const updated = [...images];
      updated[index] = e.target?.result as string;
      setImages(updated);
    };
    reader.readAsDataURL(file);
  }

  function removeImage(index: number) {
    const updated = [...images];
    updated[index] = null;
    setImages(updated);
  }

  function handleImagesDone() {
    images.forEach((img, i) => saveSectionImage(sectionId, i, img));
    markSectionComplete(sectionId);
    refreshBoard();
    setStep('done');
  }

  const hasAnyScene = sceneTexts.some((t) => t.trim());
  const progressLabel = `${sectionId}/6`;

  const otherKeywords = SECTIONS.filter((s) => s.id !== sectionId)
    .map((s) => board.sections[s.id]?.slots[2 as SlotId]?.text)
    .filter(Boolean) as string[];

  const slot1 = sectionData.slots[1 as SlotId]?.text?.trim();
  const slot2 = sectionData.slots[2 as SlotId]?.text?.trim();
  const slot3 = sectionData.slots[3 as SlotId]?.text?.trim();
  const slot5 = sectionData.slots[5 as SlotId]?.text?.trim();

  const nextSection = SECTIONS.find(s => s.id === sectionId + 1);

  // 완료된 섹션 수 (done step 진입 시 갱신된 board 기준)
  const completedCount = Object.values(board.sections).filter(s => s.status === 'completed').length;

  return (
    <main className="min-h-screen flex flex-col max-w-md mx-auto w-full">
      <ProcessBar board={board} />
      <header className="flex items-center gap-3 px-6 pt-2 pb-4">
        <button
          onClick={() => step === 'intro' ? router.push('/review') : setStep(step === 'images' ? 'scene' : step === 'done' ? 'images' : 'intro')}
          className="p-2 -ml-2 text-[#6B7280] text-xl active:opacity-60"
        >
          ‹
        </button>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: section.color }} />
          <span className="font-semibold text-sm">{section.title.split(' — ')[0]}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-[#9CA3AF]">장면 {progressLabel}</span>
          <div className="flex gap-1">
            {(['scene', 'images'] as const).map((s, i) => (
              <div
                key={s}
                className="w-5 h-1 rounded-full"
                style={{ backgroundColor: (step === 'images' || step === 'done' ? 1 : 0) >= i ? section.color : '#E5E3DF' }}
              />
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 px-6 pb-10">

        {/* ── INTRO 스텝 ── */}
        {step === 'intro' && (
          <div className="flex flex-col min-h-[calc(100vh-140px)] animate-fadeIn">
            <div className="flex-1 space-y-5">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: section.lightColor, color: section.color }}
              >
                장면 그리기
              </span>

              <div>
                <h2 className="text-xl font-bold leading-snug mb-2">
                  {section.title.split(' — ')[0]} 섹션의 장면을 그릴 거야
                </h2>
                <p className="text-sm text-[#6B7280] leading-relaxed">
                  지금까지 네가 답한 것들 — 원하는 것, 방향 키워드, 이뤄졌을 때의 느낌 — 을 담아서 구체적인 장면으로 만드는 단계야.
                </p>
              </div>

              {/* 이 섹션에서 답한 것들 */}
              <div className="rounded-2xl p-4 space-y-2" style={{ backgroundColor: section.lightColor }}>
                <p className="text-xs font-semibold" style={{ color: section.color }}>
                  지금까지 쓴 것들
                </p>
                {([{ id: 1 as SlotId, label: '지금의 나', text: slot1 }, { id: 2 as SlotId, label: '키워드', text: slot2 }, { id: 3 as SlotId, label: '원해', text: slot3 }, { id: 5 as SlotId, label: '이뤄졌을때', text: slot5 }]).map(({ id, label, text }) => {
                  if (!text) return null;
                  return (
                    <div key={id} className="flex gap-2">
                      <span className="text-[10px] font-semibold text-[#9CA3AF] w-16 shrink-0 pt-0.5">{label}</span>
                      <span className="text-xs text-[#1C1B19] leading-relaxed">{text}</span>
                    </div>
                  );
                })}
              </div>

              {/* 다른 섹션 키워드 */}
              {otherKeywords.length > 0 && (
                <div>
                  <p className="text-xs text-[#9CA3AF] mb-2">다른 섹션에서 쓴 키워드들도 함께 담겨 있어</p>
                  <div className="flex flex-wrap gap-1.5">
                    {otherKeywords.map((kw, i) => (
                      <span
                        key={i}
                        className="text-xs px-2 py-0.5 rounded-full bg-[#F3F4F6] text-[#6B7280]"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-2xl bg-white border border-[#E5E3DF] p-4">
                <p className="text-xs font-semibold text-[#1C1B19] mb-1">장면 그리기는 이렇게 해</p>
                <ul className="space-y-1.5">
                  <li className="flex gap-2 text-xs text-[#6B7280]">
                    <span className="shrink-0">1.</span>
                    <span>이미지 1장당 장면 1개야 — 총 3개의 장면을 쓰게 돼.</span>
                  </li>
                  <li className="flex gap-2 text-xs text-[#6B7280]">
                    <span className="shrink-0">2.</span>
                    <span>각 장면에 예시가 있어. Tab 키로 채우거나 직접 써도 돼.</span>
                  </li>
                  <li className="flex gap-2 text-xs text-[#6B7280]">
                    <span className="shrink-0">3.</span>
                    <span>쓴 장면을 바탕으로 어울리는 사진을 찾아 담으면 돼.</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-4">
              <button
                onClick={handleStartScene}
                className="w-full py-4 rounded-2xl text-base font-semibold text-white transition-all"
                style={{ backgroundColor: section.color }}
              >
                시작할게 →
              </button>
            </div>
          </div>
        )}

        {/* ── SCENE 스텝 ── */}
        {step === 'scene' && (
          <div className="flex flex-col min-h-[calc(100vh-140px)] animate-fadeIn">
            <div className="flex-1 space-y-4">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: section.lightColor, color: section.color }}
              >
                장면 그리기
              </span>

              {/* 답변 접기/펼치기 패널 */}
              <div className="rounded-2xl overflow-hidden border" style={{ borderColor: section.color + '30' }}>
                <button
                  onClick={() => setAnswersExpanded(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                  style={{ backgroundColor: section.lightColor }}
                >
                  <span className="text-xs font-semibold" style={{ color: section.color }}>지금까지 쓴 것들</span>
                  <span className="text-xs text-[#9CA3AF]">{answersExpanded ? '접기 ▲' : '펼치기 ▼'}</span>
                </button>
                {answersExpanded && (
                  <div className="px-4 py-3 space-y-2" style={{ backgroundColor: section.lightColor + '60' }}>
                    {([{ label: '지금의 나', text: slot1 }, { label: '키워드', text: slot2 }, { label: '원해', text: slot3 }, { label: '이뤄졌을때', text: slot5 }]).map(({ label, text }) => {
                      if (!text) return null;
                      return (
                        <div key={label} className="flex gap-2">
                          <span className="text-[10px] font-semibold text-[#9CA3AF] w-16 shrink-0 pt-0.5">{label}</span>
                          <span className="text-xs text-[#1C1B19] leading-relaxed">{text}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <p className="text-base font-bold leading-snug mb-1">
                  이 내용이 이루어진 하루의 장면을 3개 그려봐.
                </p>
                <p className="text-xs text-[#9CA3AF]">
                  상상되는 장면을 짧게 써봐. Tab으로 예시를 불러올 수도 있어.
                </p>
              </div>

              {/* 3개 장면 textarea */}
              {[0, 1, 2].map((i) => (
                <div key={i}>
                  <p className="text-xs font-semibold text-[#9CA3AF] mb-1.5">장면 {i + 1}</p>
                  <textarea
                    value={sceneTexts[i]}
                    onChange={(e) => {
                      const updated = [...sceneTexts];
                      updated[i] = e.target.value;
                      setSceneTexts(updated);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Tab' && !sceneTexts[i].trim() && suggestions[i]) {
                        e.preventDefault();
                        const updated = [...sceneTexts];
                        updated[i] = suggestions[i];
                        setSceneTexts(updated);
                      }
                    }}
                    rows={3}
                    className="w-full bg-white border rounded-2xl p-3 text-sm placeholder-[#C4C2BE] focus:outline-none transition-colors leading-relaxed"
                    style={{
                      borderColor: sceneTexts[i].trim() ? section.color + '60' : '#E5E3DF',
                    }}
                    placeholder={suggestions[i] || `장면 ${i + 1}을 직접 써봐...`}
                  />
                  {!sceneTexts[i].trim() && suggestions[i] && (
                    <button
                      onClick={() => {
                        const updated = [...sceneTexts];
                        updated[i] = suggestions[i];
                        setSceneTexts(updated);
                      }}
                      className="mt-1 text-xs text-[#9CA3AF] underline"
                    >
                      ↹ 예시 채우기
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-4">
              <button
                onClick={handleSceneSave}
                disabled={!hasAnyScene}
                className="w-full py-4 rounded-2xl text-base font-semibold text-white transition-all"
                style={{
                  backgroundColor: hasAnyScene ? section.color : '#D1D5DB',
                  cursor: hasAnyScene ? 'pointer' : 'not-allowed',
                }}
              >
                이제 사진으로 담아볼래
              </button>
              <button
                onClick={() => {
                  saveSectionSceneTexts(sectionId, sceneTexts);
                  setStep('images');
                }}
                className="w-full py-2 text-sm text-[#9CA3AF]"
              >
                잠시 스킵할게요
              </button>
            </div>
          </div>
        )}

        {/* ── IMAGES 스텝 ── */}
        {step === 'images' && (
          <div className="flex flex-col min-h-[calc(100vh-140px)] animate-fadeIn">
            <div className="flex-1 space-y-4">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: section.lightColor, color: section.color }}
              >
                이미지 찾기
              </span>

              <div>
                <h2 className="text-base font-bold leading-snug mb-1">
                  각 장면에 어울리는 사진을 찾아봐.
                </h2>
                <p className="text-xs text-[#9CA3AF]">장면 1개당 사진 1장 — 총 3장이야.</p>
              </div>

              {/* 입력 방식 탭 */}
              <div className="flex gap-1 bg-[#F3F4F6] rounded-xl p-1">
                <button
                  onClick={() => setImageMode('upload')}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    backgroundColor: imageMode === 'upload' ? '#fff' : 'transparent',
                    color: imageMode === 'upload' ? '#1C1B19' : '#9CA3AF',
                    boxShadow: imageMode === 'upload' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  + 사진 업로드
                </button>
                <button
                  onClick={() => setImageMode('suggest')}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    backgroundColor: imageMode === 'suggest' ? '#fff' : 'transparent',
                    color: imageMode === 'suggest' ? '#1C1B19' : '#9CA3AF',
                    boxShadow: imageMode === 'suggest' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  이미지 검색
                </button>
              </div>

              {imageMode === 'suggest' && section && (
                <UnsplashSearch
                  sceneTexts={sceneTexts}
                  keyword={keyword}
                  section={section}
                  images={images}
                  onSelect={(index, url) => {
                    const updated = [...images];
                    updated[index] = url;
                    setImages(updated);
                  }}
                />
              )}

              {/* 장면 + 이미지 슬롯 3세트 */}
              <div className="space-y-4">
                {[0, 1, 2].map((i) => (
                  <div key={i}>
                    {sceneTexts[i]?.trim() && (
                      <p className="text-xs text-[#6B7280] leading-relaxed mb-2 line-clamp-2">
                        <span className="font-semibold text-[#9CA3AF]">장면 {i + 1}  </span>
                        {sceneTexts[i]}
                      </p>
                    )}
                    <div className="aspect-[3/1]">
                      {images[i] ? (
                        <div className="relative w-full h-full">
                          <img
                            src={images[i]!}
                            alt={`이미지 ${i + 1}`}
                            className="w-full h-full object-cover rounded-2xl"
                          />
                          <button
                            onClick={() => removeImage(i)}
                            className="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center text-white text-sm"
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <label
                          className="w-full h-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer active:opacity-70"
                          style={{ borderColor: section.color + '60', backgroundColor: section.lightColor + '60' }}
                        >
                          <span className="text-2xl" style={{ color: section.color }}>+</span>
                          <span className="text-xs text-[#9CA3AF]">사진 {i + 1} 추가</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleFileChange(i, e.target.files?.[0] || null)}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-4">
              <button
                onClick={handleImagesDone}
                className="w-full py-4 rounded-2xl text-base font-semibold text-white active:opacity-80 transition-opacity"
                style={{ backgroundColor: section.color }}
              >
                {images.some((img) => img !== null) ? '이 섹션 완료!' : '일단 완료하고 다음으로'}
              </button>
              <button onClick={() => setStep('scene')} className="w-full py-2 text-sm text-[#9CA3AF]">
                장면 수정하기
              </button>
            </div>
          </div>
        )}

        {/* ── DONE 스텝 — 비전보드 채워지는 화면 ── */}
        {step === 'done' && (
          <div className="flex flex-col items-center min-h-[calc(100vh-140px)] animate-fadeIn pt-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
              style={{ backgroundColor: section.lightColor }}
            >
              <span className="text-2xl">✦</span>
            </div>

            <h2 className="text-2xl font-bold mb-2 text-center">
              {section.title.split(' — ')[0]} 완료!
            </h2>

            {/* 섹션 썸네일 3장 */}
            {images.some(img => img !== null) && (
              <div className="w-full grid grid-cols-3 gap-2 my-5">
                {images.map((img, i) => (
                  <div key={i} className="aspect-square rounded-xl overflow-hidden" style={{ backgroundColor: section.lightColor }}>
                    {img ? (
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-xs text-[#C4C2BE]">—</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 비전보드 진행 */}
            <div className="w-full mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[#6B7280]">비전보드</span>
                <span className="text-sm font-semibold">{Math.min(completedCount * 3, 18)}/18</span>
              </div>
              <div className="w-full bg-[#E5E3DF] rounded-full h-2 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${(Math.min(completedCount * 3, 18) / 18) * 100}%`,
                    backgroundColor: section.color,
                  }}
                />
              </div>
              <p className="text-xs text-[#9CA3AF] mt-2 text-center">
                {completedCount < 6 ? `${6 - completedCount}개 섹션 남았어` : '모든 섹션 완료! 🎉'}
              </p>
            </div>

            <div className="w-full space-y-3">
              {sectionId < 6 && nextSection ? (
                <button
                  onClick={() => router.push(`/scene/${sectionId + 1}`)}
                  className="w-full py-4 rounded-2xl text-base font-semibold text-white active:opacity-80 transition-opacity"
                  style={{ backgroundColor: nextSection.color }}
                >
                  {nextSection.title.split(' — ')[0]} 장면 그리러 가기 →
                </button>
              ) : (
                <button
                  onClick={() => router.push('/board')}
                  className="w-full py-4 rounded-2xl text-base font-semibold text-white bg-[#1C1B19] active:opacity-80 transition-opacity"
                >
                  내 비전보드 보러 가기 →
                </button>
              )}
              <button
                onClick={() => router.push('/board')}
                className="w-full py-2 text-sm text-[#9CA3AF]"
              >
                비전보드 전체 보기
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

// Unsplash 이미지 검색 컴포넌트
interface UnsplashSearchProps {
  sceneTexts: string[];
  keyword: string;
  section: Section;
  images: (string | null)[];
  onSelect: (index: number, url: string) => void;
}

function UnsplashSearch({ sceneTexts, keyword, section, images, onSelect }: UnsplashSearchProps) {
  const [activeSlot, setActiveSlot] = useState(0);
  const [results, setResults] = useState<{ id: string; thumb: string; regular: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const queryForSlot = (i: number) => {
    const scene = sceneTexts[i]?.trim();
    if (scene) return scene.split(' ').slice(0, 6).join(' ');
    return keyword || '일상 여유 라이프스타일';
  };

  async function search(slotIdx: number) {
    setActiveSlot(slotIdx);
    setLoading(true);
    setError(false);
    try {
      const q = encodeURIComponent(queryForSlot(slotIdx));
      const res = await fetch(`/api/unsplash?q=${q}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setResults(data.photos || []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    search(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3">
      {/* 슬롯 선택 탭 */}
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <button
            key={i}
            onClick={() => search(i)}
            className="flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all"
            style={{
              borderColor: activeSlot === i ? section.color : '#E5E3DF',
              backgroundColor: activeSlot === i ? section.lightColor : '#fff',
              color: activeSlot === i ? section.color : '#9CA3AF',
            }}
          >
            장면 {i + 1}
          </button>
        ))}
      </div>

      {loading && (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl bg-[#F3F4F6] animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <p className="text-xs text-[#9CA3AF] text-center py-4">
          이미지를 불러오지 못했어. (API 키 설정 필요)
        </p>
      )}

      {!loading && !error && results.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {results.slice(0, 9).map((photo) => (
            <button
              key={photo.id}
              onClick={() => onSelect(activeSlot, photo.regular)}
              className={`aspect-square rounded-xl overflow-hidden relative active:opacity-80 transition-opacity ${images[activeSlot] === photo.regular ? 'ring-2' : ''}`}
              style={{ outlineColor: section.color }}
            >
              <img src={photo.thumb} alt="" className="w-full h-full object-cover" />
              {images[activeSlot] === photo.regular && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <span className="text-white text-lg">✓</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      <p className="text-[10px] text-[#C4C2BE] text-center">
        이미지 제공: Unsplash
      </p>
    </div>
  );
}
