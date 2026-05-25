import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateAvailability } from "@/lib/reservation";
import { findDayTab, readDaySchedule, computeSlots } from "@/lib/clinicSheet";

export const dynamic = "force-dynamic";

function isoDate(d: Date): string {
  const jst = new Date(d.getTime() + 9 * 60 * 60_000);
  return jst.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400_000);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ channelId: string }> },
) {
  const { channelId } = await params;
  const url = new URL(req.url);
  const serviceId = url.searchParams.get("serviceId");
  const visitType = url.searchParams.get("visitType"); // "new" | "returning"（シート連動モード）
  const fromDate = url.searchParams.get("from");
  const toDate = url.searchParams.get("to");

  if (!fromDate || !toDate) {
    return NextResponse.json({ error: "missing params" }, { status: 400 });
  }

  const settings = await prisma.reservationSettings.findUnique({
    where: { lineChannelId: channelId },
  });
  if (!settings?.isEnabled) {
    return NextResponse.json({ error: "reservations not enabled" }, { status: 404 });
  }

  // === シート連動モード ===
  if (settings.sheetLinkedMode) {
    if (!settings.spreadsheetId) {
      return NextResponse.json({ error: "spreadsheet not configured" }, { status: 400 });
    }
    const vt = visitType === "new" ? "new" : "returning";
    const days: {
      date: string;
      dayOfWeek: number;
      isClosed: boolean;
      openTime: string | null;
      closeTime: string | null;
      slots: { date: string; time: string; startAt: string; endAt: string; available: boolean; remainingCapacity: number }[];
    }[] = [];

    const from = new Date(`${fromDate}T00:00:00+09:00`);
    const to = new Date(`${toDate}T00:00:00+09:00`);
    const duration = vt === "new" ? settings.newPatientDurationMinutes : settings.returningDurationMinutes;

    for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
      const dateStr = isoDate(d);
      const dow = new Date(d.getTime() + 9 * 60 * 60_000).getUTCDay();
      let tab: string | null = null;
      try {
        tab = await findDayTab(settings.spreadsheetId, dateStr);
      } catch {
        tab = null;
      }
      if (!tab) {
        days.push({ date: dateStr, dayOfWeek: dow, isClosed: true, openTime: null, closeTime: null, slots: [] });
        continue;
      }
      try {
        const schedule = await readDaySchedule(settings.spreadsheetId, tab, dateStr);
        const slots = computeSlots(
          schedule,
          vt,
          settings.newPatientDurationMinutes,
          settings.returningDurationMinutes,
        );
        days.push({
          date: dateStr,
          dayOfWeek: dow,
          isClosed: schedule.therapists.length === 0,
          openTime: schedule.timeRows[0]?.time ?? null,
          closeTime: schedule.timeRows[schedule.timeRows.length - 1]?.time ?? null,
          slots: slots.map((s) => {
            const startAt = new Date(`${dateStr}T${s.time.padStart(5, "0")}:00+09:00`);
            const endAt = new Date(startAt.getTime() + duration * 60_000);
            return {
              date: dateStr,
              time: s.time,
              startAt: startAt.toISOString(),
              endAt: endAt.toISOString(),
              available: s.available,
              remainingCapacity: s.remaining,
            };
          }),
        });
      } catch (e) {
        days.push({ date: dateStr, dayOfWeek: dow, isClosed: true, openTime: null, closeTime: null, slots: [] });
      }
    }
    return NextResponse.json({ mode: "sheet", days });
  }

  // === 従来 DB モード ===
  if (!serviceId) {
    return NextResponse.json({ error: "missing serviceId" }, { status: 400 });
  }
  try {
    const days = await calculateAvailability({ channelId, serviceId, fromDate, toDate });
    const serializable = days.map((d) => ({
      ...d,
      slots: d.slots.map((s) => ({
        ...s,
        startAt: s.startAt.toISOString(),
        endAt: s.endAt.toISOString(),
      })),
    }));
    return NextResponse.json({ mode: "db", days: serializable });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown" },
      { status: 400 },
    );
  }
}
