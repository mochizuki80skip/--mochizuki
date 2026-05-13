'use client';
import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { CARDIO_OPTIONS, estimateCardioKcal } from '@/lib/training';
import * as storage from '@/lib/storage';
import { todayStr } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';

interface Props {
  open: boolean;
  onClose: () => void;
  bodyWeight: number;
  onSaved: () => void;
}

export function CardioInputModal({ open, onClose, bodyWeight, onSaved }: Props) {
  const { toast } = useToast();
  const [cardioName, setCardioName] = useState('ランニング');
  const [cardioOther, setCardioOther] = useState('');
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');
  const [kcal, setKcal] = useState('');
  const [memo, setMemo] = useState('');
  const [kcalManual, setKcalManual] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCardioName('ランニング');
    setCardioOther('');
    setDuration('');
    setDistance('');
    setKcal('');
    setMemo('');
    setKcalManual(false);
  }, [open]);

  useEffect(() => {
    if (kcalManual || !duration) return;
    const auto = estimateCardioKcal(cardioName, +duration || 0, bodyWeight);
    setKcal(String(auto));
  }, [duration, cardioName, bodyWeight, kcalManual]);

  const save = async () => {
    const finalName = cardioName === 'その他' ? cardioOther.trim() || 'その他' : cardioName;
    if (!finalName) return toast('種目を入力してください');
    if (!duration) return toast('時間を入力してください');
    await storage.addWorkout({
      date: todayStr(),
      type: 'cardio',
      cardioName: finalName,
      durationMin: +duration,
      distanceKm: distance ? +distance : null,
      kcal: kcal ? +kcal : estimateCardioKcal(cardioName, +duration, bodyWeight),
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
            <input className="input mt-2" type="text" placeholder="例: フィットボクシング" value={cardioOther} onChange={(e) => setCardioOther(e.target.value)} />
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
        <div>
          <label className="label">消費kcal <span className="text-ink-mute">自動推定値・手動修正可</span></label>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            value={kcal}
            onChange={(e) => { setKcal(e.target.value); setKcalManual(true); }}
          />
        </div>
        <div>
          <label className="label">メモ</label>
          <textarea className="input" rows={2} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="今日は調子良かった、ペース上がった等" />
        </div>
        <div className="flex gap-2 pt-2">
          <button className="btn-secondary flex-1" onClick={onClose}>キャンセル</button>
          <button className="btn-primary flex-1" onClick={save}>記録する</button>
        </div>
      </div>
    </Modal>
  );
}
