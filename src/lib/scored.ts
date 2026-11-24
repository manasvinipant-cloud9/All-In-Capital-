// Saved model scores, one file per application (development store; production would use the scores table).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { Claim } from "./pipeline/validate.ts";

export type Scored = {
  slug: string; scores: Record<string, number>; confidence: Record<string, "high" | "med" | "low">; rationale: Record<string, string>; gaps: Record<string, string>;
  claims: Claim[]; rubricVersion: number; promptVersion: number; model: string; scoredAt: string; corrections: number; memos: number;
};
const dir = ".local/scores";
export function saveScored(s: Scored) { mkdirSync(dir, { recursive: true }); writeFileSync(`${dir}/${s.slug}.json`, JSON.stringify(s, null, 2)); }
export function loadScored(slug: string): Scored | null { const f = `${dir}/${slug}.json`; return /^[a-z0-9-]+$/.test(slug) && existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null; }
