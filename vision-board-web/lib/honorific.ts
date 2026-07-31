/** 존댓말 어미 검출 (v8.0) — 미래 일기의 반말 "~다"체 계약 검증.
 *  어미가 단어 끝(공백·문장부호·개행 앞)에 올 때만 잡아 "필요·중요" 같은 일반 명사는 통과시킨다. */
export function hasHonorific(text: string): boolean {
  return /(습니다|입니다|합니다|세요|어요|아요|에요|예요|해요|네요|지요|죠)(?=[\s.,!?…~)"'」』\]]|$)/m.test(
    text
  );
}

/** 오글·클리셰 표현 검출 (v8.4) — 미래 일기 계열(전체·섹션) 공용 품질 게이트.
 *  프롬프트의 금지 지시만으론 새는 걸 못 막아, 검출 시 1회 재생성한다(전역 규칙 패턴).
 *  ⚠️ 프롬프트의 금지 표현 열거와 이 정규식은 락스텝 — 리스트를 바꾸면 양쪽 다 */
export function hasCliche(text: string): boolean {
  return /(가슴이\s*벅|뭉클|이게\s*꿈(인지|이|만)|꿈만\s*같|내가\s*해냈|해냈다는\s*생각|감사한\s*하루|완벽한\s*하루|미소가\s*지어|입가에\s*미소|눈시울|벅찬\s*(마음|감정)|행복(이|감이)\s*밀려|가슴\s*한\s*켠|울컥)/.test(
    text
  );
}

/** 외국 문자 검출 (v8.5) — "유기のか 과일" 버그: LLM이 한국어 본문에 가나·한자를 흘린다.
 *  가나·반각 가나·CJK 한자·가나 부호·키릴만 잡고, 라틴 문자는 게이트하지 않는다(영문 고유명사 허용).
 *  ⚠️ 두 스토리 라우트 SYSTEM_PROMPT의 "한국어로만" 금지 줄, smoke-v80-story S9 정규식과 락스텝 */
const FOREIGN_SCRIPT_RE = /[぀-ヿｦ-ﾝ一-鿿々〆・Ѐ-ӿ]/;

export function hasForeignScript(text: string): boolean {
  return FOREIGN_SCRIPT_RE.test(text);
}

/** 외국 문자 기계 제거 (최후 수단) — 재생성 후에도 남으면 문자만 걷어내고 공백을 정리한다.
 *  LLM 3차 호출 대신 쓰는 이유: 클라이언트 30s 타임아웃 예산(호출 최대 2회) 보호 */
export function stripForeignScript(text: string): string {
  return text
    .replace(new RegExp(FOREIGN_SCRIPT_RE.source, 'g'), '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([.,!?…~)\]」』"'])/g, '$1');
}

/** 품질 게이트 판정 — 걸린 사유 목록 (없으면 통과). 재생성 프롬프트에 사유를 명시할 때 사용 */
export function storyQualityIssues(text: string): string[] {
  const issues: string[] = [];
  if (hasHonorific(text)) issues.push('존댓말');
  if (hasCliche(text)) issues.push('오글거리는 클리셰');
  if (hasForeignScript(text)) issues.push('한국어가 아닌 문자(일본어 등)');
  return issues;
}
