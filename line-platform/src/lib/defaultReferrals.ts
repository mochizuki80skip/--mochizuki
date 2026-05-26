import { prisma } from "@/lib/prisma";

// シート連動モードの接骨院向け：きっかけ選択肢が未登録なら既定セットを投入
const DEFAULT_REFERRALS = [
  "チラシ",
  "新聞折り込み",
  "友人紹介",
  "家族紹介",
  "職場紹介",
  "HP",
  "Google",
  "Google口コミ",
  "Yahoo!",
  "店前の看板・のぼり",
  "優待券",
  "Instagram",
  "Instagram広告を見た",
];

export async function ensureDefaultReferrals(channelId: string): Promise<void> {
  const count = await prisma.referralSource.count({ where: { lineChannelId: channelId } });
  if (count > 0) return;
  await prisma.referralSource.createMany({
    data: DEFAULT_REFERRALS.map((name, i) => ({
      lineChannelId: channelId,
      name,
      sortOrder: i + 1,
      isActive: true,
    })),
    skipDuplicates: true,
  });
}
