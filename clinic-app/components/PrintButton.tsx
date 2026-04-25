"use client";

export default function PrintButton({
  className,
  children = "印刷 / PDF保存",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={
        className ||
        "rounded-full bg-ink-900 text-white font-bold text-sm px-5 py-2.5 hover:bg-ink-700 transition print:hidden"
      }
    >
      {children}
    </button>
  );
}
