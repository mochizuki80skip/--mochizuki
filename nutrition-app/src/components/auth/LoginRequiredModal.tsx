'use client';
import { Lock, ArrowRight } from 'lucide-react';

/**
 * 未ログイン状態でアプリを開いた時に、ダッシュボードに被せて表示するモーダル。
 * 「閉じる」ボタンはなく、ログインしないと先に進めない。
 */
export function LoginRequiredModal({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center">
      <div className="bg-white rounded-t-3xl md:rounded-3xl w-full md:max-w-md p-6 md:p-8 shadow-2xl">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-full bg-brand-50 flex items-center justify-center">
            <Lock className="w-6 h-6 text-brand-600" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-center mb-2">ログインが必要です</h2>
        <p className="text-sm text-ink-dim text-center mb-6 leading-relaxed">
          食事・トレーニング・体重などのデータを<br />
          安全にクラウドに保存するため、<br />
          ログインをお願いします。
        </p>

        <a
          href="/welcome"
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          ログイン画面へ <ArrowRight className="w-4 h-4" />
        </a>

        <p className="text-[10px] text-ink-mute text-center mt-4 leading-relaxed">
          LINE / メールアドレスでログインできます。<br />
          数タップで完了します。
        </p>
      </div>
    </div>
  );
}
