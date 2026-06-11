'use client';

import { useState, useRef } from 'react';
import { Section } from '@/lib/types';

interface Props {
  section: Section;
  savedImages: (string | null)[];
  onSave: (images: (string | null)[]) => void;
  onBack: () => void;
}

export default function PhaseImages({ section, savedImages, onSave, onBack }: Props) {
  const [images, setImages] = useState<(string | null)[]>(
    savedImages.length === 3 ? [...savedImages] : [null, null, null]
  );
  const inputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

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

  const hasAny = images.some((img) => img !== null);

  return (
    <div className="flex flex-col min-h-[calc(100vh-120px)] animate-fadeIn">
      <div className="flex-1 space-y-5">
        <div>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: section.lightColor, color: section.color }}
          >
            4단계
          </span>
        </div>

        <h2 className="text-xl font-bold leading-snug">{section.imageHintIntro}</h2>

        <div className="space-y-1.5">
          {section.imageHints.map((hint, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: section.color }}
              />
              <p className="text-sm text-[#6B7280]">{hint}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {images.map((img, i) => (
            <div key={i} className="aspect-square">
              {img ? (
                <div className="relative w-full h-full">
                  <img
                    src={img}
                    alt={`이미지 ${i + 1}`}
                    className="w-full h-full object-cover rounded-2xl"
                  />
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
                  className="w-full h-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-1 active:opacity-70 transition-opacity"
                  style={{ borderColor: section.color + '60' }}
                >
                  <span className="text-xl" style={{ color: section.color }}>+</span>
                  <span className="text-xs text-[#6E6962]">사진 {i + 1}</span>
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

        <p className="text-xs text-[#6E6962] text-center">
          사진은 이 기기에만 저장돼. 지금 고르기 어려우면 나중에 추가해도 돼.
        </p>
      </div>

      <div className="space-y-2 pt-4">
        <button
          onClick={() => onSave(images)}
          className="w-full py-4 rounded-2xl text-base font-semibold text-white active:opacity-80 transition-opacity"
          style={{ backgroundColor: section.color }}
        >
          {hasAny ? '완료' : '일단 완료할게'}
        </button>
        <button onClick={onBack} className="w-full py-2 text-sm text-[#6B7280]">
          이전
        </button>
      </div>
    </div>
  );
}
