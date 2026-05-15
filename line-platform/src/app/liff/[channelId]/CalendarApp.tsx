"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Service = {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
  description: string | null;
};

type Slot = {
  date: string;
  time: string;
  startAt: string;
  endAt: string;
  available: boolean;
  remainingCapacity: number;
};

type DayAvailability = {
  date: string;
  dayOfWeek: number;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
  slots: Slot[];
};

type Referral = { id: string; name: string };

type LiffProfile = { userId: string; displayName: string; pictureUrl?: string };

declare global {
  interface Window {
    liff?: {
      init: (cfg: { liffId: string }) => Promise<void>;
      isLoggedIn: () => boolean;
      login: () => void;
      getProfile: () => Promise<LiffProfile>;
      closeWindow: () => void;
      isInClient: () => boolean;
    };
  }
}

const DAYS_JP = ["日", "月", "火", "水", "木", "金", "土"];

function pad(n: number) { return n.toString().padStart(2, "0"); }
function addDays(d: Date, days: number) { const x = new Date(d); x.setDate(x.getDate() + days); return x; }
function isoDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function startOfWeek(d: Date) {
  // 月曜始まり
  const x = new Date(d);
  const dow = x.getDay(); // 0=日
  const diff = dow === 0 ? -6 : 1 - dow;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function CalendarApp({
  channelId,
  liffId,
  themeColor,
  clinicName,
  clinicAddress,
  clinicPhone,
  bookingHorizonDays,
}: {
  channelId: string;
  liffId: string;
  themeColor: string;
  clinicName: string;
  clinicAddress: string;
  clinicPhone: string;
  bookingHorizonDays: number;
}) {
  // テーマカラー上書き
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (rootRef.current) {
      rootRef.current.style.setProperty("--turquoise", themeColor);
    }
  }, [themeColor]);

  // LIFF 初期化
  const [profile, setProfile] = useState<LiffProfile | null>(null);
  const [liffReady, setLiffReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const tryInit = async () => {
      if (!window.liff || !liffId) {
        setLiffReady(true);
        return;
      }
      try {
        await window.liff.init({ liffId });
        if (cancelled) return;
        if (window.liff.isLoggedIn()) {
          const p = await window.liff.getProfile();
          if (!cancelled) setProfile(p);
        }
      } catch (e) {
        console.warn("[liff] init failed:", e);
      } finally {
        if (!cancelled) setLiffReady(true);
      }
    };
    // SDK ロード後に init
    const t = setTimeout(tryInit, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [liffId]);

  // === Step 1: メニュー ===
  const [services, setServices] = useState<Service[] | null>(null);
  const [serviceErr, setServiceErr] = useState<string | null>(null);
  useEffect(() => {
    fetch(`/api/public/${channelId}/services`)
      .then((r) => r.json())
      .then((j) => setServices(j.services ?? []))
      .catch(() => setServiceErr("メニュー読み込みに失敗しました"));
  }, [channelId]);

  const [selectedService, setSelectedService] = useState<Service | null>(null);

  // === Step 2: 日時 ===
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [days, setDays] = useState<DayAvailability[] | null>(null);
  const [daysLoading, setDaysLoading] = useState(false);
  const [daysErr, setDaysErr] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  useEffect(() => {
    if (!selectedService) return;
    const from = isoDate(weekStart);
    const to = isoDate(addDays(weekStart, 6));
    setDaysLoading(true);
    setDaysErr(null);
    fetch(`/api/public/${channelId}/availability?serviceId=${selectedService.id}&from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error);
        setDays(j.days);
      })
      .catch((e) => setDaysErr(e.message ?? "空き状況の取得に失敗しました"))
      .finally(() => setDaysLoading(false));
  }, [channelId, selectedService, weekStart]);

  // 全時間枠のユニークリスト（横軸：曜日、縦軸：時間）
  const timeRows = useMemo(() => {
    if (!days) return [];
    const set = new Set<string>();
    days.forEach((d) => d.slots.forEach((s) => set.add(s.time)));
    return Array.from(set).sort();
  }, [days]);

  // === Step 3: お客様情報 ===
  const [referrals, setReferrals] = useState<Referral[]>([]);
  useEffect(() => {
    fetch(`/api/public/${channelId}/referrals`)
      .then((r) => r.json())
      .then((j) => setReferrals(j.referrals ?? []));
  }, [channelId]);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [referralId, setReferralId] = useState("");

  // 名前の初期値（LIFF プロフィールから）
  useEffect(() => {
    if (profile && !name) setName(profile.displayName);
  }, [profile, name]);

  // 送信
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ reservationId: string; slot: Slot; service: Service } | null>(null);

  async function submit() {
    if (!selectedService || !selectedSlot) return;
    setSubmitting(true);
    setSubmitErr(null);
    try {
      const referralName = referrals.find((r) => r.id === referralId)?.name ?? null;
      const res = await fetch(`/api/public/${channelId}/reservations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          serviceId: selectedService.id,
          startAt: selectedSlot.startAt,
          customerName: name,
          customerPhone: phone,
          referralSource: referralName,
          lineUserId: profile?.userId ?? null,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "予約に失敗しました");
      setDone({ reservationId: j.reservationId, slot: selectedSlot, service: selectedService });
    } catch (e) {
      setSubmitErr(e instanceof Error ? e.message : "予約に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  // ステップの状態
  const step1State = selectedService ? "done" : "active";
  const step2State = !selectedService ? "locked" : selectedSlot ? "done" : "active";
  const step3State = !selectedSlot ? "locked" : "active";
  const canSubmit = !!selectedSlot && name.trim() && phone.trim();

  // 完了画面
  if (done) {
    const startJst = new Date(done.slot.startAt);
    return (
      <>
        <header className="liff-top">
          <h1>{clinicName}</h1>
          <p className="sub">PREDICTION COMPLETE</p>
        </header>
        <div className="done">
          <div className="done-icon">✓</div>
          <h2>ご予約承りました</h2>
          <p>当日のご来院をお待ちしております。</p>
          <div className="summary">
            <div><b>{done.service.name}</b></div>
            <div className="text-sm">
              {startJst.toLocaleString("ja-JP", {
                month: "long", day: "numeric", weekday: "short",
                hour: "2-digit", minute: "2-digit",
              })}
            </div>
            <div className="text-sm">所要時間：{done.service.durationMinutes}分</div>
            <div className="text-sm">お名前：{name}</div>
            <div className="text-sm">電話：{phone}</div>
          </div>
          <p className="text-xs">
            ※ ご変更・キャンセルは公式 LINE のチャットからご連絡ください。<br />
            {clinicPhone && <>お電話：{clinicPhone}</>}
          </p>
          {liffReady && typeof window !== "undefined" && window.liff?.isInClient() && (
            <button
              className="cta-btn"
              style={{ marginTop: 20 }}
              onClick={() => window.liff?.closeWindow()}
            >
              閉じる
            </button>
          )}
        </div>
      </>
    );
  }

  return (
    <div ref={rootRef}>
      <header className="liff-top">
        <h1>{clinicName}</h1>
        <p className="sub">RESERVATION</p>
      </header>

      <div className="liff-wizard">
        {/* Step 1 ---------- */}
        <section className="step" data-state={step1State}>
          <div className="step-head">
            <span className="step-num">1</span>
            <h2>メニュー選択</h2>
            <span className="step-sum">{selectedService?.name ?? ""}</span>
            {selectedService && (
              <button className="step-edit" onClick={() => { setSelectedService(null); setSelectedSlot(null); setDays(null); }}>
                変更
              </button>
            )}
          </div>
          <div className="step-body">
            {serviceErr && <div className="error">{serviceErr}</div>}
            {!services && !serviceErr && <div className="loading">読み込み中...</div>}
            {services && services.length === 0 && (
              <div className="notice">メニューが登録されていません。</div>
            )}
            <div className="choices">
              {services?.map((s) => (
                <button key={s.id} className="choice" onClick={() => setSelectedService(s)}>
                  <span className="name">{s.name}</span>
                  <span className="meta">所要 {s.durationMinutes} 分</span>
                  {s.price > 0 && <span className="price">¥{s.price.toLocaleString()}</span>}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Step 2 ---------- */}
        <section className="step" data-state={step2State}>
          <div className="step-head">
            <span className="step-num">2</span>
            <h2>日時を選ぶ</h2>
            <span className="step-sum">
              {selectedSlot &&
                `${selectedSlot.date.slice(5).replace("-", "/")} ${selectedSlot.time}`}
            </span>
            {selectedSlot && (
              <button className="step-edit" onClick={() => setSelectedSlot(null)}>
                変更
              </button>
            )}
          </div>
          <div className="step-body">
            <div className="locked-msg">先にメニューを選んでください</div>

            <div className="weeknav">
              <button
                className="weeknav-btn"
                onClick={() => setWeekStart((w) => addDays(w, -7))}
                disabled={weekStart <= startOfWeek(new Date())}
              >
                ‹
              </button>
              <span className="weeknav-label">
                {weekStart.toLocaleDateString("ja-JP", { month: "long", day: "numeric" })}
                {" 〜 "}
                {addDays(weekStart, 6).toLocaleDateString("ja-JP", { month: "long", day: "numeric" })}
              </span>
              <button
                className="weeknav-btn"
                onClick={() => setWeekStart((w) => addDays(w, 7))}
                disabled={addDays(weekStart, 7) > addDays(new Date(), bookingHorizonDays)}
              >
                ›
              </button>
            </div>

            <div className="legend">
              <span><b style={{color:"var(--turquoise-deep)"}}>○</b> 予約可</span>
              <span><b style={{color:"var(--ink-faint)"}}>×</b> 満員 / 受付外</span>
            </div>

            {daysErr && <div className="error">{daysErr}</div>}
            {daysLoading && <div className="loading">読み込み中...</div>}

            {days && (
              <table className="cal-table">
                <thead>
                  <tr>
                    <th></th>
                    {days.map((d) => {
                      const dt = new Date(d.date + "T00:00:00");
                      return (
                        <th
                          key={d.date}
                          className={d.dayOfWeek === 0 ? "sun" : d.dayOfWeek === 6 ? "sat" : ""}
                        >
                          {pad(dt.getMonth() + 1)}/{pad(dt.getDate())}
                          <br />
                          ({DAYS_JP[d.dayOfWeek]})
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {timeRows.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ padding: 20, color: "var(--ink-soft)" }}>
                        この週は受付できる枠がありません。
                      </td>
                    </tr>
                  )}
                  {timeRows.map((time) => (
                    <tr key={time}>
                      <td className="time-label">{time}</td>
                      {days.map((d) => {
                        if (d.isClosed) {
                          return (
                            <td key={d.date}>
                              <button className="slot closed" disabled>―</button>
                            </td>
                          );
                        }
                        const slot = d.slots.find((s) => s.time === time);
                        if (!slot) {
                          return (
                            <td key={d.date}>
                              <button className="slot closed" disabled>―</button>
                            </td>
                          );
                        }
                        const isSelected =
                          selectedSlot?.date === slot.date && selectedSlot?.time === slot.time;
                        return (
                          <td key={d.date}>
                            <button
                              className={`slot ${slot.available ? "avail" : "full"} ${isSelected ? "selected" : ""}`}
                              disabled={!slot.available}
                              onClick={() => setSelectedSlot(slot)}
                            >
                              {slot.available ? "○" : "×"}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Step 3 ---------- */}
        <section className="step" data-state={step3State}>
          <div className="step-head">
            <span className="step-num">3</span>
            <h2>お客様情報</h2>
          </div>
          <div className="step-body">
            <div className="locked-msg">先に日時を選んでください</div>

            <div className="form-row">
              <label>お名前 *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="山田 太郎"
              />
            </div>
            <div className="form-row">
              <label>電話番号 *</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09012345678"
              />
            </div>
            <div className="form-row">
              <label>当院を知ったきっかけ</label>
              <select value={referralId} onChange={(e) => setReferralId(e.target.value)}>
                <option value="">選択してください</option>
                {referrals.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {submitErr && <div className="error">{submitErr}</div>}
      </div>

      {/* Sticky CTA */}
      {selectedSlot && (
        <div className="cta-bar">
          <div className="summary">
            {selectedService?.name} / {selectedSlot.date.slice(5).replace("-", "/")} {selectedSlot.time}
          </div>
          <button className="cta-btn" disabled={!canSubmit || submitting} onClick={submit}>
            {submitting ? "送信中..." : "この内容で予約する"}
          </button>
        </div>
      )}
    </div>
  );
}
