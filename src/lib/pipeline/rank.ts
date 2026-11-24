export type Rec = "Take the call" | "Dig first" | "Pass";
export type Lane = "yes" | "your_call" | "no";
export type Thresholds = { take: number; dig: number; noBelow: number; leansYes: number };
export const T0: Thresholds = { take: 7.5, dig: 6, noBelow: 4.5, leansYes: 6.75 };
export function recommend(score: number, anyGate: boolean, c123Med: boolean, t: Thresholds = T0): Rec {
  if (score >= t.take && !anyGate && c123Med) return "Take the call";
  if (score >= t.dig) return "Dig first";
  return "Pass";
}
export function lane(score: number, rec: Rec, g1Tripped: boolean, anyGate: boolean, t: Thresholds = T0): { lane: Lane; leans?: "yes" | "no" } {
  if (rec === "Take the call") return { lane: "yes" };
  if (score < t.noBelow || g1Tripped) return { lane: "no" };
  return { lane: "your_call", leans: score >= t.leansYes || (score >= t.take && anyGate) ? "yes" : "no" };
}
export type Rankable = { id: string; score: number; bucket: "clear" | "flagged" | "outside"; coverage: number; createdAt: string };
const B = { clear: 0, flagged: 1, outside: 2 } as const;
/** Bucket, then score, then evidence coverage, then oldest first. */
export function rank<T extends Rankable>(xs: T[]): T[] {
  return [...xs].sort((a, b) => B[a.bucket] - B[b.bucket] || b.score - a.score || b.coverage - a.coverage || a.createdAt.localeCompare(b.createdAt));
}
export const bucketOf = (g1Tripped: boolean, anyGate: boolean): Rankable["bucket"] => g1Tripped ? "outside" : anyGate ? "flagged" : "clear";
