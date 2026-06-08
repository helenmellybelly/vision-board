'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadBoard, markBoardFinished, saveOneSentence, saveFutureDayStory } from '@/lib/storage';
import { SECTIONS } from '@/lib/questions';
import { BoardData } from '@/lib/types';

type FinishPhase = 'pattern' | 'sentence' | 'story-loading' | 'story' | 'complete';

export default function FinishPage() {
  const router = useRouter();
  const [board, setBoard] = useState<BoardData | null>(null);
  const [phase, setPhase] = useState<FinishPhase>('pattern');
  const [sentenceInput, setSentenceInput] = useState('');
  const [story, setStory] = useState('');

  useEffect(() => {
    const b = loadBoard();
    setBoard(b);
    if (!b.finishedAt) markBoardFinished();
    if (b.oneSentence) setSentenceInput(b.oneSentence);
    if (b.futureDayStory) {
      setStory(b.futureDayStory);
      setPhase('story');
    }
  }, []);

  async function generateStory(sentence: string, currentBoard: BoardData) {
    setPhase('story-loading');

    const sectionData = SECTIONS.map((s) => {
      const sec = currentBoard.sections[s.id];
      const slots = sec.extractedSlots || {};
      return {
        title: s.title.split(' — ')[0],
        keyword: slots.keyword || sec.slots[2]?.text,
        want: slots.want || sec.slots[3]?.text,
        feeling: slots.feeling || sec.slots[5]?.text,
        sceneText: sec.sceneText,
        situationText: sec.situationText,
      };
    });

    try {
      const res = await fetch('/api/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName: currentBoard.userName,
          oneSentence: sentence,
          sections: sectionData,
        }),
      });

      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      setStory(data.story);
      saveFutureDayStory(data.story);
      setPhase('story');
    } catch {
      setStory('글 생성에 실패했어. 다시 시도해볼게.');
      setPhase('story');
    }
  }

  function handleSentenceConfirm() {
    const s = sentenceInput.trim();
    if (!s) return;
    saveOneSentence(s);
    if (board) generateStory(s, board);
  }

  if (!board) return null;

  const keywords = SECTIONS.map((s) => {
    const sec = board.sections[s.id];
    const kw = sec.extractedSlots?.keyword || sec.slots[2]?.text;
    return { section: s, kw: kw && !sec.slots[2]?.isDeferred ? kw : null };
  }).filter((x) => x.kw);

  const bucketItems = board.bucketListItems ?? [];

  return (
    <main className="min-h-screen flex flex-col max-w-md mx-auto w-full px-6 py-10 animate-fadeIn">

      {/* 패턴 비추기 */}
      {phase === 'pattern' && (
        <div className="flex-1 flex flex-col justify-center space-y-8">
          <div className="text-center space-y-2">
            <p className="text-4xl">🐿️</p>
            <h1 className="text-2xl font-bold">
              {board.userName ? `${board.userName}, ` : ''}다 됐어.
            </h1>
            <p className="text-[#6B7280]">6가지 영역에서 네가 원하는 삶을 봐.</p>
          </div>

          {keywords.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center">
              {keywords.map(({ section, kw }) => (
                <span
                  key={section.id}
                  className="px-3 py-1.5 rounded-full text-sm font-semibold"
                  style={{ backgroundColor: section.lightColor, color: section.color }}
                >
                  {kw}
                </span>
              ))}
            </div>
          )}

          {bucketItems.length > 0 && (
            <div className="bg-[#F5F5F3] rounded-2xl px-4 py-3">
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-2">
                버킷리스트
              </p>
              <div className="space-y-1">
                {bucketItems.slice(0, 4).map((item, i) => (
                  <p key={i} className="text-sm text-[#6B7280] before:content-['✓'] before:mr-1.5 before:text-[#9CA3AF]">
                    {item}
                  </p>
                ))}
                {bucketItems.length > 4 && (
                  <p className="text-xs text-[#C4C2BE] mt-1">외 {bucketItems.length - 4}개</p>
                )}
              </div>
            </div>
          )}

          <p className="text-sm text-[#6B7280] text-center leading-relaxed">
            이 키워드들 사이에 공통된 실이 있어.<br />네 이야기를 한 문장으로 담아볼게.
          </p>

          <button
            onClick={() => setPhase('sentence')}
            className="w-full py-4 rounded-2xl text-base font-semibold text-white"
            style={{ backgroundColor: '#1C1B19' }}
          >
            한 문장 써보기 →
          </button>
        </div>
      )}

      {/* 한 문장 */}
      {phase === 'sentence' && (
        <div className="flex-1 flex flex-col justify-center space-y-6">
          <div>
            <p className="text-sm text-[#9CA3AF] mb-2">네 비전을 한 문장으로.</p>
            <h2 className="text-2xl font-bold leading-snug">
              3년 뒤 나는<br />어떤 사람으로 살고 있어?
            </h2>
          </div>
          {keywords.length > 0 && (
            <div className="bg-[#F5F5F3] rounded-xl p-3 text-xs text-[#9CA3AF]">
              힌트: {keywords.slice(0, 3).map((x) => x.kw).join(', ')} 같은 단어를 담아봐
            </div>
          )}
          <textarea
            value={sentenceInput}
            onChange={(e) => setSentenceInput(e.target.value)}
            placeholder="예: 여유롭게 내 페이스로, 소중한 사람들과 웃으며 사는 사람."
            className="w-full bg-white border border-[#E5E3DF] rounded-xl px-4 py-3 text-sm leading-relaxed outline-none focus:border-[#1C1B19] transition-colors resize-none"
            rows={3}
          />
          <button
            onClick={handleSentenceConfirm}
            disabled={!sentenceInput.trim()}
            className="w-full py-4 rounded-2xl text-base font-semibold text-white disabled:opacity-40"
            style={{ backgroundColor: '#1C1B19' }}
          >
            이 문장으로 할게 →
          </button>
        </div>
      )}

      {/* 스토리 로딩 */}
      {phase === 'story-loading' && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center animate-pulse"
            style={{ background: 'linear-gradient(135deg, #2D2B29 0%, #1C1B19 100%)' }}
          >
            <span className="text-white text-2xl">🐿️</span>
          </div>
          <p className="text-[#6B7280] text-sm">네 하루를 쓰고 있어...</p>
        </div>
      )}

      {/* 스토리 + 완성 */}
      {phase === 'story' && (
        <div className="flex-1 flex flex-col space-y-6">
          <div className="text-center space-y-1 pt-4">
            <p className="text-sm text-[#9CA3AF]">미래의 하루 이야기</p>
            <h2 className="text-xl font-bold">그 삶이 이루어진 날</h2>
          </div>

          <div className="bg-[#F5F5F3] rounded-2xl p-5 flex-1">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{story}</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => board && generateStory(sentenceInput, board)}
              className="flex-1 py-3 rounded-xl text-sm font-semibold border border-[#E5E3DF] text-[#6B7280]"
            >
              다시 써줘
            </button>
            <button
              onClick={() => setPhase('complete')}
              className="flex-1 py-3 rounded-xl text-sm font-semibold bg-[#1C1B19] text-white"
            >
              비전보드 완성 →
            </button>
          </div>
        </div>
      )}

      {/* 완성물 */}
      {phase === 'complete' && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-8 text-center">
          <div className="space-y-3">
            <p className="text-5xl">🐿️</p>
            <h1 className="text-2xl font-bold">완성됐어.</h1>
            <p className="text-[#6B7280] leading-relaxed text-sm">
              이미지보드 + 미래의 하루 이야기.<br />원하는 삶을 이미지로도 보고 글로도 읽는 거야.
            </p>
          </div>
          <div className="w-full space-y-2.5">
            <button
              onClick={() => router.push('/board')}
              className="w-full py-4 rounded-2xl text-base font-semibold text-white"
              style={{ backgroundColor: '#1C1B19' }}
            >
              비전보드 보기
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full border border-[#E5E3DF] text-[#6B7280] py-3.5 rounded-2xl text-sm font-semibold"
            >
              대시보드로
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
