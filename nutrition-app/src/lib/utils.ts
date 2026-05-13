import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function todayStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fmtDateJp(s: string): string {
  const d = new Date(s);
  const days = '日月火水木金土';
  return `${d.getMonth() + 1}/${d.getDate()}（${days[d.getDay()]}）`;
}

export function fmtShortDate(s: string): string {
  const d = new Date(s);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function daysAgo(n: number, base: Date = new Date()): string {
  const d = new Date(base);
  d.setDate(d.getDate() - n);
  return todayStr(d);
}
