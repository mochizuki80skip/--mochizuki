"use client";

/**
 * Route-level error boundary for the patient mypage.
 * Surfaces the actual digest + message instead of the generic
 * "Application error: a server-side exception has occurred" page.
 */
export default function MeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-md px-5 pt-10 pb-12">
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
        <h2 className="text-base font-black text-rose-800 mb-2">
          画面の読み込みに失敗しました
        </h2>
        <p className="text-sm text-rose-700 leading-relaxed mb-3">
          一時的な障害の可能性があります。下のボタンで再読み込みしてください。
        </p>
        <p className="text-[11px] text-rose-700 mb-4 break-all">
          {error.message}
          {error.digest && (
            <>
              <br />
              <span className="text-rose-500">Digest: {error.digest}</span>
            </>
          )}
        </p>
        <button
          onClick={reset}
          className="rounded-full bg-rose-600 text-white font-bold text-sm px-4 py-2 hover:bg-rose-700 transition"
        >
          再読み込み
        </button>
      </div>
    </main>
  );
}
