const WD = ['日', '月', '火', '水', '木', '金', '土'];
const pad = (n: number) => String(n).padStart(2, '0');

export function today(): Date { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
export function key(d: Date): string { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function parse(k: string): Date { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
export function addDays(n: number, from: Date = today()): Date { const d = new Date(from); d.setDate(d.getDate() + n); return d; }
export function isWeekend(d: Date): boolean { return d.getDay() === 0 || d.getDay() === 6; }
export function bizDay(n: number, from: Date = today()): Date {
  let d = new Date(from); let left = n;
  while (left > 0) { d = addDays(1, d); if (!isWeekend(d)) left--; }
  return d;
}
export function nextWeekday(dow: number, from: Date = today()): Date {
  let d = addDays(1, from);
  while (d.getDay() !== dow) d = addDays(1, d);
  return d;
}
export function fmtMD(d: Date): string { return `${d.getMonth() + 1}/${d.getDate()}`; }
export function fmtMDW(d: Date): string { return `${fmtMD(d)} (${WD[d.getDay()]})`; }
export function fmtYMDW(d: Date): string { return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 (${WD[d.getDay()]})`; }
export function rel(d: Date, base: Date = today()): string {
  const n = Math.round((d.getTime() - base.getTime()) / 864e5);
  return n === 0 ? '今日' : n === 1 ? '明日' : n === -1 ? '昨日' : fmtMDW(d);
}
export function hm(d: Date = new Date()): string { return `${d.getHours()}:${pad(d.getMinutes())}`; }
export function nowIso(): string { const d = new Date(); return `${key(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; } // ローカル時刻。UTC にしない (todaySummary が日付で絞るため)
export function minutes(hhmm: string): number { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; }
export function toHm(min: number): string { return `${Math.floor(min / 60)}:${pad(min % 60)}`; }

/* 「明日」「今週」「来週」「金曜」から日付を取る。/chat (kuroko/route.ts) と LINE (kuroko/line.ts) は
   入口が別なので、時期の読み取りだけをここで共有する。一致しなければ undefined */
export function whenOf(text: string, base: Date): Date | undefined {
  if (/明日/.test(text)) return bizDay(1, base);
  if (/今週/.test(text)) return bizDay(2, base);
  if (/来週/.test(text)) return bizDay(5, base);
  const w = text.match(/([日月火水木金土])曜/);
  return w ? nextWeekday(WD.indexOf(w[1]), base) : undefined;
}
