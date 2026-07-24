import { BoardData } from './types';

/** "첫 보드" 개방 임계값 — 이 수 이상 completed면 /finish·최종 스토리 조기 개방 (v7.8, 오너 확정).
 *  인트로 "먼저 마음 가는 세 곳부터" 권장 범위와 맞춘 값 — 바꿀 땐 그 카피와의 정합도 같이 본다 */
export const FIRST_BOARD_THRESHOLD = 3;

export function countCompleted(board: BoardData): number {
  return Object.values(board.sections).filter((s) => s.status === 'completed').length;
}

/** 스토리 작성 시점보다 보드가 더 자랐는지 — "이야기 다시 써줄까" 넛지 판정 (v7.8).
 *  storyWrittenAtCount가 없는 기존 데이터는 false — 업데이트만으로 갑자기 넛지가 뜨지 않게 */
export function isStoryStale(board: BoardData): boolean {
  return (
    !!board.futureDayStory &&
    board.storyWrittenAtCount !== undefined &&
    countCompleted(board) > board.storyWrittenAtCount
  );
}
