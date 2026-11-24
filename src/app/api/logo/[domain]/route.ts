import { readFileSync } from "node:fs";
// Serves site icons ONLY for portfolio domains. Anything else is 404.
export async function GET(_: Request, { params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  const ok = (JSON.parse(readFileSync("seed/portfolio.json", "utf8")) as { domain: string }[]).some(p => p.domain === domain);
  if (!ok) return new Response("not found", { status: 404 });
  try {
    const r = await fetch(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return new Response("not found", { status: 404 });
    return new Response(await r.arrayBuffer(), { headers: { "Content-Type": r.headers.get("content-type") ?? "image/png", "Cache-Control": "public, max-age=86400" } });
  } catch { return new Response("not found", { status: 404 }); }
}
