// Indian units: 1 L = 1e5, 1 Cr = 1e7. Returns rupees.
export function parseInr(s: string): number | null {
  const m = s.match(/(?:INR|₹|Rs\.?)\s*([\d,]+(?:\.\d+)?)\s*(L|lakh|Cr|crore)?\b/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ""));
  const u = (m[2] ?? "").toLowerCase();
  return u === "l" || u === "lakh" ? n * 1e5 : u === "cr" || u === "crore" ? n * 1e7 : n;
}
export const toCr = (rupees: number) => rupees / 1e7;
export function parseCount(s: string): number | null {
  const m = s.match(/([\d,]+(?:\.\d+)?)\s*(crore|lakh)?/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ""));
  const u = (m[2] ?? "").toLowerCase();
  return u === "crore" ? n * 1e7 : u === "lakh" ? n * 1e5 : n;
}
