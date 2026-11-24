import { currentSession } from "../../../lib/auth";
import { intakeLimiter, MAX_PDF } from "../../../lib/intake/limits";
import { saveApplication } from "../../../lib/intake/save";

const TYPED = ["company", "founderName", "email", "phone", "linkedin", "sector", "stage", "round", "valuation", "team", "revenue", "background", "city"] as const;
const LABELS: Record<(typeof TYPED)[number], string> = { company: "Company", founderName: "Founder name", email: "Email", phone: "Phone", linkedin: "LinkedIn", sector: "Sector", stage: "Stage", round: "Round size", valuation: "Valuation (post-money)", team: "Team size", revenue: "Revenue", background: "Founder background", city: "City" };
const fail = (message: string, status = 400, extra: Record<string, unknown> = {}) => Response.json({ ok: false, message, ...extra }, { status });

export async function POST(req: Request) {
  const who = (await currentSession())?.email ?? "local";
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  const rl = intakeLimiter.hit(`${who}|${ip}`);
  if (!rl.ok) return fail("Too many uploads. Please wait a bit and try again.", 429, { retryAfterSec: rl.retryAfterSec });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_PDF * 2 + 1024 * 1024) return fail("The upload is too big. Each file can be up to 16 MB.", 413);
  let fd: FormData;
  try { fd = await req.formData(); } catch { return fail("The upload could not be read. Please try again."); }
  const deck = fd.get("deck"), form = fd.get("form");
  if (!(deck instanceof File) || deck.size === 0) return fail("Add the pitch deck as a PDF.");
  const typed: Record<string, string> = {};
  for (const k of TYPED) { const v = fd.get(k); if (typeof v === "string" && v.trim()) typed[LABELS[k]] = v; }
  const r = await saveApplication({ deck: new Uint8Array(await deck.arrayBuffer()), formFile: form instanceof File && form.size > 0 ? new Uint8Array(await form.arrayBuffer()) : undefined, typed, addedBy: who });
  return r.ok ? Response.json(r) : fail(r.message);
}
