import type { Hit } from "./web.ts";
// Primary sources beat aggregators. "primary" = the company's own site and official registries. "press" = established news outlets.
export type Tier = "primary" | "press" | "other" | "aggregator";
const AGG = ["crunchbase.com", "tracxn.com", "pitchbook.com", "zaubacorp.com", "owler.com", "rocketreach.co", "apollo.io", "zoominfo.com", "craft.co", "growjo.com", "cbinsights.com", "linkedin.com", "dnb.com", "signalhire.com", "clay.com", "theorg.com", "wikitia.com"];
const PRESS = ["economictimes.indiatimes.com", "livemint.com", "business-standard.com", "thehindu.com", "hindustantimes.com", "indianexpress.com", "ndtv.com", "financialexpress.com", "moneycontrol.com", "inc42.com", "yourstory.com", "entrackr.com", "techcrunch.com", "reuters.com", "bloomberg.com", "forbes.com", "thehindubusinessline.com", "timesofindia.indiatimes.com", "bbc.com"];
const OFFICIAL = ["gov.in", "nic.in", "mca.gov.in", "sebi.gov.in", "rbi.org.in", "sec.gov", "ac.in", "edu"];
const host = (url: string) => new URL(url).hostname.toLowerCase().replace(/^www\./, "");
const under = (h: string, d: string) => h === d || h.endsWith(`.${d}`);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function tierOf(url: string, company: string): Tier {
  let h: string; try { h = host(url); } catch { return "other"; }
  if (AGG.some(d => under(h, d))) return "aggregator";
  if (OFFICIAL.some(d => under(h, d))) return "primary";
  const c = slug(company); if (c.length >= 4 && slug(h.split(".")[0]).includes(c)) return "primary";   // the company's own site
  if (PRESS.some(d => under(h, d))) return "press";
  return "other";
}
export const domainOf = (url: string) => { try { return host(url); } catch { return url; } };
const ORDER: Record<Tier, number> = { primary: 0, press: 1, other: 2, aggregator: 3 };

/** Best first, one page once, at most two pages from one site. */
export function rankHits(hits: Hit[], company: string, max = 3): (Hit & { tier: Tier })[] {
  const seen = new Set<string>(), perHost = new Map<string, number>(), out: (Hit & { tier: Tier })[] = [];
  const tagged = hits.map((h, i) => ({ ...h, tier: tierOf(h.url, company), i })).sort((a, b) => ORDER[a.tier] - ORDER[b.tier] || a.i - b.i);
  for (const h of tagged) {
    let key: string; try { const u = new URL(h.url); key = `${host(h.url)}${u.pathname.replace(/\/$/, "")}`; } catch { continue; }
    if (seen.has(key) || (perHost.get(host(h.url)) ?? 0) >= 2) continue;
    seen.add(key); perHost.set(host(h.url), (perHost.get(host(h.url)) ?? 0) + 1); out.push(h);
    if (out.length >= max) break;
  }
  return out;
}
