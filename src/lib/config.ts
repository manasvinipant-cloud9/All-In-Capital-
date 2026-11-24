// Versioned config. Saving creates a new version; there is no history UI.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { REVEALED } from "./pipeline/lens.ts";

export type Config = {
  version: number;
  weights: Record<string, number>;            // shares of 1
  thresholds: { take: number; dig: number; noBelow: number; leansYes: number };
  lensMultiplier: number;
  fund: { raiseMaxCr: number; postMaxCr: number };
  anchors: Record<string, Record<"0" | "3" | "5" | "7" | "10", string>>;
};
export const DEFAULT: Config = {
  version: 1, weights: { ...REVEALED }, thresholds: { take: 7.5, dig: 6, noBelow: 4.5, leansYes: 6.75 }, lensMultiplier: 1.5, fund: { raiseMaxCr: 10, postMaxCr: 40 },
  anchors: {
    C1: { "0": "Pedigree only, no time in the field", "3": "Related experience, no earned insight", "5": "Some field time, insight is generic", "7": "Years in the field with a specific edge", "10": "Earned secrets nobody else has, proven by customers" },
    C2: { "0": "Blames a partner for the hardest risk", "3": "Risk is shared and unmanaged", "5": "Owns some risk, others unclear", "7": "Owns the main risk with numbers", "10": "Carries first loss and shows loss rates" },
    C3: { "0": "Downloads or followers only", "3": "A few customers, no repeat data", "5": "Repeat exists but thin", "7": "Repeat by cohort and groundwork done", "10": "Strong cohort repeat and conversion, customers pull" },
    C4: { "0": "No numbers given", "3": "Numbers do not reconcile", "5": "Headline numbers only", "7": "Cohorts and CAC by channel that add up", "10": "Volunteers margin, cohorts and CAC without being asked" },
    C5: { "0": "Needs far more than a pre-seed cheque", "3": "Capital heavy with a long path", "5": "Fits with caveats", "7": "Fits cheque and valuation", "10": "Clear path to the next round on this cheque" },
    C6: { "0": "No answer to a funded copier", "3": "Vague why now", "5": "Reasonable why now", "7": "Clear change and a moat story", "10": "Sharp why now and a concrete answer to copiers" },
  },
};
const FILE = ".local/config.json";
export function loadConfig(): Config {
  if (!existsSync(FILE)) return DEFAULT;
  const all = JSON.parse(readFileSync(FILE, "utf8")) as Config[];
  return all[all.length - 1] ?? DEFAULT;
}
export function validate(c: Omit<Config, "version">): string | null {
  const sum = Object.values(c.weights).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > 0.005) return `Weights must add up to 100%, they add up to ${(sum * 100).toFixed(1)}%.`;
  if (Object.values(c.weights).some(w => w < 0)) return "Weights cannot be negative.";
  const t = c.thresholds;
  if (!(t.noBelow < t.dig && t.dig < t.leansYes + 1e-9 && t.leansYes < t.take)) return "Thresholds must run noBelow < dig < leans-yes < take.";
  if (c.lensMultiplier < 1 || c.lensMultiplier > 3) return "Lens multiplier must be between 1 and 3.";
  if (c.fund.raiseMaxCr <= 0 || c.fund.postMaxCr <= 0) return "Fund limits must be positive.";
  return null;
}
export function saveConfig(next: Omit<Config, "version">): { ok: true; version: number } | { ok: false; error: string } {
  const err = validate(next); if (err) return { ok: false, error: err };
  const all: Config[] = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : [];
  const version = Math.max(DEFAULT.version, ...all.map(a => a.version)) + 1;
  mkdirSync(".local", { recursive: true }); writeFileSync(FILE, JSON.stringify([...all, { ...next, version }], null, 2));
  return { ok: true, version };
}
