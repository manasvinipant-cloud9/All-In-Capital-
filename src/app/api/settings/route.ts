import { saveConfig } from "../../../lib/config";
export async function POST(req: Request) { const r = saveConfig(await req.json()); return Response.json(r, { status: r.ok ? 200 : 422 }); }
