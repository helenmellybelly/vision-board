export async function compressImage(src: string, quality = 0.65, maxWidth = 1024): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const w = Math.floor(img.width * scale);
      const h = Math.floor(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(src);
    img.src = src.startsWith('data:') ? src : `data:image/png;base64,${src}`;
  });
}
