// 큐레이션 샘플 갤러리 매니페스트 생성 (v7.0-r4, 1회성 스크립트)
// 카테고리별 Unsplash 검색 → 후보를 lib/curatedImages.ts로 덤프.
// 결과는 사람이 보고 사진을 빼거나 교체해 다듬는다 (URL 핫링크 — Unsplash 가이드라인 준수).
// 실행: node scripts/build-curated-manifest.mjs
import { readFileSync, writeFileSync } from 'fs';

// .env.local에서 키 로드 (dotenv 의존성 없이)
function loadKey() {
  if (process.env.UNSPLASH_ACCESS_KEY) return process.env.UNSPLASH_ACCESS_KEY;
  try {
    const env = readFileSync('.env.local', 'utf8');
    const m = env.match(/^UNSPLASH_ACCESS_KEY=(.+)$/m);
    return m?.[1]?.trim();
  } catch {
    return undefined;
  }
}

const KEY = loadKey();
if (!KEY) {
  console.error('UNSPLASH_ACCESS_KEY not found');
  process.exit(1);
}

// 카테고리 정의 — sectionIds는 해당 카테고리를 기본 선택으로 쓰는 섹션 (1나 2건강 3관계 4일 5돈 6공간)
const CATEGORIES = [
  { id: 'workout', label: '운동·건강', sectionIds: [2], query: 'morning running workout wellness lifestyle' },
  { id: 'nature', label: '자연·휴식', sectionIds: [1], query: 'calm nature morning light peaceful' },
  { id: 'relationship', label: '관계', sectionIds: [3], query: 'friends family warm dinner together' },
  { id: 'work', label: '일·성장', sectionIds: [4], query: 'focused work creative studio desk' },
  { id: 'travel', label: '여행·자유', sectionIds: [5], query: 'travel adventure scenic freedom' },
  { id: 'home', label: '집·공간', sectionIds: [6], query: 'cozy home interior sunlight plants' },
  { id: 'daily', label: '음식·일상', sectionIds: [], query: 'coffee breakfast cozy daily life' },
  { id: 'achievement', label: '성취·여유', sectionIds: [], query: 'success celebration relaxed lifestyle' },
];

const PER_CATEGORY = 10;

async function fetchCategory(cat) {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(cat.query)}&per_page=${PER_CATEGORY + 5}&orientation=landscape&content_filter=high`;
  const res = await fetch(url, { headers: { Authorization: `Client-ID ${KEY}` } });
  if (!res.ok) {
    console.error(`${cat.id}: HTTP ${res.status}`);
    return [];
  }
  const data = await res.json();
  return (data.results ?? []).slice(0, PER_CATEGORY).map((p) => ({
    id: p.id,
    thumb: p.urls.small,
    regular: p.urls.regular,
    alt: p.alt_description ?? '',
    author: p.user?.name ?? '',
    authorLink: p.user?.links?.html ?? '',
    downloadLocation: p.links?.download_location ?? '',
  }));
}

const out = [];
for (const cat of CATEGORIES) {
  const photos = await fetchCategory(cat);
  console.log(`${cat.label}: ${photos.length}장`);
  out.push({ id: cat.id, label: cat.label, sectionIds: cat.sectionIds, photos });
  await new Promise((r) => setTimeout(r, 300)); // rate limit 여유
}

const ts = `import { SectionId } from './types';

// 큐레이션 샘플 갤러리 매니페스트 (v7.0-r4)
// scripts/build-curated-manifest.mjs가 생성 — 사진 교체·삭제는 이 파일을 직접 편집.
// Unsplash 가이드라인: CDN 핫링크(재호스팅 금지), 선택 시 /api/unsplash?download= 핑, 어트리뷰션 표기.
export interface CuratedPhoto {
  id: string;
  thumb: string;
  regular: string;
  alt: string;
  author: string;
  authorLink: string;
  downloadLocation: string;
}

export interface CuratedCategory {
  id: string;
  label: string;
  /** 이 카테고리를 기본 선택으로 쓰는 섹션 */
  sectionIds: SectionId[];
  photos: CuratedPhoto[];
}

export const CURATED_CATEGORIES: CuratedCategory[] = ${JSON.stringify(out, null, 2)};

export function defaultCategoryFor(sectionId: SectionId): CuratedCategory {
  return (
    CURATED_CATEGORIES.find((c) => c.sectionIds.includes(sectionId)) ?? CURATED_CATEGORIES[0]
  );
}
`;

writeFileSync('lib/curatedImages.ts', ts, 'utf8');
console.log(`lib/curatedImages.ts 생성 완료 (${out.reduce((n, c) => n + c.photos.length, 0)}장)`);
