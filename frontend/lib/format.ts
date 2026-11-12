import type { Money } from "@/types/api";

/** Group a backend decimal string for display without converting it to a JS float. */
export function baht(value: Money | null, signed = false): string {
  if (value === null) return "Estimate unavailable";
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [whole, fraction = "00"] = unsigned.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const prefix = negative ? "−" : signed && unsigned !== "0.00" ? "+" : "";
  return `${prefix}฿${grouped}.${fraction}`;
}

/** Classify a backend decimal string for presentation only; never changes its value. */
export function impactTone(value: Money): "positive" | "negative" | "zero" {
  if (/^-?0+(?:\.0+)?$/.test(value)) return "zero";
  return value.startsWith("-") ? "negative" : "positive";
}

export function monthLabel(isoDate: string): string {
  const [year, month] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "Asia/Bangkok" }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function thaiDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function readableDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function weekdayLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("en", { weekday: "long", timeZone: "Asia/Bangkok" }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function percentage(rate: string | null): string {
  if (rate === null) return "Missing";
  const [whole, decimal = ""] = rate.split(".");
  const basisPoints = Number(whole) * 10000 + Number(decimal.padEnd(4, "0"));
  return `${(basisPoints / 100).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")}%`;
}
