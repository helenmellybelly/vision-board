# HANDOFF
**agent:** claude | **project:** vision-board | **branch:** master | **commit:** dfe607e
**created:** 2026-05-29 | **status:** active

## Context
Review/Scene UX 전면 개편 완료. AI 요약 API는 구현됐지만 ANTHROPIC_API_KEY 미설정 상태. 다음은 API 키 설정 후 실기기 테스트, 그리고 Stage 2(Supabase) 진입.

## Immediate Next Steps
- [ ] `.env.local`에 `ANTHROPIC_API_KEY` 입력 + Vercel 환경변수 설정 → AI 요약 동작 확인
- [ ] 모바일(375px) 전체 흐름 완주 테스트: 온보딩 → 섹션 6개 → review → scene → board
- [ ] 온보딩 예시 보드 이미지 제작 (Step 3 placeholder 교체)
- [ ] Stage 2: Supabase 프로젝트 생성 + 테이블 + 이메일/Google 로그인
- [ ] localStorage → Supabase DB 저장 전환 + 자동저장(debounce 2초)

## Active Files
- `vision-board-web/app/review/page.tsx` — AI 요약 카드 + 2열 그리드
- `vision-board-web/app/scene/[id]/page.tsx` — intro/scene/images 3-step
- `vision-board-web/app/api/summarize/route.ts` — Claude Haiku 요약 API
- `vision-board-web/.env.local` — ANTHROPIC_API_KEY 입력 필요

## Current State / Blockers
AI 요약: ANTHROPIC_API_KEY 없으면 에러 카드 노출 (재시도 버튼 있음).
Vercel 배포 시 동일 키를 Environment Variables에 추가해야 프로덕션 동작.
Stage 2 블로커: Supabase 프로젝트 생성 필요 (supabase.com 계정 연결).
