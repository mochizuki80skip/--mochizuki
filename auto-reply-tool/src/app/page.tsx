import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-6">
      <section className="bg-white rounded-lg p-6 shadow-sm border border-brand-100">
        <h1 className="text-xl font-semibold mb-2">ようこそ</h1>
        <p className="text-gray-700 leading-relaxed">
          kaloko の「お約束機能」への返信を、お客様ごとの過去のやり取りと
          目標を踏まえてサクッと作るためのツールです。
        </p>
      </section>
      <section className="grid sm:grid-cols-2 gap-4">
        <Link
          href="/customers"
          className="block bg-white rounded-lg p-5 shadow-sm border border-brand-100 hover:border-brand-500 transition"
        >
          <div className="text-sm text-gray-500">1.</div>
          <div className="font-semibold text-brand-700">お客様一覧</div>
          <div className="text-sm text-gray-600 mt-1">
            登録済みのお客様を見る / 新しく追加する
          </div>
        </Link>
        <Link
          href="/customers"
          className="block bg-white rounded-lg p-5 shadow-sm border border-brand-100 hover:border-brand-500 transition"
        >
          <div className="text-sm text-gray-500">2.</div>
          <div className="font-semibold text-brand-700">返信を作る</div>
          <div className="text-sm text-gray-600 mt-1">
            お客様を選んで「返信を作る」ボタンから生成
          </div>
        </Link>
      </section>
    </div>
  );
}
