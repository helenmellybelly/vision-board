export async function compressImage(src: string, quality = 0.65): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(src);
    img.src = src.startsWith('data:') ? src : `data:image/png;base64,${src}`;
  });
}
