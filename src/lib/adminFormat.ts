// src/lib/adminFormat.ts
// Small formatting/range helpers shared by the admin dashboard components.

import { Language } from "@/lib/translations";

export function fmtMoney(n: number): string {
  return "CHF " + (Number(n) || 0).toFixed(2);
}

export function fmtDateTime(iso: string, lang: Language): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  if (lang === "de") {
    const date = d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
    const time = d.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
    return `${date}, ${time}`;
  }
  const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${time}`;
}

export type RangeMode = "today" | "week" | "month" | "all" | "custom";

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Returns true if `iso` falls within the given range, evaluated against `now`. */
export function inRange(
  iso: string,
  mode: RangeMode,
  now: Date,
  customFrom?: string,
  customTo?: string,
): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return false;

  if (mode === "all") return true;

  if (mode === "today") {
    const start = startOfDay(now).getTime();
    const end = start + 86400000;
    return t >= start && t < end;
  }

  if (mode === "week") {
    const end = startOfDay(now).getTime() + 86400000;
    const start = end - 7 * 86400000;
    return t >= start && t < end;
  }

  if (mode === "month") {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const end = startOfDay(now).getTime() + 86400000;
    return t >= monthStart && t < end;
  }

  if (mode === "custom") {
    const from = customFrom ? new Date(customFrom + "T00:00:00").getTime() : -Infinity;
    const to = customTo ? new Date(customTo + "T23:59:59").getTime() : Infinity;
    return t >= from && t <= to;
  }

  return true;
}

function ymd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Filename-safe label for the currently active order date range - mirrors
 * inRange's own boundaries above so the label always matches what's
 * actually included, e.g. "2026-09-19_bis_2026-09-25" for "week" or
 * "alle" for "all". Used to name the orders Excel export after whatever
 * period is filtered, instead of just today's date. */
export function rangeFilenameLabel(mode: RangeMode, now: Date, customFrom?: string, customTo?: string): string {
  if (mode === "all") return "alle";

  if (mode === "today") return ymd(now);

  if (mode === "week") {
    const end = startOfDay(now);
    const start = new Date(end.getTime() - 6 * 86400000);
    return `${ymd(start)}_bis_${ymd(end)}`;
  }

  if (mode === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return `${ymd(start)}_bis_${ymd(now)}`;
  }

  // custom
  if (customFrom && customTo) return `${customFrom}_bis_${customTo}`;
  if (customFrom) return `ab_${customFrom}`;
  if (customTo) return `bis_${customTo}`;
  return "alle";
}
