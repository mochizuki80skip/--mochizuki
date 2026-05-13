'use client';
import { useEffect, useState, useMemo } from 'react';
import { Modal } from '@/components/ui/Modal';
import { CARDIO_OPTIONS, estimateCardioKcal } from '@/lib/training';
import * as storage from '@/lib/storage';
import { todayStr } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';
import { Flame, Clock } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  bodyWeight: number;
  targetDate?: string;
  onSaved: () => void;
}

// 「その他」用の強度オプション
const INTENSITY_PRESETS = [
  { key: 'light', label: '軽め', desc: 'ストレッチ・軽い体操', met: 3.0 },
  { key: 'medium', label: '中強度', desc: 'ジョギング相当', met: 6.0 },
  { key: 'hard', label: '高強度', desc: 'HIIT・激しい運動', met: 9.0 }
];

export function CardioInputModal({ open, onClose, bodyWeight, targetDate, onSaved }: Props) {
  const { toast } = useToast();
  const [cardioName, setCardioName] = useState('ランニング');
  const [cardioOther, setCardioOther] = useState('');
  const [intensity, setIntensity] = useState<string>('medium'); // 「その他」のとき有効
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');
  const [kcal, setKcal] = useState('');
  const [memo, setMemo] = useState('');
  const [kcalManual, setKcalManual] = useState(false);

  const date = targetDate || todayStr();

  useEffect(() => {
    if (!open) return;
    setCardioName('ランニング');
    setCardioOther('');
    setIntensity('medium');
    setDuration('');
    setDistance('');
    setKcal('');
    setMemo('');
    setKcalManual(false);
  }, [open]);

  // MET 値の決定
  const effectiveMet = useMemo(() => {
    if (cardioName === 'その他') {
      return INTENSITY_PRESETS.find((p) => p.key === intensity)?.met || 5.0;
    }
    // training.ts の METS と同じ値
    const METS: Record<string, number> = {
      'ランニング': 8.0,
      'ウォーキング': 3.5,
      'エアロバイク': 7.0,
      'クロストレーナー': 5.5,
      'スイミング': 7.0,
      'なわとび': 11.0,
      'ヒルクライム': 8.5,
      'HIIT': 8.0
    };
    return METS[cardioName] || 5.0;
  }, [cardioName, intensity]);

  // リアルタイム kcal 計算
  const autoKcal = useMemo(() => {
    const min = +duration || 0;
    return Math.round(effectiveMet * bodyWeight * (min / 60));
  }, [effectiveMet, bodyWeight, duration]);

  useEffect(() => {
    if (kcalManual) return;
    setKcal(autoKcal > 0 ? String(autoKcal) : '');
  }, [autoKcal, kcalManual]);

  const save = async () => {
    const finalName = cardioName === 'その他'
      ? (cardioOther.trim() ? `${cardioOther.trim()} (${INTENSITY_PRESETS.find((p) => p.key === intensity)?.label})` : `運動 (${INTENSITY_PRESETS.find((p) => p.key === intensity)?.label})`)
      : cardioName;
    if (!duration) return toast('時間を入力してください');
    await storage.addWorkout({
      date,
      type: 'cardio',
      cardioName: finalName,
      durationMin: +duration,
      distanceKm: distance ? +distance : null,
      kcal: kcal ? +kcal : autoKcal,
      memo: memo || null,
      sets: []
    });
    onSaved();
  };

  return (
    <Modal open={open} onClose={onClose} title="有酸素運動">
      <div className="space-y-3">
        <div>
          <label className="label">種目</label>
          <select className="input" value={cardioName} onChange={(e) => setCardioName(e.target.value)}>
            {CARDIO_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          {cardioName === 'その他' && (
            <>
              <input
                className="input mt-2"
                type="text"
                placeholder="例: フィットボクシング"
                value={cardioOther}
                onChange={(e) => setCardioOther(e.target.value)}
              />
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                {INTENSITY_PRESETS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setIntensity(p.key)}
                    className={`p-2 rounded-lg border text-left transition ${
                      intensity === p.key ? 'bg-brand-50 border-brand-500' : 'bg-white border-ink-line'
                    }`}
                  >
                    <div className={`text-xs font-bold ${intensity === p.key ? 'text-brand-700' : 'text-ink'}`}>{p.label}</div>
                    <div className="text-[9px] text-ink-mute mt-0.5">MET {p.met}</div>
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-ink-mute mt-1">{INTENSITY_PRESETS.find((p) => p.key === intensity)?.desc}</div>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">時間 (分)</label>
            <input className="input" type="number" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="30" />
          </div>
          <div>
            <label className="label">距離 (km) <span className="text-ink-mute">任意</span></label>
            <input className="input" type="number" step="0.1" inputMode="decimal" value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="5.0" />
          </div>
        </div>

        {/* リアルタイム計算結果 */}
        <div className="bg-gradient-to-br from-brand-50 to-white border border-brand-100 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-brand-500 flex items-center justify-center">
                <Flame className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-ink-mute">推定消費カロリー</div>
                <div className="text-[10px] text-ink-dim">MET {effectiveMet} × 体重 × 時間</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-brand-600">{autoKcal}</div>
              <div className="text-[10px] text-ink-mute">kcal</div>
            </div>
          </div>
        </div>

        <div>
          <label className="label">消費kcal <span className="text-ink-mute font-normal">手動で上書き可</span></label>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            value={kcal}
            onChange={(e) => { setKcal(e.target.value); setKcalManual(true); }}
            placeholder={String(autoKcal)}
          />
        </div>

        <div>
          <label className="label">メモ</label>
          <textarea className="input" rows={2} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="今日は調子良かった等" />
        </div>

        <div className="flex gap-2 pt-2">
          <button className="btn-secondary flex-1" onClick={onClose}>キャンセル</button>
          <button className="btn-primary flex-1" onClick={save}>記録する</button>
        </div>
      </div>
    </Modal>
  );
}
