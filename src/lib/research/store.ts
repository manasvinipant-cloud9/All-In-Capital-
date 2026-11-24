import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { Fact } from "./extract.ts";
import type { Purpose } from "./plan.ts";
import type { Tier } from "./rank.ts";
import type { Verification } from "./verify.ts";

export type PageLog = { url: string; tier: Tier; purpose: Purpose; subject: string; status: "used" | "no_facts" | "set_aside" | "not_read"; note?: string };
export type Research = {
  slug: string; available: boolean; reason?: string; searchedAt: string; founders: string[];
  queries: { query: string; purpose: Purpose; subject: string; results: number; error?: string }[];   // every query, including empty ones
  pages: PageLog[]; facts: Fact[]; verifications: Verification[]; conflicts: Fact[]; profileLinks: { label: string; url: string }[];
};
const dir = ".local/research";
export function saveResearch(r: Research) { mkdirSync(dir, { recursive: true }); writeFileSync(`${dir}/${r.slug}.json`, JSON.stringify(r, null, 2)); }
export function loadResearch(slug: string): Research | null { const f = `${dir}/${slug}.json`; return /^[a-z0-9-]+$/.test(slug) && existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null; }
