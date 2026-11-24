// Model-backed steps. They only talk to the gateway; transport is injected (mocked in tests, real once keys exist).
import { callModel, type Transport } from "../gateway/index.ts";
import { redact } from "../gateway/guards.ts";
import { validateClaim, validateScore, type Claim, type ScoreOut } from "./validate.ts";
import type { Page } from "./ingest.ts";

type Ctx = { transport: Transport; primary: string; fallback: string; founders: string[] };
const opts = (c: Ctx) => ({ transport: c.transport, primary: c.primary, fallback: c.fallback });

export async function extractClaims(pages: Page[], c: Ctx): Promise<{ accepted: Claim[]; rejected: { claim: Claim; why: string }[] }> {
  const user = pages.map(p => `[page ${p.page}] ${redact(p.text, c.founders).text}`).join("\n");
  const ask = async (extra = "") => JSON.parse((await callModel({ step: "extract_claims", system: "Extract claims as JSON array of {metric,value,unit,period,quote,page}. Quotes must be verbatim, at most 25 words." + extra, user }, opts(c))).text) as Claim[];
  let claims = await ask(), bad = claims.map(x => [x, validateClaim(x, pages)] as const).filter(([, w]) => w);
  if (bad.length) { claims = await ask(` Previous output rejected: ${bad.map(([, w]) => w).join("; ")}`); bad = claims.map(x => [x, validateClaim(x, pages)] as const).filter(([, w]) => w); }
  return { accepted: claims.filter(x => !validateClaim(x, pages)), rejected: bad.map(([claim, why]) => ({ claim, why: why! })) };
}

export async function scoreCriterion(criterion: string, evidence: string, c: Ctx): Promise<ScoreOut> {
  const ask = async (extra = "") => JSON.parse((await callModel({ step: `score_${criterion}`, system: `Score criterion ${criterion} 0-10 citing claim ids. Return JSON {criterion,score,confidence,claim_ids,rationale,gap}.${extra}`, user: redact(evidence, c.founders).text }, opts(c))).text) as ScoreOut;
  let s = await ask(), why = validateScore(s);
  if (why) { s = await ask(` Previous output rejected: ${why}`); why = validateScore(s); }
  if (why) return { criterion, score: 2, confidence: "low", claim_ids: [], rationale: "Rejected as uncited.", gap: why };
  return s;
}
