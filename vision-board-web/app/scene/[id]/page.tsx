'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSection } from '@/lib/questions';
import { loadBoard, saveSectionScene, saveMiniStory, saveTargetDate, incrementDiaryRegen } from '@/lib/storage';
import { getTargetDate, getTargetYear, formatDiaryDate } from '@/lib/targetDate';
import { SectionId, ExtractedSlots, BoardData } from '@/lib/types';
import { SLOT_KEY_LABELS } from '@/lib/slotLabels';
import { josaOnly } from '@/lib/josa';
import ProcessBar from '@/components/ProcessBar';
import ChatBubble from '@/components/ChatBubble';
import InlineInput from '@/components/InlineInput';
import SlotValue from '@/components/SlotValue';
import { renderStory, BOLD_EDIT_HINT } from '@/components/StoryModal';

// 미래의 하루 + 스토리 통합 페이지 (v7.0-r2) — 구 /moment 흡수.
// v8.0 가이드 단순화 — 기본 노출은 질문+예시 패널+입력창뿐. 칩·접이식 안내·힌트 행 제거,
// 막힐 때의 도움은 '답변 도와줘' 버튼 하나로 (sceneStep.helpQuestions 연결).
export default function ScenePage() {
  const router = useRouter();
  const params = useParams();
  const sectionId = Number(params.id) as SectionId;
  const section = getSection(sectionId);

  const [board, setBoard] = useState<BoardData | null>(null);
  const [slots, setSlots] = useState<Partial<ExtractedSlots>>({});
  const [sceneInput, setSceneInput] = useState('');
  const [sceneText, setSceneText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const [story, setStory] = useState('');
  const [storyLoading, setStoryLoading] = useState(false);
  const [storyFailed, setStoryFailed] = useState(false);
  const [additionalInput, setAdditionalInput] = useState('');
  const [showAdditional, setShowAdditional] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [usedAdditional, setUsedAdditional] = useState(false);
  const [editingStory, setEditingStory] = useState(false);
  const [storyDraft, setStoryDraft] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [editingDate, setEditingDate] = useState(false);
  // 재생성("하루 다시 쓰기"+"더 담고 싶은 장면") 합산 카운터 — 2회 이후엔 직접 수정만 권한다 (v7.4)
  const [regenCount, setRegenCount] = useState(0);
  const isRewriteRef = useRef(false);
  // ?rewrite=1 — 답변 변경 후 "새 답으로 다시 쓸래" 진입: 일기만 자동 재생성, 사진 불변 (v8.1)
  const [rewritePending, setRewritePending] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 잘못된 id로 진입하면 b.sections[sectionId]가 undefined라 크래시 — 대시보드로 (v7.4 감사 H3)
    if (!section) {
      router.replace('/dashboard');
      return;
    }
    const b = loadBoard();
    setBoard(b);
    setTargetDate(getTargetDate(b));
    const sec = b.sections[sectionId];
    setRegenCount(sec.diaryRegenCount ?? 0);
    if (sec.extractedSlots) setSlots(sec.extractedSlots);
    if (sec.sceneText) {
      if (sec.miniStory) {
        // 하루·스토리 모두 완료 — 결과 화면으로
        setSceneText(sec.sceneText);
        setSubmitted(true);
        setStory(sec.miniStory);
        // useSearchParams는 Suspense 바운더리를 요구하므로 클라이언트 마운트에서 직접 파싱
        const query = new URLSearchParams(window.location.search);
        if (query.get('rewrite') === '1') {
          // 새로고침 재트리거 방지 — 재생성은 진입 1회만
          history.replaceState(null, '', window.location.pathname);
          setRewritePending(true);
        }
      } else {
        // 하루만 쓰고 이탈(또는 v2 병합 마이그레이션) — 입력을 프리필해 이어서 쓰게
        setSceneInput(sec.sceneText);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId]);

  // rewrite 트리거는 slots·targetDate 상태 커밋 후에 — 마운트 이펙트에서 바로 부르면 빈 슬롯으로 생성된다
  useEffect(() => {
    if (!rewritePending || !board) return;
    setRewritePending(false);
    runStory(sceneText);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rewritePending, board]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(raf);
  }, [submitted, story, storyLoading]);

  async function generateStory(scene: string, additional?: string): Promise<string> {
    // 느린/멈춘 연결에서 무한 로딩을 막는 타임아웃 (v7.4 감사 M2)
    // v8.4 — 품질 게이트가 최대 2회 생성하므로 /finish(30s) 관례로 상향
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch('/api/story/section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionTitle: section?.title.split(' — ')[0] ?? '',
          extractedSlots: slots,
          sceneText: scene,
          targetDate,
          additionalInput: additional,
        }),
        signal: controller.signal,
      });
      const data = await res.json();
      return (data.story as string) ?? '';
    } catch {
      return '';
    } finally {
      clearTimeout(timer);
    }
  }

  async function runStory(scene: string, additional?: string) {
    // 일기 날짜 확정 — 첫 스토리 생성 시점에 저장해 전 섹션 일기가 같은 날짜를 공유
    if (targetDate) saveTargetDate(targetDate);
    setStoryLoading(true);
    setStoryFailed(false);
    const result = await generateStory(scene, additional);
    if (result) {
      setStory(result);
      saveMiniStory(sectionId, result);
    } else {
      setStoryFailed(true);
    }
    setStoryLoading(false);
  }

  function handleSubmit(text: string) {
    setSceneText(text);
    setSubmitted(true);
    setShowHelp(false);
    saveSectionScene(sectionId, text);
    // 다시 쓰기 경유 재제출은 재생성으로 합산 — 첫 생성·실패 재시도는 세지 않는다
    if (isRewriteRef.current) {
      isRewriteRef.current = false;
      setRegenCount(incrementDiaryRegen(sectionId));
    }
    runStory(text);
  }

  async function handleRegenerate() {
    if (!additionalInput.trim()) return;
    setRegenerating(true);
    const result = await generateStory(sceneText, additionalInput);
    if (result) {
      setStory(result);
      saveMiniStory(sectionId, result);
      setAdditionalInput('');
      setShowAdditional(false);
      setUsedAdditional(true);
      setRegenCount(incrementDiaryRegen(sectionId));
    }
    setRegenerating(false);
  }

  function handleRewriteScene() {
    // 하루 다시 쓰기 — 입력으로 복귀 (스토리는 다시 제출 시 재생성)
    isRewriteRef.current = true;
    setSceneInput(sceneText);
    setSubmitted(false);
    setStory('');
    setEditingStory(false);
    setShowAdditional(false);
  }

  if (!section || !board) return null;

  const sceneStep = section.sceneStep;
  const keyword = slots.keyword || '';
  const targetYear = getTargetYear(board);
  // v7.6 — "질문은 끝났어" 예고는 섹션 채팅의 브리지 버블로 이동, 여기선 짧은 재인사만
  const cushionText = keyword
    ? `좋아, '${keyword}'${josaOnly(keyword, '이/가')} 이루어진 ${targetYear}년의 하루야. 이 하루가 비전보드의 핵심이 될 거야.`
    : `좋아, 지금까지 말해준 것들이 이루어진 ${targetYear}년의 하루야. 이 하루가 비전보드의 핵심이 될 거야.`;

  const sceneQuestion = '그날의 하루, 어디서 뭘 하고 있어? 느낌과 상황을 구체적으로 써봐.';

  const slotEntries = (Object.keys(SLOT_KEY_LABELS) as Array<keyof ExtractedSlots>).filter(
    (k) => slots[k]
  );
  if (!section) return null;

  const sectionName = section.title.split(' — ')[0];

  return (
    <div className="min-h-screen flex flex-col max-w-md md:max-w-xl mx-auto w-full">
      <ProcessBar board={board} />

      <header className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-[#F5F5F3]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/section/${sectionId}`)}
            aria-label="대화 단계로 돌아가기"
            className="text-[#6E6962] text-title leading-none mr-1 active:opacity-60"
          >
            ←
          </button>
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: section.color }} />
          <span className="font-semibold text-body">{sectionName} · 미래 일기</span>
        </div>
        <button onClick={() => router.push('/dashboard')} className="text-caption text-[#6E6962] py-1">
          대시보드로
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6">

        {/* 이전 답변 컨텍스트 카드 */}
        {slotEntries.length > 0 && (
          <div className="mb-4 rounded-2xl border border-[#E5E3DF] bg-white overflow-hidden">
            <div className="px-4 pt-3 pb-1">
              <p className="text-micro font-semibold text-[#6E6962] uppercase tracking-wide mb-2.5">
                네가 말해준 것들
              </p>
              <div className="space-y-1.5 pb-3">
                {slotEntries.map((key) => (
                  <div key={key} className="flex items-start gap-2">
                    <span
                      className="text-micro font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0 mt-0.5"
                      style={{
                        backgroundColor: key === 'keyword' ? section.color + '18' : '#F5F5F3',
                        color: key === 'keyword' ? section.color : '#9CA3AF',
                      }}
                    >
                      {SLOT_KEY_LABELS[key]}
                    </span>
                    <SlotValue
                      value={slots[key] ?? ''}
                      className="text-body leading-relaxed flex-1"
                      style={{ fontWeight: key === 'keyword' ? 600 : 400 }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 쿠션 버블 */}
        <ChatBubble role="assistant" content={cushionText} />

        {/* 질문 버블 — 하루 그리기 단일 질문 (구 /moment '어떤 장면이 눈에 들어와?' 흡수) */}
        <ChatBubble role="assistant" content={sceneQuestion} />

        {!submitted && (
          <>
            {/* 답변 도와줘 패널 — 막힐 때만 여는 각도 질문 (v8.0, /section과 같은 패턴) */}
            {showHelp && (
              <div className="mt-3 rounded-2xl bg-[#F5F5F3] px-4 py-3">
                <p className="text-caption font-semibold text-[#1C1B19] mb-2">
                  이런 각도로 생각해봐
                </p>
                <div className="space-y-1.5">
                  {sceneStep.helpQuestions.map((hq) => (
                    <p key={hq} className="text-caption text-[#6B7280] leading-relaxed">
                      ○ {hq}
                    </p>
                  ))}
                </div>
                <button
                  onClick={() => setShowHelp(false)}
                  className="text-caption text-[#6E6962] underline underline-offset-2 mt-2 active:opacity-60"
                >
                  닫기
                </button>
              </div>
            )}

            {/* 입력창 — 기본 노출은 예시 패널+입력창뿐, 프리필·다시쓰기를 위해 controlled 모드 */}
            <InlineInput
              onSubmit={handleSubmit}
              placeholder={sceneStep.placeholder || '순간 2~3개면 충분해 — 어디서, 뭘 하는지까지.'}
              examples={sceneStep.examples}
              onHelp={() => setShowHelp((v) => !v)}
              value={sceneInput}
              onChangeText={setSceneInput}
            />
          </>
        )}

        {/* 제출 후 — 내가 그린 하루 + 스토리 */}
        {submitted && (
          <>
            <ChatBubble role="user" content={sceneText} />

            {storyLoading ? (
              <div className="mt-3 rounded-2xl border border-[#E5E3DF] bg-white px-4 py-4">
                <p className="text-caption text-[#6E6962] mb-2">잠깐, 하루를 그려볼게...</p>
                <div className="h-2 bg-[#F5F5F3] rounded-full animate-pulse" />
                <div className="h-2 bg-[#F5F5F3] rounded-full animate-pulse mt-2 w-3/4" />
              </div>
            ) : storyFailed ? (
              <div className="mt-3 rounded-2xl border border-[#E5E3DF] bg-white px-4 py-4">
                <p className="text-caption text-[#6E6962] mb-3">
                  스토리를 그리다가 잠깐 놓쳤어. 다시 해볼게.
                </p>
                <button
                  onClick={() => runStory(sceneText)}
                  className="w-full py-3 rounded-xl text-body border border-[#E5E3DF] bg-white text-[#374151]"
                >
                  다시 그려줘
                </button>
              </div>
            ) : story ? (
              <>
                <div
                  className="mt-3 rounded-2xl border px-4 py-4 mb-3"
                  style={{ borderColor: section.color + '30', backgroundColor: section.color + '08' }}
                >
                  {/* 일기 날짜 헤더 (v7.0-r3) — 자동 제안(+3년), 탭하면 수정. 전 섹션 일기가 같은 날짜 공유 */}
                  <div className="mb-2">
                    {editingDate ? (
                      <>
                        <input
                          type="date"
                          value={targetDate}
                          onChange={(e) => {
                            if (!e.target.value) return;
                            setTargetDate(e.target.value);
                            saveTargetDate(e.target.value);
                          }}
                          onBlur={() => setEditingDate(false)}
                          autoFocus
                          className="text-caption font-semibold bg-white border border-[#E5E3DF] rounded-lg px-2 py-1 outline-none"
                          style={{ color: section.color }}
                        />
                        <p className="text-micro text-[#C9C5BE] mt-1">
                          모든 영역의 일기에 같은 날짜가 적혀.
                        </p>
                      </>
                    ) : (
                      <button
                        onClick={() => setEditingDate(true)}
                        className="flex items-center gap-1.5 active:opacity-70"
                        aria-label="일기 날짜 수정"
                      >
                        <span className="text-caption font-semibold" style={{ color: section.color }}>
                          {targetDate ? formatDiaryDate(targetDate) : ''}
                        </span>
                        <span className="text-micro text-[#C9C5BE]" aria-hidden="true">✏️</span>
                      </button>
                    )}
                  </div>
                  {editingStory ? (
                    <>
                      <textarea
                        value={storyDraft}
                        onChange={(e) => setStoryDraft(e.target.value)}
                        rows={10}
                        autoFocus
                        className="w-full text-body leading-relaxed rounded-xl border border-[#E5E3DF] bg-white px-3 py-2.5 resize-none focus:outline-none focus:border-[#C9C5BE]"
                      />
                      <p className="text-micro text-[#C9C5BE] mt-1 mb-2">{BOLD_EDIT_HINT}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const next = storyDraft.trim();
                            if (!next) return;
                            setStory(next);
                            saveMiniStory(sectionId, next);
                            setEditingStory(false);
                          }}
                          disabled={!storyDraft.trim()}
                          className="flex-1 py-2 rounded-lg text-caption font-semibold text-white disabled:opacity-40"
                          style={{ backgroundColor: section.color }}
                        >
                          저장
                        </button>
                        <button
                          onClick={() => setEditingStory(false)}
                          className="px-4 py-2 rounded-lg text-caption text-[#6E6962] border border-[#E5E3DF]"
                        >
                          취소
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="text-body leading-relaxed">{renderStory(story)}</p>
                  )}
                </div>

                {!editingStory && (
                  <div className="mb-3">
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <button
                        onClick={() => { setStoryDraft(story); setEditingStory(true); setShowAdditional(false); }}
                        className="text-caption text-[#6E6962] underline"
                      >
                        직접 수정하기
                      </button>
                      {/* 재생성은 합산 2회까지 — 이후엔 직접 수정이 더 정확하다 (v7.4) */}
                      {regenCount < 2 && (
                        <>
                          {!usedAdditional && !showAdditional && (
                            <button
                              onClick={() => setShowAdditional(true)}
                              className="text-caption text-[#6E6962] underline"
                            >
                              더 담고 싶은 장면이 있어요
                            </button>
                          )}
                          <button
                            onClick={handleRewriteScene}
                            className="text-caption text-[#6E6962] underline"
                          >
                            하루 다시 쓰기
                          </button>
                        </>
                      )}
                    </div>
                    {regenCount >= 2 && (
                      <p className="text-micro text-[#9CA3AF] mt-1.5 leading-relaxed">
                        새로 쓰기는 여기까지. 이제부터는 네 손으로 다듬는 게 제일 정확해 — 위의
                        &lsquo;직접 수정하기&rsquo;로 고쳐봐.
                      </p>
                    )}
                  </div>
                )}

                {!editingStory && showAdditional && (
                  <div className="mb-3">
                    <textarea
                      value={additionalInput}
                      onChange={(e) => setAdditionalInput(e.target.value)}
                      placeholder="예: 친구와 저녁 먹는 장면, 아침 커피 한 잔..."
                      className="w-full rounded-2xl border border-[#E5E3DF] bg-white px-4 py-3 text-body leading-relaxed resize-none focus:outline-none focus:border-[#C9C5BE] mb-2"
                      rows={2}
                    />
                    <button
                      onClick={handleRegenerate}
                      disabled={!additionalInput.trim() || regenerating}
                      className="w-full py-3 rounded-xl text-body border border-[#E5E3DF] bg-white text-[#374151] disabled:opacity-40"
                    >
                      {regenerating ? '다시 쓰는 중...' : '다시 써줘'}
                    </button>
                  </div>
                )}

                {!editingStory && (
                  <button
                    onClick={() => router.push(`/scenes/${sectionId}`)}
                    className="w-full py-3.5 rounded-xl text-body font-medium text-white mb-3"
                    style={{ backgroundColor: section.color }}
                  >
                    이 하루에 어울리는 사진 담으러 가기 →
                  </button>
                )}
              </>
            ) : null}
          </>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
