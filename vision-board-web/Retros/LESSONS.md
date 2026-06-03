# 교훈 기록 (Lessons Learned)

코딩 및 전략 교훈. /wrap 세션에서 기록됩니다.
#coding 태그 항목은 SessionStart 시 자동 주입됩니다.
반복 패턴은 /wrap HITL 승급을 통해 적절한 vehicle로 적용됩니다.

---

## React / UI

### React ref 이중 할당 금지 — 마지막 할당만 유효 #coding #react
동일 ref를 JSX 트리에서 두 곳에 할당하면 마지막 노드만 가리킨다.
스크롤 컨테이너 ref를 외부 div와 내부 마커에 동시 할당했을 때 외부 div가 무시됐다.
스크롤 컨테이너는 별도 ref로 분리하고 `scrollTop = scrollHeight`로 직접 제어할 것.

### scrollIntoView(smooth)보다 requestAnimationFrame + scrollTop=scrollHeight #coding #react
`scrollIntoView({ behavior: 'smooth' })`는 레이아웃 완료 전에 실행되면 즉시성이 없고 크로스브라우저 동작이 다르다.
`requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; })`가 더 신뢰도 높고 즉시 바닥 이동이 보장된다.

---

## AI 프롬프트

### 감정 금지는 금지어 + ❌/✅ 대체 예시를 함께 줘야 효과적 #coding #ai-prompt
"감정 단어 금지"만 명시하면 동의어나 유사 표현으로 우회한다.
`❌ "행복했다" → ✅ "커피잔을 두 손으로 감싸 쥐었다"` 형식으로 금지와 대안을 쌍으로 주면 모델이 더 확실히 따른다.
