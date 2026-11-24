import { requirePartner } from "../../../lib/auth";
import { saveConfig } from "../../../lib/config";
export async function POST(req: Request) {
  const no = await requirePartner(); if (no) return no; const r = saveConfig(await req.json()); return Response.json(r, { status: r.ok ? 200 : 422 }); }
