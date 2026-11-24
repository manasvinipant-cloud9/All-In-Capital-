// Every claim cites its source. Uncited output is rejected and retried once with the reason.
import type { Page } from "./ingest.ts";
export type Claim = { metric: string; value: string | number; unit?: string; period?: string; quote: string; page: number };
const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

export function validateClaim(c: Claim, pages: Page[]): string | null {
  const p = pages.find(x => x.page === c.page);
  if (!p) return `page ${c.page} does not exist`;
  if (c.quote.trim().split(/\s+/).length > 25) return "quote longer than 25 words";
  if (!norm(p.text).includes(norm(c.quote))) return "quote not found verbatim on that page";
  return null;
}
export type ScoreOut = { criterion: string; score: number; confidence: "high" | "med" | "low"; claim_ids: string[]; rationale: string; gap?: string };
/** Uncited output above 2 is rejected. Missing evidence scores 2 with low confidence and the gap named. */
export function validateScore(s: ScoreOut): string | null {
  if (s.score < 0 || s.score > 10) return "score outside 0-10";
  if (s.score > 2 && s.claim_ids.length === 0) return "score above 2 needs at least one cited claim";
  if (s.score <= 2 && s.claim_ids.length === 0 && (s.confidence !== "low" || !s.gap)) return "missing evidence must be low confidence and name the gap";
  return null;
}
export const WEIGHTS = { C1: 0.25, C2: 0.2, C3: 0.2, C4: 0.15, C5: 0.1, C6: 0.1 } as const;
export const missing = (criterion: string): ScoreOut => ({ criterion, score: 2, confidence: "low", claim_ids: [], rationale: "No evidence found.", gap: `No evidence for ${criterion}` });
/** Total computed in code, never by the model. */
export function total(scores: Record<string, number>, w: Record<string, number> = WEIGHTS): number {
  const sum = Object.values(w).reduce((a, b) => a + b, 0);
  return Math.round(Object.entries(w).reduce((a, [k, v]) => a + (scores[k] ?? 2) * v, 0) / sum * 100) / 100;
}
