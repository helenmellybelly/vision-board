'use client';

import { useEffect, useRef, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { track } from '@/lib/analytics';
import useFocusTrap from './useFocusTrap';
import { BoardData, CollageLayout, CollageTemplate, SectionId } from '@/lib/types';
import { CollageItem } from '@/lib/collageTemplates';
import { getSection } from '@/lib/questions';
import { findRemoteSlots, normalizeSlots } from '@/lib/imageNormalize';
import {
  WallpaperPreset,
  pickSaveHandle,
  renderBoardLayout,
  saveCanvas,
  writeCanvasToHandle,
} from '@/lib/wallpaper';

interface Props {
  year: string;
  /** 편집 진입 전에 선택한 기기 사이즈 — 이 해상도 그대로 내보낸다(무크롭 WYSIWYG, v6.19) */
  preset: WallpaperPreset;
  /** 화면 보드 그대로 내보내기용 — 현재 템플릿·배치·사진 */
  board: {
    template: CollageTemplate;
    layout: CollageLayout;
    items: CollageItem[];
    bgColor?: string;
    /** 타이틀 모양 전역 설정 (v11) — 없으면 템플릿 기본. 화면 보드와 같은 값을 넘겨야 락스텝이다 */
    title?: BoardData['collageTitle'];
  };
  onClose: () => void;
  /** 빠진 사진을 내 저장소로 수입해 보드가 바뀌었을 때 — 호출부가 보드를 다시 읽는다 (v8.7) */
  onPhotosNormalized?: () => void;
}

export default function WallpaperSheet({ year, preset, board, onClose, onPhotosNormalized }: Props) {
  const trapRef = useFocusTrap<HTMLDivElement>(true, onClose);
  const { status } = useSession();
  const [preview, setPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // 로드 실패로 캔버스에서 빠진 사진 (v8.1, v8.7에서 키까지) — 조용한 누락 대신 저장 전에 알린다
  const [skippedKeys, setSkippedKeys] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importNotice, setImportNotice] = useState('');
  // C 보조 유도 (R2-2) — 저장이 실제로 한 번 성공한 뒤에만 로그인 1줄을 보여준다
  const [savedOnce, setSavedOnce] = useState(false);

  const landscape = preset.w > preset.h;
  // 미리보기로 렌더한 캔버스를 보관 — 저장 시 재렌더(이미지 전체 재로드) 없이 그대로 쓴다 (v8.4)
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cancelledRef = useRef(false);
  // 재진입 가드 (v8.7) — "다시 시도" 연타로 렌더가 겹쳐 마지막 완료분이 캔버스를 덮는 걸 막는다
  const buildingRef = useRef(false);
  const pendingRef = useRef(false);
  const runIdRef = useRef(0);
  const bustRef = useRef(0);

  const skipped = skippedKeys.length;
  // 어느 칸의 사진이 빠졌는지 — 숫자만 보여주면 뭘 고쳐야 할지 알 수 없다 (v8.7)
  const skippedLabels = [
    ...new Set(
      skippedKeys
        .map((key) => Number(/^(\d+)-\d+$/.exec(key)?.[1]))
        .filter((id): id is number => !Number.isNaN(id))
        .map((id) => getSection(id as SectionId))
        .filter(Boolean)
        .map((s) => s!.shortTitle ?? s!.title.split(' — ')[0])
    ),
  ];

  function renderCurrent() {
    return renderBoardLayout(
      board.template,
      board.layout,
      board.items,
      year,
      { w: preset.w, h: preset.h },
      { bust: bustRef.current, bgColor: board.bgColor, title: board.title }
    );
  }

  // 미리보기 생성 — 편집 보드의 배치·스티커를 선택한 해상도 그대로 옮긴다(WYSIWYG)
  // 못 불러온 사진이 있으면 "다시 시도" 버튼이 같은 함수를 재호출한다 (v8.4)
  async function buildPreview(retry = false) {
    // 이미 그리는 중이면 겹쳐 돌리지 않고 "끝나면 한 번 더"로 미룬다 — 사진 목록이 바뀐 요청을
    // 그냥 버리면 방금 고친 사진이 반영되지 않는다
    if (buildingRef.current) {
      pendingRef.current = true;
      return;
    }
    buildingRef.current = true;
    const myRun = ++runIdRef.current;
    // 재시도는 캐시를 우회한다 — 같은 URL을 그대로 다시 부르면 실패가 결정적으로 반복된다
    if (retry) bustRef.current += 1;
    setError('');
    setPreview('');
    setSkippedKeys([]);
    try {
      const rendered = await renderCurrent();
      if (cancelledRef.current || myRun !== runIdRef.current) return;
      canvasRef.current = rendered.canvas;
      setPreview(rendered.canvas.toDataURL('image/jpeg', 0.82));
      setSkippedKeys(rendered.skippedKeys);
    } catch {
      if (!cancelledRef.current && myRun === runIdRef.current) {
        setError('미리보기를 만들지 못했어. 잠시 후 다시 시도해줘.');
      }
    } finally {
      buildingRef.current = false;
      if (pendingRef.current && !cancelledRef.current) {
        pendingRef.current = false;
        void buildPreview();
      }
    }
  }

  // 빠진 사진을 내 저장소로 수입한 뒤 다시 그린다 (v8.7) — 남의 호스트 URL이 원인일 때의 진짜 해결
  async function handleImportMissing() {
    if (importing) return;
    setImporting(true);
    setImportNotice('');
    try {
      const slots = findRemoteSlots(skippedKeys);
      if (slots.length === 0) {
        setImportNotice('이 사진들은 다시 가져올 수 없어. 보드에서 다른 사진으로 바꿔줄래?');
        return;
      }
      const result = await normalizeSlots(slots);
      if (cancelledRef.current) return;
      // 다시 그리기는 itemsKey 변화가 트리거한다 — 여기서 직접 부르면 낡은 props를 쓴다
      if (result.converted > 0) onPhotosNormalized?.();
      if (result.quotaHit) {
        setImportNotice(`${result.converted}장까지 가져왔어. 저장 공간이 부족해 나머지는 사진을 몇 장 지운 뒤 다시 해줘.`);
      } else if (result.expired.length > 0) {
        setImportNotice('일부 사진은 만료돼서 다시 가져올 수 없어. 보드에서 다른 사진으로 바꿔줄래?');
      } else if (result.converted === 0) {
        setImportNotice('사진을 가져오지 못했어. 잠시 후 다시 시도해줘.');
      }
    } finally {
      setImporting(false);
    }
  }

  // 사진 목록이 바뀌면 다시 그린다 (v8.7) — "내 보드로 가져오기"로 슬롯이 내 저장소 이미지로
  // 교체되면 부모가 새 items를 내려주는데, 수입 직후 그 자리에서 다시 그리면 아직 낡은 props를
  // 쓴다(= 방금 고친 사진이 또 빠진다). 재렌더 트리거를 props 변화에 맡겨 그 경합을 없앤다.
  const itemsKey = board.items.map((i) => `${i.key}:${i.src.slice(0, 96)}`).join('|');
  useEffect(() => {
    cancelledRef.current = false;
    void buildPreview();
    return () => {
      cancelledRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey]);

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const filename = `vision-board-${year}-${board.template}-${preset.id}.png`;
      // ⚠️ 위치 선택 대화상자는 클릭 직후(첫 await)에 열어야 한다 — transient user activation
      const picked = await pickSaveHandle(filename);
      if (picked === 'cancelled') return;
      const canvas = canvasRef.current ?? (await renderCurrent()).canvas;
      if (picked === 'unsupported') {
        // 픽커 미지원(모바일·Safari·Firefox) — 기존 공유/다운로드 흐름
        const result = await saveCanvas(canvas, filename);
        if (result === 'cancelled') return;
      } else {
        await writeCanvasToHandle(canvas, picked);
      }
      setSavedOnce(true);
      track('wallpaper_save', { preset: preset.id, template: board.template });
    } catch {
      setError('저장에 실패했어. 다시 시도해줘.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallpaper-title"
        className="bg-white w-full max-w-md rounded-t-3xl px-6 pt-6 pb-8 max-h-[92dvh] overflow-y-auto scroll-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-[#E5E3DF] rounded-full mx-auto mb-5" />
        <h2 id="wallpaper-title" className="text-heading font-bold mb-1">
          {preset.id === 'board' ? '보드 이미지 저장' : landscape ? 'PC 배경화면 저장' : '폰 배경화면 저장'}
        </h2>
        <p className="text-caption text-[#6E6962] mb-3">
          {preset.label} · {preset.w}×{preset.h} — 편집한 그대로 저장돼.
        </p>

        {/* 미리보기 */}
        <div className="relative flex items-center justify-center">
          {preview ? (
            <img
              src={preview}
              alt="배경화면 미리보기"
              className={
                landscape
                  ? 'w-full h-auto rounded-2xl border border-[#E5E3DF]'
                  : 'max-h-[46vh] max-w-full w-auto rounded-2xl border border-[#E5E3DF]'
              }
            />
          ) : (
            <div
              className={`rounded-2xl bg-[#F5F5F3] flex items-center justify-center ${
                landscape ? 'w-full' : 'h-[46vh]'
              }`}
              style={{
                aspectRatio: `${preset.w} / ${preset.h}`,
              }}
            >
              <span className="text-caption text-[#6E6962] animate-pulse">만드는 중...</span>
            </div>
          )}
        </div>

        {skipped > 0 && (
          <div className="mt-3 rounded-2xl bg-[#FEF9C3] px-4 py-3">
            <p className="text-caption text-[#92400E] text-center">
              ⚠️ 사진 {skipped}장{skippedLabels.length > 0 ? ` (${skippedLabels.join(' · ')})` : ''}은 못
              불러와서 빠졌어.
            </p>
            <div className="flex justify-center gap-4 mt-2">
              <button
                onClick={() => void buildPreview(true)}
                disabled={importing}
                className="text-caption font-semibold text-[#92400E] underline disabled:opacity-40 active:opacity-70"
              >
                다시 시도
              </button>
              <button
                onClick={() => void handleImportMissing()}
                disabled={importing}
                className="text-caption font-semibold text-[#92400E] underline disabled:opacity-40 active:opacity-70"
              >
                {importing ? '가져오는 중...' : '내 보드로 가져오기'}
              </button>
            </div>
            {importNotice && (
              <p className="text-caption text-[#92400E] text-center mt-2">{importNotice}</p>
            )}
          </div>
        )}
        {error && <p className="text-caption text-[#B91C1C] mt-3 text-center">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving || !preview}
          className="mt-5 w-full py-4 rounded-2xl text-heading font-semibold text-white disabled:opacity-40 transition-opacity active:opacity-80"
          style={{ backgroundColor: '#1C1B19' }}
        >
          {saving ? '저장 중...' : '이미지로 저장'}
        </button>
        {/* C 보조 유도 (R2-2) — 감정 정점(저장 성공 직후)에서 1줄, 로그인 유저 숨김.
            signIn만 호출하면 동의·병합·동기화는 전역 AccountFlow가 처리, /collage 복귀 */}
        {savedOnce && status !== 'authenticated' && (
          <p className="mt-3 text-caption text-[#6E6962] text-center">
            이 보드, 계속 간직할래? —{' '}
            <button
              onClick={() => {
                track('login_nudge_click', { source: 'wallpaper' });
                void signIn('google', { callbackUrl: '/collage' });
              }}
              className="font-semibold underline text-[#1C1B19] active:opacity-70"
            >
              Google로 저장해두기
            </button>
          </p>
        )}
        <button onClick={onClose} className="mt-2 w-full py-2 text-body text-[#6E6962]">
          닫기
        </button>
      </div>
    </div>
  );
}
