import { parseInr, parseCount, toCr } from "./units.ts";
import type { Page } from "./ingest.ts";

export type Check = { severity: "red" | "warn" | "info"; name: string; formula: string; detail: string; page?: number; quote?: string };
const TOL = 0.05;
const near = (a: number, b: number) => Math.abs(a - b) <= TOL * Math.max(Math.abs(a), Math.abs(b), 1e-9);
const deckText = (d: Page[]) => d.map(p => p.text).join(" ");
const findPage = (d: Page[], re: RegExp) => { for (const p of d) { const m = p.text.match(re); if (m) return { page: p.page, quote: m[0] }; } return null; };
const isTarget = (s: string) => /\b(in \d+ months|plan to|target|will)\b/i.test(s);

export function tamChecks(deck: Page[]): Check[] {
  const out: Check[] = [];
  for (const p of deck) {
    const sents = p.text.match(/(?:[^.]|\.\d)*\bx\b(?:[^.]|\.\d)*=\s*INR\s*[\d,.]+\s*Cr/gi) ?? [];
    for (const s of sents) {
      const [left, right] = s.split("=");
      const parts = left.split(/\s+x\s+/i);
      if (parts.length < 2) continue;
      const count = parseCount(parts[0].replace(/^.*?:\s*/, ""));
      const price = parseInr(parts[1]);
      const mult = parts[2] ? parseFloat(parts[2]) : 1;
      const stated = parseInr(right);
      if (count == null || price == null || stated == null) continue;
      const calc = toCr(count * price * mult);
      const statedCr = toCr(stated);
      if (!near(calc, statedCr)) out.push({ severity: "red", name: "TAM does not follow from its inputs", formula: `${count} x ${price}${mult !== 1 ? ` x ${mult}` : ""} = ${calc.toLocaleString("en-IN")} Cr, deck says ${statedCr.toLocaleString("en-IN")} Cr`, detail: `Ratio ${(statedCr / calc).toFixed(1)}x. Ask for the inputs.`, page: p.page, quote: s.trim().slice(0, 160) });
    }
  }
  return out;
}

export function reconcile(form: Record<string, string>, deck: Page[]): Check[] {
  const out: Check[] = [...tamChecks(deck)];
  const all = deckText(deck);
  // Team size
  const ft = parseInt(form["Team size"] ?? "");
  const dt = findPage(deck, /(?:team of|\b)(\d+)\s*(?:people|engineers|employees)|team of (\d+)/i);
  if (!isNaN(ft) && dt) {
    const dn = parseInt(dt.quote.match(/\d+/)![0]);
    if (dn !== ft) out.push({ severity: "red", name: "Team size differs", formula: `form ${ft} vs deck ${dn}`, detail: "Ask which is current.", ...dt });
  }
  // Paying customers
  const fp = form["Paying customers"]?.match(/(\d+)\s*paying/i), dp = findPage(deck, /(\d+)\s*paying/i);
  if (fp && dp && parseInt(fp[1]) !== parseInt(dp.quote.match(/\d+/)![0])) out.push({ severity: "warn", name: "Paying customer count differs", formula: `form ${fp[1]} vs deck ${dp.quote.match(/\d+/)![0]}`, detail: `Form: "${form["Paying customers"]}". Ask how trials are counted.`, ...dp });
  // Live customers
  const fl = form["Pilots"]?.match(/(\d+)\s*live/i), dl = findPage(deck, /(\d+)\s*live/i);
  if (fl && dl && parseInt(fl[1]) !== parseInt(dl.quote.match(/\d+/)![0])) out.push({ severity: "red", name: "Live customers differ", formula: `form ${fl[1]} live (${form["Pilots"]}) vs deck ${dl.quote}`, detail: "Ask which are paying and live.", ...dl });
  // Revenue
  const fr = parseInr(form["Revenue"] ?? "");
  if (fr && fr > 0) {
    const amts = [...all.matchAll(/(?:INR|₹)\s*[\d,.]+\s*(?:L|Cr|lakh|crore)?/gi)].map(m => parseInr(m[0])!).filter(Boolean);
    if (!amts.some(a => near(a, fr))) out.push({ severity: "warn", name: "Form revenue not found in deck", formula: `form ${form["Revenue"]}`, detail: "No matching figure in the deck." });
  }
  // Credentials
  let credFlagged = false;
  for (const term of ["Goldman", "Google", "IIM"]) {
    if (credFlagged) break;
    const d = findPage(deck, new RegExp(`[^.]*${term}[^.]*`, "i"));
    if (!d) continue;
    const bg = form["Founder background"] ?? "";
    const m = bg.match(new RegExp(`[^.,]*${term}[^.]*`, "i"));
    if (m && /intern|vendor|contract|tier-2/i.test(bg)) { credFlagged = true; out.push({ severity: "red", name: "Credentials differ", formula: `deck: "${d.quote.trim()}" vs form: "${bg}"`, detail: "Role, tenure or school in the form is smaller than the deck implies.", ...d }); }
    else if (!m && /IIM/i.test(term) && /tier-2/i.test(bg)) out.push({ severity: "red", name: "Credential differs: MBA", formula: `deck: "${d.quote.trim()}" vs form: "${bg}"`, detail: "School differs.", ...d });
  }
  const mba = findPage(deck, /MBA IIM[^.,]*/i);
  if (mba && !credFlagged && /tier-2/i.test(form["Founder background"] ?? ""))
    out.push({ severity: "red", name: "Credentials differ", formula: `deck "${mba.quote}" vs form "tier-2 business school"`, detail: "School differs.", ...mba });
  return out;
}
export const hasRed = (c: Check[]) => c.some(x => x.severity === "red");
void isTarget;
