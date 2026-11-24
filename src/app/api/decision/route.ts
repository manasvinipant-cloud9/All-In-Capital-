import { addDecision } from "../../../lib/decisions";
export async function POST(req: Request) {
  const b = await req.json();
  if (!["yes", "no"].includes(b.decision) || !b.slug) return Response.json({ error: "bad_request" }, { status: 400 });
  const d = addDecision({ slug: b.slug, company: String(b.company ?? ""), decision: b.decision, note: String(b.note ?? "").slice(0, 500), rec: String(b.rec ?? ""), by: "team" });
  return Response.json({ ok: true, against: d.against });
}
