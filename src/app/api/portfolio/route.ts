import { requirePartner } from "../../../lib/auth";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
const FILE = ".local/portfolio-edits.json";
export async function POST(req: Request) {
  const no = await requirePartner(); if (no) return no;
  const b = await req.json();
  if (typeof b.name !== "string" || typeof b.one_liner !== "string" || b.one_liner.length > 300) return Response.json({ error: "bad_request" }, { status: 400 });
  const known = (JSON.parse(readFileSync("seed/portfolio.json", "utf8")) as { name: string }[]).some(p => p.name === b.name);
  if (!known) return Response.json({ error: "unknown_company" }, { status: 404 });
  const all = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : {}; all[b.name] = { one_liner: b.one_liner.trim() };
  mkdirSync(".local", { recursive: true }); writeFileSync(FILE, JSON.stringify(all, null, 2));
  return Response.json({ ok: true });
}
