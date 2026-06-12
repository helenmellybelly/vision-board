import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    return NextResponse.json({ error: 'Unsplash API key not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);

  // Unsplash 규정: 사진 사용 시 download_location 핑 필요 — 클라이언트가 선택 시 호출
  const download = searchParams.get('download');
  if (download) {
    if (!download.startsWith('https://api.unsplash.com/')) {
      return NextResponse.json({ error: 'invalid download location' }, { status: 400 });
    }
    try {
      await fetch(download, { headers: { Authorization: `Client-ID ${accessKey}` } });
    } catch {
      // 핑 실패는 사용자 흐름에 영향 없음
    }
    return NextResponse.json({ ok: true });
  }

  const q = searchParams.get('q') || '라이프스타일';
  const page = searchParams.get('page') || '1';

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=9&page=${page}&orientation=landscape`,
      {
        headers: {
          Authorization: `Client-ID ${accessKey}`,
          'Accept-Version': 'v1',
        },
        next: { revalidate: 3600 },
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: 'Unsplash API error' }, { status: res.status });
    }

    const data = await res.json();
    const photos = (data.results || []).map((photo: {
      id: string;
      urls: { thumb: string; small: string; regular: string };
      alt_description?: string;
      user?: { name?: string; links?: { html?: string } };
      links?: { download_location?: string };
    }) => ({
      id: photo.id,
      thumb: photo.urls.small ?? photo.urls.thumb,
      regular: photo.urls.regular,
      alt: photo.alt_description || '',
      // Unsplash 출처 표기·다운로드 핑용 (v6.17)
      userName: photo.user?.name ?? '',
      userLink: photo.user?.links?.html ?? '',
      downloadLocation: photo.links?.download_location ?? '',
    }));

    return NextResponse.json({ photos });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch images' }, { status: 500 });
  }
}
