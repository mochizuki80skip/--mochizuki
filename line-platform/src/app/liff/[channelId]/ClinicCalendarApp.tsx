"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Slot = {
  date: string;
  time: string;
  available: boolean;
  remainingCapacity: number;
};
type DayAvailability = {
  date: string;
  dayOfWeek: number;
  isClosed: boolean;
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
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function isoDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function startOfWeek(d: Date) {
  const x = new Date(d);
  const dow = x.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

type VisitType = "new" | "returning";

export function ClinicCalendarApp({
  channelId,
  liffId,
  themeColor,
  clinicName,
  clinicPhone,
  bookingHorizonDays,
  newDurationMin,
  returningDurationMin,
}: {
  channelId: string;
  liffId: string;
  themeColor: string;
  clinicName: string;
  clinicAddress: string;
  clinicPhone: string;
  bookingHorizonDays: number;
  newDurationMin: number;
  returningDurationMin: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (rootRef.current) rootRef.current.style.setProperty("--turquoise", themeColor);
  }, [themeColor]);

  // LIFF
  const [profile, setProfile] = useState<LiffProfile | null>(null);
  const [liffReady, setLiffReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const tryInit = async () => {
      if (!window.liff || !liffId) { setLiffReady(true); return; }
      try {
        await window.liff.init({ liffId });
        if (cancelled) return;
        if (window.liff.isLoggedIn()) {
          const p = await window.liff.getProfile();
          if (!cancelled) setProfile(p);
        }
      } catch (e) {
        console.warn("[liff] init failed", e);
      } finally {
        if (!cancelled) setLiffReady(true);
      }
    };
    const t = setTimeout(tryInit, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [liffId]);

  // Step 1: 来院区分
  const [visitType, setVisitType] = useState<VisitType | null>(null);

  // Step 2: 日時
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [days, setDays] = useState<DayAvailability[] | null>(null);
  const [daysLoading, setDaysLoading] = useState(false);
  const [daysErr, setDaysErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ date: string; time: string } | null>(null);

  useEffect(() => {
    if (!visitType) return;
    const from = isoDate(weekStart);
    const to = isoDate(addDays(weekStart, 6));
    setDaysLoading(true);
    setDaysErr(null);
    setSelected(null);
    fetch(`/api/public/${channelId}/availability?visitType=${visitType}&from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error);
        setDays(j.days);
      })
      .catch((e) => setDaysErr(e.message ?? "空き状況の取得に失敗しました"))
      .finally(() => setDaysLoading(false));
  }, [channelId, visitType, weekStart]);

  const timeRows = useMemo(() => {
    if (!days) return [];
    const set = new Set<string>();
    days.forEach((d) => d.slots.forEach((s) => set.add(s.time)));
    return Array.from(set).sort((a, b) => {
      const [ah, am] = a.split(":").map(Number);
      const [bh, bm] = b.split(":").map(Number);
      return ah * 60 + am - (bh * 60 + bm);
    });
  }, [days]);

  // Step 3: 顧客情報
  const [referrals, setReferrals] = useState<Referral[]>([]);
  useEffect(() => {
    fetch(`/api/public/${channelId}/referrals`)
      .then((r) => r.json())
      .then((j) => setReferrals(j.referrals ?? []))
      .catch(() => {});
  }, [channelId]);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [referralId, setReferralId] = useState("");
  useEffect(() => {
    if (profile && !name) setName(profile.displayName);
  }, [profile, name]);

  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    if (!visitType || !selected) return;
    setSubmitting(true);
    setSubmitErr(null);
    try {
      const referralName = referrals.find((r) => r.id === referralId)?.name ?? null;
      const res = await fetch(`/api/public/${channelId}/reservations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          visitType,
          date: selected.date,
          time: selected.time,
          customerName: name,
          customerPhone: phone,
          referralSource: visitType === "new" ? referralName : null,
          lineUserId: profile?.userId ?? null,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "送信に失敗しました");
      setDone(true);
    } catch (e) {
      setSubmitErr(e instanceof Error ? e.message : "送信に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  const step1State = visitType ? "done" : "active";
  const step2State = !visitType ? "locked" : selected ? "done" : "active";
  const step3State = !selected ? "locked" : "active";
  const phoneRequired = visitType === "new";
  const canSubmit = !!selected && name.trim() && (!phoneRequired || phone.trim());
  const duration = visitType === "new" ? newDurationMin : returningDurationMin;

  if (done) {
    return (
      <>
        <header className="liff-top">
          <h1>{clinicName}</h1>
          <p className="sub">RESERVATION</p>
        </header>
        <div className="done">
          <div className="done-icon">✓</div>
          <h2>ご予約リクエストを受け付けました</h2>
          <p>内容を確認のうえ、改めて公式LINEからご連絡いたします。<br />少々お待ちくださいませ。</p>
          {selected && (
            <div className="summary">
              <div><b>{visitType === "new" ? "新規" : "2回目以降"}（{duration}分）</b></div>
              <div className="text-sm">
                希望日時: {selected.date.slice(5).replace("-", "/")} {selected.time}
              </div>
              <div className="text-sm">お名前: {name}</div>
              {phone && <div className="text-sm">電話: {phone}</div>}
            </div>
          )}
          <p className="text-xs">
            ※ この時点では予約は確定していません。確認のご連絡をもって確定となります。<br />
            {clinicPhone && <>お急ぎの場合はお電話ください：{clinicPhone}</>}
          </p>
          {liffReady && typeof window !== "undefined" && window.liff?.isInClient() && (
            <button className="cta-btn" style={{ marginTop: 20 }} onClick={() => window.liff?.closeWindow()}>
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
        {/* Step 1: 来院区分 */}
        <section className="step" data-state={step1State}>
          <div className="step-head">
            <span className="step-num">1</span>
            <h2>ご来院区分</h2>
            <span className="step-sum">
              {visitType === "new" ? "新規" : visitType === "returning" ? "2回目以降" : ""}
            </span>
            {visitType && (
              <button className="step-edit" onClick={() => { setVisitType(null); setSelected(null); setDays(null); }}>
                変更
              </button>
            )}
          </div>
          <div className="step-body">
            <div className="choices">
              <button className="choice" onClick={() => setVisitType("new")}>
                <span className="name">初めての方</span>
                <span className="meta">初回・{newDurationMin}分</span>
              </button>
              <button className="choice" onClick={() => setVisitType("returning")}>
                <span className="name">2回目以降の方</span>
                <span className="meta">再来・{returningDurationMin}分</span>
              </button>
            </div>
          </div>
        </section>

        {/* Step 2: 日時 */}
        <section className="step" data-state={step2State}>
          <div className="step-head">
            <span className="step-num">2</span>
            <h2>日時を選ぶ</h2>
            <span className="step-sum">
              {selected && `${selected.date.slice(5).replace("-", "/")} ${selected.time}`}
            </span>
            {selected && (
              <button className="step-edit" onClick={() => setSelected(null)}>変更</button>
            )}
          </div>
          <div className="step-body">
            <div className="locked-msg">先にご来院区分を選んでください</div>

            <div className="weeknav">
              <button
                className="weeknav-btn"
                onClick={() => setWeekStart((w) => addDays(w, -7))}
                disabled={weekStart <= startOfWeek(new Date())}
              >‹</button>
              <span className="weeknav-label">
                {weekStart.toLocaleDateString("ja-JP", { month: "long", day: "numeric" })}
                {" 〜 "}
                {addDays(weekStart, 6).toLocaleDateString("ja-JP", { month: "long", day: "numeric" })}
              </span>
              <button
                className="weeknav-btn"
                onClick={() => setWeekStart((w) => addDays(w, 7))}
                disabled={addDays(weekStart, 7) > addDays(new Date(), bookingHorizonDays)}
              >›</button>
            </div>

            <div className="legend">
              <span><b style={{ color: "var(--turquoise-deep)" }}>○</b> 予約可</span>
              <span><b style={{ color: "var(--ink-faint)" }}>×</b> 満員 / 受付外</span>
            </div>

            {daysErr && <div className="error">{daysErr}</div>}
            {daysLoading && <div className="loading">読み込み中...</div>}

            {days && !daysLoading && (
              <table className="cal-table">
                <thead>
                  <tr>
                    <th></th>
                    {days.map((d) => {
                      const dt = new Date(d.date + "T00:00:00");
                      return (
                        <th key={d.date} className={d.dayOfWeek === 0 ? "sun" : d.dayOfWeek === 6 ? "sat" : ""}>
                          {pad(dt.getMonth() + 1)}/{pad(dt.getDate())}
                          <br />({DAYS_JP[d.dayOfWeek]})
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {timeRows.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: 20, color: "var(--ink-soft)" }}>この週は受付できる枠がありません。</td></tr>
                  )}
                  {timeRows.map((time) => (
                    <tr key={time}>
                      <td className="time-label">{time}</td>
                      {days.map((d) => {
                        const slot = d.slots.find((s) => s.time === time);
                        if (d.isClosed || !slot) {
                          return <td key={d.date}><button className="slot closed" disabled>―</button></td>;
                        }
                        const isSel = selected?.date === slot.date && selected?.time === slot.time;
                        return (
                          <td key={d.date}>
                            <button
                              className={`slot ${slot.available ? "avail" : "full"} ${isSel ? "selected" : ""}`}
                              disabled={!slot.available}
                              onClick={() => setSelected({ date: slot.date, time: slot.time })}
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

        {/* Step 3: 顧客情報 */}
        <section className="step" data-state={step3State}>
          <div className="step-head">
            <span className="step-num">3</span>
            <h2>お客様情報</h2>
          </div>
          <div className="step-body">
            <div className="locked-msg">先に日時を選んでください</div>

            <div className="form-row">
              <label>お名前 *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="山田 太郎" />
            </div>
            {phoneRequired ? (
              <>
                <div className="form-row">
                  <label>電話番号 *</label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09012345678" />
                </div>
                <div className="form-row">
                  <label>当院を知ったきっかけ</label>
                  <select value={referralId} onChange={(e) => setReferralId(e.target.value)}>
                    <option value="">選択してください</option>
                    {referrals.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
                  </select>
                </div>
              </>
            ) : (
              <div className="form-row">
                <label>電話番号（任意）</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09012345678" />
              </div>
            )}
          </div>
        </section>

        {submitErr && <div className="error">{submitErr}</div>}
      </div>

      {selected && (
        <div className="cta-bar">
          <div className="summary">
            {visitType === "new" ? "新規" : "2回目以降"} / {selected.date.slice(5).replace("-", "/")} {selected.time}
          </div>
          <button className="cta-btn" disabled={!canSubmit || submitting} onClick={submit}>
            {submitting ? "送信中..." : "この内容で予約をリクエスト"}
          </button>
        </div>
      )}
    </div>
  );
}
