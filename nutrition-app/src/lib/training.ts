// 部位プリセット + 種目DB

export const BODY_PARTS = [
  { key: 'chest',     label: '胸',   color: 'bg-rose-100 text-rose-700' },
  { key: 'back',      label: '背中', color: 'bg-blue-100 text-blue-700' },
  { key: 'shoulders', label: '肩',   color: 'bg-amber-100 text-amber-700' },
  { key: 'arms',      label: '腕',   color: 'bg-purple-100 text-purple-700' },
  { key: 'legs',      label: '脚',   color: 'bg-emerald-100 text-emerald-700' },
  { key: 'abs',       label: '腹',   color: 'bg-orange-100 text-orange-700' },
  { key: 'other',     label: 'その他', color: 'bg-gray-100 text-gray-700' }
];

// 部位ごとの種目候補
export const EXERCISES: Record<string, string[]> = {
  chest: ['ベンチプレス', 'ダンベルプレス', 'インクラインベンチ', 'チェストプレス', 'ダンベルフライ', 'ケーブルクロスオーバー', 'プッシュアップ', 'ディップス'],
  back: ['デッドリフト', '懸垂', 'ラットプルダウン', 'ベントオーバーロウ', 'ワンハンドロウ', 'シーテッドロウ', 'プルオーバー'],
  shoulders: ['ショルダープレス', 'サイドレイズ', 'リアレイズ', 'フロントレイズ', 'アップライトロウ', 'シュラッグ', 'アーノルドプレス'],
  arms: ['バーベルカール', 'ダンベルカール', 'ハンマーカール', 'プリーチャーカール', 'トライセプスエクステンション', 'ケーブルプッシュダウン', 'ナローベンチプレス', 'キックバック'],
  legs: ['スクワット', 'デッドリフト', 'レッグプレス', 'レッグエクステンション', 'レッグカール', 'ヒップスラスト', 'ブルガリアンスクワット', 'カーフレイズ', 'ランジ'],
  abs: ['クランチ', 'プランク', 'レッグレイズ', 'シットアップ', 'ロシアンツイスト', 'バイシクルクランチ', 'アブローラー'],
  other: ['オリジナル種目']
};

// 有酸素種目
export const CARDIO_OPTIONS = [
  'ランニング',
  'ウォーキング',
  'エアロバイク',
  'クロストレーナー',
  'スイミング',
  'なわとび',
  'ヒルクライム',
  'HIIT',
  'その他'
];

// 1セットあたりの総負荷 (kg)
export function setVolume(weight: number | null | undefined, reps: number | null | undefined): number {
  return (weight || 0) * (reps || 0);
}

// 体重・有酸素時間から消費kcalを推定 (MET法)
const METS: Record<string, number> = {
  'ランニング': 8.0,
  'ウォーキング': 3.5,
  'エアロバイク': 7.0,
  'クロストレーナー': 5.5,
  'スイミング': 7.0,
  'なわとび': 11.0,
  'ヒルクライム': 8.5,
  'HIIT': 8.0,
  'その他': 5.0
};

export function estimateCardioKcal(activity: string, durationMin: number, bodyWeightKg: number): number {
  const met = METS[activity] || 5.0;
  return Math.round(met * bodyWeightKg * (durationMin / 60));
}

// 筋トレ消費kcal推定（およそ 5kcal/分）
export function estimateStrengthKcal(durationMin: number, bodyWeightKg: number): number {
  const met = 5.0; // 中強度の筋トレ平均
  return Math.round(met * bodyWeightKg * (durationMin / 60));
}
