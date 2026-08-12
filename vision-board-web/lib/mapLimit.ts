// 동시 실행 상한이 있는 map — 여러 요청이 한꺼번에 몰려 서로를 타임아웃시키는 걸 막는다.
// v8.7에서 lib/wallpaper.ts 안에 만들어 쓰던 것을, v10에서 lib/imageDims.ts(치수 백필)와
// 공유하기 위해 순수 모듈로 추출했다. 동작은 그대로다.
//
// ⚠️ 순수 모듈 계약: 프로젝트의 어떤 모듈도 import하지 않는다.
//    검증 스크립트가 tsx로 단독 컴파일할 수 있어야 한다.

/** 동시 실행 상한이 있는 map — 결과를 모으지 않는다(부수 효과 전용). */
export async function mapLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      await fn(items[i]);
    }
  });
  await Promise.all(workers);
}
