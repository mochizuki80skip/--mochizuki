import { NextRequest, NextResponse } from 'next/server';
import { analyzePhoto } from '@/lib/ai';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const { image } = await req.json().catch(() => ({}));
  if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
    return NextResponse.json({ error: 'image (data URL) required' }, { status: 400 });
  }
  const items = await analyzePhoto(image);
  return NextResponse.json({ items });
}
