import { NextRequest, NextResponse } from 'next/server';
import { analyzeFoodText } from '@/lib/ai';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { name } = await req.json().catch(() => ({}));
  if (!name || typeof name !== 'string') {
    return NextResponse.json({
      diagnostic: { stage: 'bad_input', detail: '食品名が指定されていません。' }
    }, { status: 400 });
  }
  const result = await analyzeFoodText(name);
  return NextResponse.json(result);
}
