'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSection } from '@/lib/questions';
import { loadBoard, saveSectionScene, saveSectionImage, markSectionComplete } from '@/lib/storage';
import { BoardData, SlotId } from '@/lib/types';

type Step = 'scene' | 'images';

export default function SceneSectionPage() {
  const router = useRouter();
  const params = useParams();
  const sectionId = Number(params.id) as 1 | 2 | 3 | 4 | 5 | 6;

  const section = getSection(sectionId);
  const [board, setBoard] = useState<BoardData | null>(null);
  const [step, setStep] = useState<Step>('scene');
  const [sceneText, setSceneText] = useState('');
  const [images, setImages] = useState<(string | null)[]>([null, null, null]);
  const [showHelp, setShowHelp] = useState(false);
  const inputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  const refreshBoard = useCallback(() => setBoard(loadBoard()), []);

  useEffect(() => {
    const b = loadBoard();
    setBoard(b);
    if (b.sections[sectionId]?.sceneText) {
      setSceneText(b.sections[sectionId].sceneText!);
    }
    const saved = b.sections[sectionId]?.images;
    if (saved?.some((img) => img !== null)) {
      setImages([...saved]);
    }
    // 이미 장면 있으면 이미지 단계로
    if (b.sections[sectionId]?.sceneText && b.sections[sectionId]?.status !== 'completed') {
      setStep('images');
    }
  }, [sectionId]);

  if (!section || !board) return null;

  const sectionData = board.sections[sectionId];
  const keyword = sectionData.slots[2 as SlotId]?.text || '';
  const slot4 = section.slots.find((s) => s.id === 4)!;

  function handleSceneSave() {
    saveSectionScene(sectionId, sceneText);
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
    router.push('/scene');
  }

  return (
    <main className="min-h-screen flex flex-col max-w-md mx-auto w-full">
      <header className="flex items-center gap-3 px-6 pt-10 pb-4">
        <button
          onClick={() => router.push('/scene')}
          className="p-2 -ml-2 text-[#6B7280] text-xl active:opacity-60"
        >
          ‹
        </button>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: section.color }} />
          <span className="font-semibold text-sm">{section.title.split(' — ')[0]}</span>
        </div>
        <div className="ml-auto flex gap-1">
          {(['scene', 'images'] as Step[]).map((s, i) => (
            <div
              key={s}
              className="w-5 h-1 rounded-full"
              style={{ backgroundColor: (step === 'images' ? 1 : 0) >= i ? section.color : '#E5E3DF' }}
            />
          ))}
        </div>
      </header>

      <div className="flex-1 px-6 pb-10">
        {step === 'scene' && (
          <div className="flex flex-col min-h-[calc(100vh-120px)] animate-fadeIn">
            <div className="flex-1 space-y-5">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: section.lightColor, color: section.color }}
              >
                장면 그리기
              </span>

              {keyword && (
                <div className="rounded-2xl p-3 text-center" style={{ backgroundColor: section.lightColor }}>
                  <p className="text-xs text-[#6B7280] mb-1">내 키워드 ②</p>
                  <p className="font-bold text-lg" style={{ color: section.color }}>{keyword}</p>
                </div>
              )}

              <h2 className="text-xl font-bold leading-snug">{slot4.mainQuestion}</h2>

              <div className="text-sm text-[#6B7280] bg-[#F9F8F6] rounded-xl px-3 py-2.5 leading-relaxed">
                <span className="text-xs font-semibold text-[#9CA3AF] mr-1">예)</span>
                {slot4.example}
              </div>

              <textarea
                value={sceneText}
                onChange={(e) => setSceneText(e.target.value)}
                placeholder={slot4.placeholder}
                rows={5}
                className="w-full bg-white border border-[#E5E3DF] rounded-2xl p-4 text-base placeholder-[#C4C2BE] focus:outline-none focus:border-[#1C1B19] transition-colors"
                autoFocus
              />

              <div>
                <button
                  onClick={() => setShowHelp((v) => !v)}
                  className="flex items-center gap-1.5 text-sm text-[#6B7280]"
                >
                  <span>💬</span>
                  <span>{showHelp ? '닫기' : '답변하는데 도움이 필요해요'}</span>
                </button>
                {showHelp && (
                  <div className="mt-3 space-y-2">
                    {slot4.helpQuestions.map((q) => (
                      <div key={q.id} className="p-3 rounded-xl text-sm leading-relaxed" style={{ backgroundColor: section.lightColor }}>
                        {q.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2 pt-4">
              <button
                onClick={handleSceneSave}
                disabled={!sceneText.trim()}
                className="w-full py-4 rounded-2xl text-base font-semibold text-white transition-all"
                style={{
                  backgroundColor: sceneText.trim() ? section.color : '#D1D5DB',
                  cursor: sceneText.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                이제 사진으로 담아볼래
              </button>
              <button
                onClick={() => { saveSectionScene(sectionId, ''); setStep('images'); }}
                className="w-full py-2 text-sm text-[#9CA3AF]"
              >
                잠시 스킵할게요
              </button>
            </div>
          </div>
        )}

        {step === 'images' && (
          <div className="flex flex-col min-h-[calc(100vh-120px)] animate-fadeIn">
            <div className="flex-1 space-y-5">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: section.lightColor, color: section.color }}
              >
                이미지 찾기
              </span>

              <h2 className="text-xl font-bold leading-snug">{section.imageHintIntro}</h2>

              {sceneText && (
                <div className="bg-[#F9F8F6] rounded-2xl p-3 text-sm text-[#6B7280] leading-relaxed line-clamp-3">
                  {sceneText}
                </div>
              )}

              <div className="space-y-1.5">
                {section.imageHints.map((hint, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: section.color }} />
                    <p className="text-sm text-[#6B7280]">{hint}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3">
                {images.map((img, i) => (
                  <div key={i} className="aspect-square">
                    {img ? (
                      <div className="relative w-full h-full">
                        <img src={img} alt={`이미지 ${i + 1}`} className="w-full h-full object-cover rounded-2xl" />
                        <button
                          onClick={() => removeImage(i)}
                          className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center text-white text-xs"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => inputRefs[i].current?.click()}
                        className="w-full h-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-1 active:opacity-70"
                        style={{ borderColor: section.color + '60' }}
                      >
                        <span className="text-xl" style={{ color: section.color }}>+</span>
                        <span className="text-xs text-[#9CA3AF]">사진 {i + 1}</span>
                      </button>
                    )}
                    <input
                      ref={inputRefs[i]}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileChange(i, e.target.files?.[0] || null)}
                    />
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
                {images.some((img) => img !== null) ? '내 보드, 드디어 보고 싶어' : '일단 완료할게'}
              </button>
              <button onClick={() => setStep('scene')} className="w-full py-2 text-sm text-[#9CA3AF]">
                이전
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
