import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    return NextResponse.json({ error: 'Unsplash API key not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
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
      urls: { thumb: string; regular: string };
      alt_description?: string;
    }) => ({
      id: photo.id,
      thumb: photo.urls.thumb,
      regular: photo.urls.regular,
      alt: photo.alt_description || '',
    }));

    return NextResponse.json({ photos });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch images' }, { status: 500 });
  }
}
