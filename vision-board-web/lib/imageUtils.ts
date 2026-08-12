/** 압축 결과 + 원본 실측 치수 (v10).
 *  w/h는 압축 후가 아니라 **원본 naturalWidth/Height**다 — 비율만 쓰지만
 *  원본 치수를 남겨야 나중에 "얼마나 줄였나"를 판단할 수 있다.
 *  로드 실패 시 w/h = 0 → 호출부는 "치수 모름"으로 취급한다. */
export interface CompressedImage {
  dataUrl: string;
  w: number;
  h: number;
}

/**
 * 이미지를 리사이즈·재압축하면서 원본 실측 치수를 함께 돌려준다 (v10).
 *
 * 치수 측정은 **추가 비용이 0**이다 — 어차피 여기서 img를 로드해 drawImage 하고 있고,
 * v9까지는 그때 알고 있던 naturalWidth/Height를 그냥 버렸다. 그게 콜라주가 세로 사진을
 * 가로 셀에 우겨넣던 근본 원인이다(lib/collageJustify.ts 헤더 주석 참고).
 */
export async function compressImageWithDims(
  src: string,
  quality = 0.65,
  maxWidth = 1024,
): Promise<CompressedImage> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const ow = img.naturalWidth || img.width;
      const oh = img.naturalHeight || img.height;
      const scale = Math.min(1, maxWidth / ow);
      const w = Math.floor(ow * scale);
      const h = Math.floor(oh * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      resolve({ dataUrl: canvas.toDataURL('image/jpeg', quality), w: ow, h: oh });
    };
    img.onerror = () => resolve({ dataUrl: src, w: 0, h: 0 });
    img.src = src.startsWith('data:') ? src : `data:image/png;base64,${src}`;
  });
}

/** 기존 호출부(6곳) 무변경용 래퍼 — 치수가 필요 없으면 이걸 쓴다. */
export async function compressImage(src: string, quality = 0.65, maxWidth = 1024): Promise<string> {
  const out = await compressImageWithDims(src, quality, maxWidth);
  return out.dataUrl;
}
