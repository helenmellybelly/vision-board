// 한국어 조사 선택 유틸 — 받침(종성) 유무에 따라 알맞은 조사를 골라준다.
// 서비스 전체 단일 소스: 온보딩 토리 대사 등 이름 보간 시 사용.

// 받침 유무: true=받침 있음, false=없음, null=마지막 글자가 완성형 한글이 아님(영문·숫자 등)
export function hasBatchim(word: string): boolean | null {
  if (!word) return null;
  const code = word.charCodeAt(word.length - 1);
  if (code < 0xac00 || code > 0xd7a3) return null;
  return (code - 0xac00) % 28 !== 0;
}

// ㄹ받침 여부 — '으로/로' 특례 ("서울로", "헬렌으로")
function hasRieulBatchim(word: string): boolean {
  const code = word.charCodeAt(word.length - 1);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 === 8;
}

export type JosaPair = '아/야' | '이/가' | '은/는' | '을/를' | '으로/로' | '이라는/라는';

// [받침형, 무받침형]
const PAIRS: Record<JosaPair, [string, string]> = {
  '아/야': ['아', '야'],
  '이/가': ['이', '가'],
  '은/는': ['은', '는'],
  '을/를': ['을', '를'],
  '으로/로': ['으로', '로'],
  '이라는/라는': ['이라는', '라는'],
};

// 조사만 반환 — josaOnly('헬렌', '이라는/라는') === '이라는'
// 비한글(영문 이름 등)은 무받침형으로 처리 ("Helen야", "Helen라는")
export function josaOnly(word: string, pair: JosaPair): string {
  const [withBatchim, withoutBatchim] = PAIRS[pair];
  if (pair === '으로/로' && hasRieulBatchim(word)) return withoutBatchim;
  return hasBatchim(word) === true ? withBatchim : withoutBatchim;
}

// 단어+조사 — josa('헬렌', '아/야') === '헬렌아'
export function josa(word: string, pair: JosaPair): string {
  return `${word}${josaOnly(word, pair)}`;
}
