// v8.0 최종 일기 실호출 스모크 — /api/story가 섹션 일기 재료로 반말 "~다"체 일기를 쓰는지.
// 사용: 로컬 서버 기동 후 `node .claude/smoke-v80-story.mjs` (BASE로 프로덕션 지정 가능)
const BASE = process.env.BASE ?? 'http://localhost:3000';

const results = [];
const ok = (name, cond, extra = '') =>
  results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`);

// lib/honorific.ts와 동일 패턴 (스모크는 서버 코드를 import할 수 없어 복제)
const hasHonorific = (t) =>
  /(습니다|입니다|합니다|세요|어요|아요|에요|예요|해요|네요|지요|죠)(?=[\s.,!?…~)"'」』\]]|$)/m.test(t);
// lib/honorific.ts hasCliche 복제 (v8.4) — 오글 클리셰 게이트
const hasCliche = (t) =>
  /(가슴이\s*벅|뭉클|이게\s*꿈(인지|이|만)|꿈만\s*같|내가\s*해냈|해냈다는\s*생각|감사한\s*하루|완벽한\s*하루|미소가\s*지어|입가에\s*미소|눈시울|벅찬\s*(마음|감정)|행복(이|감이)\s*밀려|가슴\s*한\s*켠|울컥)/.test(t);
// lib/honorific.ts FOREIGN_SCRIPT_RE 복제 (v8.5) — 외국 문자 게이트("유기のか 과일" 버그)
const hasForeignScript = (t) => /[぀-ヿｦ-ﾝ一-鿿々〆・Ѐ-ӿ]/.test(t);

const payload = {
  userName: '지현',
  oneSentence: '나의 힘을 알고 활용하며, 가족을 존중하며 사는 삶',
  targetDate: '2029-07-30',
  sections: [
    {
      title: '나',
      keyword: '자신있는 단단함',
      miniStory:
        '토요일 아침, 서재 통창으로 볕이 길게 들어왔다. 커피를 내리고 메일함을 열었더니 내 이름을 보고 온 제안이 두 개. 답장을 쓰다가 잠깐 손을 멈췄다. 이제 이런 아침이 낯설지 않네.',
    },
    {
      title: '건강',
      keyword: '지치지 않는 체력',
      miniStory:
        '알람보다 먼저 눈이 떠졌다. 강가를 10km 뛰고 돌아왔는데도 숨이 금방 가라앉았다. 샤워를 하고 나오니 몸이 가볍다. 걸을 때 배에 힘이 들어가는 게 느껴진다.',
    },
    {
      title: '관계',
      keyword: '존중이 느껴지는 관계',
      miniStory:
        '저녁에 호성이랑 식탁에 마주 앉아 이사 얘기를 했다. 서로 생각이 달랐는데, 끝까지 듣고 나서 하나씩 맞춰갔다. 밥을 다 먹고도 한참을 앉아 있었다.',
    },
    {
      title: '공간',
      keyword: '우리 가족이 표현되는 집',
      miniStory:
        '암막 커튼이 자동으로 열리면서 통창으로 아침 빛이 들어왔다. 거실 식물들 잎이 반짝인다. 강아지가 발치에 와서 안겼다. 부엌은 넓지만 물건이 넘치지 않는다.',
    },
  ],
};

const res = await fetch(`${BASE}/api/story`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
ok('S1 응답 200', res.ok, `status=${res.status}`);
const data = await res.json().catch(() => ({}));
const story = data.story ?? '';

ok('S2 스토리 존재', story.length > 0);
ok('S3 길이 400자 이상', story.length >= 400, `${story.length}자`);
ok('S4 존댓말 부재(반말 계약)', !hasHonorific(story));
const boldCount = (story.match(/\*\*(.*?)\*\*/g) ?? []).length;
ok('S5 볼드 1곳(soft)', boldCount === 1, `bold=${boldCount}`);
ok('S6 영역 이름 직접 언급 부재', !/\[(나|건강|관계|일|돈|공간)\]|《/.test(story));
// v8.3 — 짜깁기감 가드: 영역명이 소제목처럼 줄 머리에 등장하지 않아야 한다
ok('S7 영역명 소제목 부재', !/^(나|건강|관계|일|돈|공간)\s*[:：—-]/m.test(story));
// v8.4 — 클리셰 게이트: 프롬프트 금지 + 서버 1회 재생성 게이트를 통과한 결과여야 한다
ok('S8 오글 클리셰 부재', !hasCliche(story));
// v8.5 — 외국 문자 게이트: 재생성 후에도 남으면 서버가 기계 제거하므로 최종 응답엔 없어야 한다
ok('S9 외국 문자 부재(가나·한자·키릴)', !hasForeignScript(story));

console.log('\n===== v8.0 최종 일기 스모크 =====');
for (const r of results) console.log(r);
console.log(`\n--- 생성된 일기 (${story.length}자) ---\n${story}\n`);
const fail = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`${results.length - fail}/${results.length} PASS`);
process.exit(fail ? 1 : 0);
