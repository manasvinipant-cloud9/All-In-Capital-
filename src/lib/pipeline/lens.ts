// Sector lenses multiply weights by 1.5, then renormalise. Written view has its own fixed weights and no lens.
export const REVEALED = { C1: 0.25, C2: 0.2, C3: 0.2, C4: 0.15, C5: 0.1, C6: 0.1 } as Record<string, number>;
export const WRITTEN = { C1: 0.35, C2: 0.15, C3: 0.1, C4: 0.1, C5: 0.1, C6: 0.2 } as Record<string, number>;
export function lensFor(sector: string, text = ""): string[] {
  const s = sector.toLowerCase();
  if (/consumer brand/.test(s)) return ["C3", "C4"];
  if (/fintech/.test(s) && /loan|credit|lend|nbfc/i.test(text)) return ["C2"];
  if (/deeptech|hardware/.test(s)) return ["C2", "C6"];
  return [];
}
export function lensWeights(base: Record<string, number>, boosted: string[], mult = 1.5) {
  const w = Object.fromEntries(Object.entries(base).map(([k, v]) => [k, boosted.includes(k) ? v * mult : v]));
  const sum = Object.values(w).reduce((a, b) => a + b, 0);
  return Object.fromEntries(Object.entries(w).map(([k, v]) => [k, v / sum]));
}
