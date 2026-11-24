// Model-backed steps. They only talk to the gateway; transport is injected (mocked in tests, real once keys exist).
import { callModel, type Transport } from "../gateway/index.ts";
import { redact } from "../gateway/guards.ts";
import { validateClaim, validateScore, type Claim, type ScoreOut } from "./validate.ts";
import { parseJson } from "./json.ts";
import type { Page } from "./ingest.ts";

export type Ctx = { transport: Transport; primary: string; fallback: string; founders: string[]; application?: string };
const opts = (c: Ctx) => ({ transport: c.transport, primary: c.primary, fallback: c.fallback });

/**
 * One call per document. The model sees redacted pages, so quotes are checked against the same redacted text it saw.
 * Every quote must appear verbatim on its page; rejected claims are retried once with the reason.
 */
export async function extractClaims(pages: Page[], c: Ctx, idPrefix = "c"): Promise<{ accepted: Claim[]; rejected: { claim: Claim; why: string }[] }> {
  const seen = pages.map(p => ({ page: p.page, text: redact(p.text, c.founders).text }));
  const user = seen.map(p => `[page ${p.page}] ${p.text}`).join("\n");
  const ask = async (extra = "") => parseJson<Claim[]>((await callModel({ step: "extract_claims", application: c.application, system: "Extract claims as a JSON array of {metric,value,unit,period,quote,page}. Quotes must be verbatim, at most 25 words." + extra, user }, opts(c))).text);
  const check = (xs: Claim[]) => xs.map(x => [x, validateClaim(x, seen)] as const);
  let claims = await ask(), res = check(claims);
  if (res.some(([, w]) => w)) { claims = await ask(` Previous output rejected: ${res.filter(([, w]) => w).map(([, w]) => w).join("; ")}`); res = check(claims); }
  const accepted = res.filter(([, w]) => !w).map(([x], i) => ({ ...x, id: `${idPrefix}${i + 1}` }));
  return { accepted, rejected: res.filter(([, w]) => w).map(([claim, why]) => ({ claim, why: why! })) };
}

/** Scores one criterion. Uncited output above 2 is rejected and retried once; citing an id that does not exist is also rejected. */
export async function scoreCriterion(criterion: string, evidence: string, c: Ctx, o: { known?: Set<string>; guide?: string } = {}): Promise<ScoreOut> {
  const system = `Score criterion ${criterion} from 0 to 10 using only the evidence given, citing claim ids from it. ${o.guide ?? ""} Return JSON {criterion,score,confidence,claim_ids,rationale,gap}. confidence is high, med or low. If the evidence is missing, score 2 with low confidence and name the gap.`;
  const check = (s: ScoreOut) => validateScore(s) ?? (o.known && s.claim_ids.some(id => !o.known!.has(id)) ? `cited claim ids that do not exist: ${s.claim_ids.filter(id => !o.known!.has(id)).join(", ")}` : null);
  const ask = async (extra = "") => parseJson<ScoreOut>((await callModel({ step: `score_${criterion}`, application: c.application, system: system + extra, user: redact(evidence, c.founders).text }, opts(c))).text);
  let s = await ask(), why = check(s);
  if (why) { s = await ask(` Previous output rejected: ${why}`); why = check(s); }
  if (why) return { criterion, score: 2, confidence: "low", claim_ids: [], rationale: "Rejected as uncited.", gap: why };
  return { ...s, criterion };
}
