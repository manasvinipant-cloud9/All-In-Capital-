// Retrieval of past deal-memo passages for the scorer. Word-overlap stand-in for the pgvector search (same interface).
import { getMemos, redactMemo } from "./seedData.ts";

const stem = (s: string) => new Set(s.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(w => w.length > 3).map(w => w.slice(0, 5)));

/** Top matching memos with the company and founder names removed. Only the closest few go into a prompt, never every memo. */
export function topMemos(text: string, n = 2) {
  const mine = stem(text);
  return getMemos().map(m => ({ m, o: [...stem(`${m.what} ${m.founder} ${m.risks}`)].filter(x => mine.has(x)).length }))
    .filter(x => x.o >= 3).sort((a, b) => b.o - a.o).slice(0, n)
    .map(({ m }) => redactMemo(m, `Past memo (${m.outcome}): ${m.what} Founder: ${m.founder} Risks: ${m.risks} Why: ${m.why}`));
}
