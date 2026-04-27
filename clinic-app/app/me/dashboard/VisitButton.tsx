import Link from "next/link";

type Props = {
  /** Visit count in the last ~30 days, used for the helper text. */
  recentCount: number;
};

/**
 * Patient mypage visit button. Links to the dedicated multi-select calendar
 * page (/me/visits) where visits can be added/removed in batch.
 */
export default function VisitButton({ recentCount }: Props) {
  return (
    <Link
      href="/me/visits"
      className="mb-3 flex items-center justify-between rounded-full border-2 border-sky-500 bg-white text-sky-700 font-black tracking-widest py-3 px-5 hover:bg-sky-50 active:scale-[0.99] transition"
    >
      <span className="flex items-center gap-2">
        <span aria-hidden>📅</span>
        <span className="text-sm">来院記録を編集</span>
      </span>
      <span className="text-[10px] text-sky-500 font-bold tracking-widest">
        直近 {recentCount} 回 ›
      </span>
    </Link>
  );
}
