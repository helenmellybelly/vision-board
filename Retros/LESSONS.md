# 교훈 기록 (Lessons Learned)

코딩 및 전략 교훈. /wrap 세션에서 기록됩니다.
#coding 태그 항목은 SessionStart 시 자동 주입됩니다.
반복 패턴은 /wrap HITL 승급을 통해 적절한 vehicle로 적용됩니다.

## UX / 플로우 설계

### 질문 순서가 심리적 흐름을 결정한다 #strategy #ux
비전보드 장면 묘사(④) 슬롯은 반드시 다른 답(①②③⑤) 모두 작성 후에 제시해야 한다. PDF 실제 사용자 흐름 분석으로 확인. 순서가 바뀌면 "뭘 써야 할지 모르겠다"는 막힘이 생긴다.

## Deployment

### GitHub Pages 진입점은 root index.html 필요 #coding #deployment
Pages에서 하위 폴더 HTML 파일은 직접 URL로 접근은 되지만, 기본 진입점(/)은 root의 index.html만 인식한다. Playground 내 파일을 배포 진입점으로 쓰려면 root에 복사하거나 /docs 폴더 설정 필요.
