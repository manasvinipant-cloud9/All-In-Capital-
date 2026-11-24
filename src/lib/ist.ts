// India has no DST, so IST is a fixed +05:30 offset.
const OFF = 330 * 60000;
export const WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const ist = (d: Date) => { const s = new Date(d.getTime() + OFF); return { y: s.getUTCFullYear(), mo: s.getUTCMonth(), d: s.getUTCDate(), h: s.getUTCHours(), mi: s.getUTCMinutes(), wd: s.getUTCDay() }; };
export const fromIST = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(Date.UTC(y, mo, d, h, mi) - OFF);
export const addMin = (d: Date, m: number) => new Date(d.getTime() + m * 60000);
export function fmtSlot(d: Date) { const t = ist(d); const h12 = t.h % 12 || 12; return `${WD[t.wd]}, ${t.d} ${MON[t.mo]}, ${h12}:${String(t.mi).padStart(2, "0")} ${t.h < 12 ? "am" : "pm"} IST`; }
