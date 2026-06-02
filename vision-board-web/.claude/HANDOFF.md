# HANDOFF
**agent:** claude | **project:** vision-board | **branch:** master | **commit:** 71cc5d8
**created:** 2026-06-02 | **status:** active

## Context
v3.0 프로덕션 배포 완료. `/moment/[id]` — 상황 묘사 → Groq 미니 스토리 → DALL-E 3 이미지 3장.
`OPENAI_API_KEY` Vercel 프로덕션에 등록 완료. v2.4c 플랜 파일 삭제 완료.

## Current State
- **배포 URL:** https://vision-board-web.vercel.app
- **최신 커밋:** 71cc5d8 feat: v3.0 /moment/[id]
- **v3.0 신규 라우트:** `/moment/[id]`, `/api/story/section`, `/api/image/generate`
- v2.7 이후 섹션·장면 페이지에서 AI 채팅 제거됨 (고정 질문 방식으로 교체)

## Known Pending Items (다음에 하면 좋을 것들)
- AI 모델 업그레이드: `llama-3.1-8b-instant` → 더 나은 모델 (품질 개선)
- Unsplash API 키 설정 (`.env.local`의 `UNSPLASH_ACCESS_KEY` 비어있음)
- ANTHROPIC_API_KEY 설정 (요약 API용, `.env.local`에 비어있음)
- v3.0 `/moment/[id]` 기능 실제 테스트 (DALL-E 3 이미지 생성 흐름 확인)

## Active Files (v3.0 기준)
- `app/moment/[id]/page.tsx` — 상황 묘사 → 미니 스토리 → DALL-E 3
- `app/api/story/section/route.ts` — Groq 미니 스토리 생성
- `app/api/image/generate/route.ts` — DALL-E 3 병렬 이미지 생성
- `lib/questions.ts` — situationChips 필드 추가 (6섹션)
- `lib/types.ts` — situationText, miniStory, generatedImages 필드 추가
