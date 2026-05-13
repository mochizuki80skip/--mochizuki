import { NextRequest, NextResponse } from 'next/server';
import { analyzePhoto } from '@/lib/ai';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const { image } = await req.json().catch(() => ({}));
  if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
    return NextResponse.json({
      items: [],
      diagnostic: { stage: 'bad_image', detail: '画像が送信されませんでした、もしくは形式が不正です。' }
    }, { status: 400 });
  }
  const result = await analyzePhoto(image);
  return NextResponse.json(result);
}
