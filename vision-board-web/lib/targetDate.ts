import { BoardData } from './types';

// 비전보드의 목표 날짜(일기 날짜) 단일 소스 (v7.0-r3)
// - 섹션 스토리(일기 헤더)와 콜라주 중앙 연도가 같은 날짜를 공유한다
// - 구 boardYear(연도만)는 마이그레이션 v3가 targetDate로 흡수

const YEARS_AHEAD = 3;

// 로컬 기준 YYYY-MM-DD — new Date('YYYY-MM-DD')는 UTC 파싱이라 역변환 시 parts로 다룬다
function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

// 기본값: 오늘 + 3년 (2월 29일 등은 Date가 자동 보정)
export function defaultTargetDate(): string {
  const now = new Date();
  return toIso(new Date(now.getFullYear() + YEARS_AHEAD, now.getMonth(), now.getDate()));
}

export function getTargetDate(board: BoardData): string {
  if (board.targetDate) return board.targetDate;
  // 레거시 boardYear만 있는 경우 — v3 마이그레이션 전 로드 경합 대비 폴백
  if (board.boardYear) {
    const now = new Date();
    return toIso(new Date(Number(board.boardYear), now.getMonth(), now.getDate()));
  }
  return defaultTargetDate();
}

export function getTargetYear(board: BoardData): string {
  return String(parseIso(getTargetDate(board)).getFullYear());
}

// 연도만 교체 — 콜라주 중앙 연도 편집용
export function withYear(iso: string, year: string): string {
  const d = parseIso(iso);
  const y = Number(year);
  if (!Number.isFinite(y) || y < 1000 || y > 9999) return iso;
  return toIso(new Date(y, d.getMonth(), d.getDate()));
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// "2029년 7월 7일 토요일" — 일기 헤더·스토리 프롬프트 공용
export function formatDiaryDate(iso: string): string {
  const d = parseIso(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS[d.getDay()]}요일`;
}

// 프롬프트에 계절감을 힌트로 — 억지 삽입 방지를 위해 배경 정보로만 전달
export function seasonOf(iso: string): string {
  const m = parseIso(iso).getMonth() + 1;
  if (m >= 3 && m <= 5) return '봄';
  if (m >= 6 && m <= 8) return '여름';
  if (m >= 9 && m <= 11) return '가을';
  return '겨울';
}
