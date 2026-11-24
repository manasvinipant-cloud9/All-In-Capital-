// The research query plan is built in code. Queries carry only the company name, the founders' names and the sector:
// never deck content, never an email, phone number or LinkedIn link.
export type Purpose = "company" | "founder" | "conflict";
export type Query = { query: string; purpose: Purpose; subject: string };

const FIXED = new Set(["india", "or", "funding", "raised", "launch", "career", "experience", "founder", "lawsuit", "fraud", "complaint", "controversy"]);
const NAME_OK = /^[\p{L}\p{N} &.'’-]{2,60}$/u;
const words = (s: string) => s.toLowerCase().replace(/["]/g, " ").split(/\s+/).filter(Boolean).map(w => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")).filter(Boolean);

export function cleanName(s: string, what: string): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (!NAME_OK.test(t)) throw new Error(`${what} is not safe to search for`);
  return t;
}

export function buildQueries(o: { company: string; founders: string[]; sector: string }): Query[] {
  const company = cleanName(o.company, "company name"), sector = cleanName(o.sector || "startup", "sector");
  const founders = o.founders.slice(0, 3).map(f => cleanName(f, "founder name"));
  const q: Query[] = [
    { query: `"${company}" ${sector} India`, purpose: "company", subject: company },
    { query: `"${company}" funding OR raised OR launch`, purpose: "company", subject: company },
  ];
  for (const f of founders) {
    q.push({ query: `"${f}" "${company}"`, purpose: "founder", subject: f }, { query: `"${f}" career OR experience`, purpose: "founder", subject: f });
  }
  q.push({ query: `"${company}" lawsuit OR fraud OR complaint OR controversy`, purpose: "conflict", subject: company });
  for (const f of founders) q.push({ query: `"${f}" controversy OR lawsuit OR fraud`, purpose: "conflict", subject: f });
  const out = q.slice(0, 12);
  for (const x of out) assertSafeQuery(x.query, { company, founders, sector });
  return out;
}

/** Throws unless every word is a name we were given or a fixed word from the plan. This is what keeps deck content out of a search. */
export function assertSafeQuery(query: string, o: { company: string; founders: string[]; sector: string }) {
  if (/@|https?:|www\.|linkedin|\d{6,}/i.test(query)) throw new Error("Research guard: query contains an email, link or long number");
  const allowed = new Set([...FIXED, ...words(o.company), ...words(o.sector), ...o.founders.flatMap(words)]);
  const bad = words(query).filter(w => !allowed.has(w));
  if (bad.length) throw new Error(`Research guard: query contains words that are not names or plan words: ${bad.slice(0, 3).join(", ")}`);
}
