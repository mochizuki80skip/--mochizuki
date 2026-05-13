import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { meals, weights, profile } = await req.json().catch(() => ({}));

  let mealCount = 0;
  if (Array.isArray(meals)) {
    for (const m of meals) {
      if (!m.name || !m.date || !m.meal) continue;
      await prisma.meal.create({
        data: {
          userId: user.id,
          date: String(m.date),
          meal: String(m.meal),
          name: String(m.name).slice(0, 80),
          qty: Number(m.qty) || 1,
          unit: String(m.unit || '1人前').slice(0, 20),
          kcal: Math.max(0, Math.round(Number(m.kcal) || 0)),
          protein: Math.max(0, +Number(m.protein || 0).toFixed(1)),
          fat: Math.max(0, +Number(m.fat || 0).toFixed(1)),
          carbs: Math.max(0, +Number(m.carbs || 0).toFixed(1)),
          source: m.source || 'manual'
        }
      });
      mealCount++;
    }
  }

  let weightCount = 0;
  if (Array.isArray(weights)) {
    for (const w of weights) {
      if (!w.date || !w.weight) continue;
      await prisma.weight.upsert({
        where: { userId_date: { userId: user.id, date: String(w.date) } },
        create: { userId: user.id, date: String(w.date), weight: Number(w.weight), bodyFat: w.bodyFat != null ? Number(w.bodyFat) : null },
        update: { weight: Number(w.weight), bodyFat: w.bodyFat != null ? Number(w.bodyFat) : null }
      });
      weightCount++;
    }
  }

  let profileSynced = false;
  if (profile && typeof profile === 'object' && !user.onboardedAt) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        sex: profile.sex ?? undefined,
        age: profile.age != null ? Number(profile.age) : undefined,
        heightCm: profile.heightCm != null ? Number(profile.heightCm) : undefined,
        weightKg: profile.weightKg != null ? Number(profile.weightKg) : undefined,
        targetWeight: profile.targetWeight != null ? Number(profile.targetWeight) : undefined,
        activity: profile.activity ?? undefined,
        goal: profile.goal ?? undefined,
        onboardedAt: new Date()
      }
    });
    profileSynced = true;
  }

  return NextResponse.json({ ok: true, meals: mealCount, weights: weightCount, profile: profileSynced });
}
