// Form-versus-deck checks and arithmetic. All in code, never in a model. A flag shows both values and says nothing about intent.
import { parseInr, toCr } from "./units.ts";
import type { Page } from "./ingest.ts";

export type Kind = "conflict" | "omission" | "arithmetic" | "assumption_vs_actual" | "overclaim" | "missing";
export type Check = { severity: "red" | "warn" | "info"; kind: Kind; name: string; formula: string; detail: string; page?: number; quote?: string; favoursFounder?: boolean };

const num = (s: string) => parseFloat(s.replace(/,/g, ""));
const UNIT: Record<string, number> = { m: 1e6, k: 1e3, l: 1e5, lakh: 1e5, cr: 1e7, crore: 1e7, "": 1 };
const near = (a: number, b: number, tol = 0.05) => Math.abs(a - b) <= tol * Math.max(Math.abs(a), Math.abs(b), 1e-9);
const fmtIn = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 1 });
const pageOf = (deck: Page[], re: RegExp) => { for (const p of deck) { const m = p.text.match(re); if (m) return { page: p.page, quote: m[0].slice(0, 160) }; } return {}; };
const first = (text: string, re: RegExp) => text.match(re);

/** Market size: "TAM INR 91,200 Cr 38M households ... x INR 2,400 a year" must equal count x price (x multiplier). */
export function tamChecks(deck: Page[]): Check[] {
  const out: Check[] = [];
  for (const p of deck) {
    for (const m of p.text.matchAll(/\b(TAM|SAM)\s+INR\s*([\d,.]+)\s*(lakh Cr|Cr)\s+(.+?)(?=\s(?:TAM|SAM|SOM)\s+INR|\s(?:Spend per|Household counts|Rep counts|300K is|Store counts|Assumptions|Volumes processed)|$)/g)) {
      const [, kind, stated, unit, seg] = m, statedCr = num(stated) * (unit === "lakh Cr" ? 1e5 : 1);
      const c = seg.match(/^~?\s*([\d.,]+)\s*(M|K|L|lakh|crore|Cr)?\b/); if (!c) continue;
      let total = num(c[1]) * (UNIT[(c[2] ?? "").toLowerCase()] ?? 1), shown = `${c[1]}${c[2] ?? ""}`;
      for (const f of seg.slice(c[0].length).matchAll(/\bx\s*(?:INR\s*([\d.,]+)\s*(L|Cr|lakh|crore)?|([\d.,]+))(?![\d.,]*\s*%)/g)) {
        const price = f[1] !== undefined; const v = num(f[1] ?? f[3]) * (price ? UNIT[(f[2] ?? "").toLowerCase()] ?? 1 : 1);
        total *= v; shown += ` x ${price ? "INR " : ""}${f[1] ?? f[3]}${f[2] ? " " + f[2] : ""}`;
      }
      if (/\bx\b/.test(seg) === false) continue;
      const calcCr = toCr(total);
      if (!near(calcCr, statedCr)) out.push({ severity: "red", kind: "arithmetic", name: `${kind} does not follow from its own inputs`, formula: `${shown} = INR ${fmtIn(calcCr)} Cr, but the deck says INR ${fmtIn(statedCr)} Cr (${statedCr < calcCr ? `${(calcCr / statedCr).toFixed(1)}x smaller` : `${(statedCr / calcCr).toFixed(1)}x larger`} than its own inputs give)`, detail: "Ask for the inputs.", page: p.page, quote: m[0].slice(0, 160) });
    }
  }
  return out;
}

const SENTENCE = (t: string, re: RegExp) => t.split(/(?<=[.!?])\s+/).find(s => re.test(s));

export function reconcile(form: Record<string, string>, deck: Page[]): Check[] {
  const out: Check[] = [...tamChecks(deck)];
  const deckAll = deck.map(p => p.text).join(" ");
  // Targets ("In 12 months: ... INR 7 L monthly recurring revenue") are plans, not actuals.
  const D = deckAll.replace(/\bIn \d+ months?:[^|]*$/i, " "), F = Object.entries(form).map(([k, v]) => `${k}: ${v}`).join(" . ");
  const add = (c: Check) => out.push(c);

  // --- Team size ---
  const ft = first(form["Team size"] ?? "", /^\s*(\d+)/), dt = first(D, /Team of (\d+)/i);
  if (ft && dt && ft[1] !== dt[1]) add({ severity: "red", kind: "conflict", name: "Team size differs", formula: `form ${form["Team size"]} vs deck "Team of ${dt[1]}"`, detail: "Ask which is current and who is counted.", ...pageOf(deck, /Team of \d+/i) });

  // --- Customer counts ---
  const countPairs: [string, RegExp][] = [["live enterprise clients", /(\d+)\s+(?:enterprise\s+)?(?:clients?|customers?)\s+live/i], ["retailers onboarded", /(\d+)\s+retailers\s+(?:onboarded|\|)/i], ["paying customers", /(\d+)\s+paying\s+[\w-]+(?:\s+[\w-]+)?/i]];
  for (const [label, re] of countPairs) {
    const a = first(F, re), b = first(D, re);
    if (a && b && num(a[1]) !== num(b[1])) {
      const trial = first(F, /(\d+)\s+(?:on\s+)?(?:free\s+)?(?:trial|pilot)/i);
      add({ severity: label === "paying customers" ? "warn" : "red", kind: "conflict", name: `Count of ${label} differs`, formula: `form ${a[1]} vs deck ${b[1]}${trial && num(a[1]) + num(trial[1]) === num(b[1]) ? ` (${a[1]} + ${trial[1]} on trial = ${b[1]}: trials may be counted as customers)` : ""}`, detail: `Form: "${SENTENCE(F, re)?.slice(0, 120)}". Ask how each is counted.`, ...pageOf(deck, re) });
    }
  }

  // --- Revenue: stated monthly revenue differs; and seats x price does not give it ---
  const fm = first(F, /(?:MRR|monthly recurring revenue)[^.]*?(INR\s*[\d.,]+\s*(?:L|Cr|lakh|crore)?)/i), dm = first(D, /(INR\s*[\d.,]+\s*(?:L|Cr|lakh|crore)?)\s+monthly recurring revenue/i);
  const fmv = fm && parseInr(fm[1]), dmv = dm && parseInr(dm[1]);
  if (fmv && dmv && !near(fmv, dmv)) add({ severity: "red", kind: "conflict", name: "Monthly recurring revenue differs", formula: `form ${fm![1]} vs deck ${dm![1]}`, detail: "Ask which month each figure is from.", ...pageOf(deck, /monthly recurring revenue/i) });
  const seats = first(F, /(\d[\d,]*)\s+paid seats/i), per = first(F, /INR\s*([\d,]+)\s+per seat per month/i);
  const stated = fmv || dmv;
  if (seats && per && stated && !near(num(seats[1]) * num(per[1]), stated, 0.05)) add({ severity: "warn", kind: "arithmetic", name: "Seats times price does not give the stated revenue", formula: `${seats[1]} seats x INR ${per[1]} = INR ${fmtIn(num(seats[1]) * num(per[1]))}; stated ${[fm?.[1], dm?.[1]].filter(Boolean).join(" and ")}`, detail: "It matches neither stated figure. Ask for the seat and price breakdown." });

  // --- CAC: form says "under X", deck shows a higher figure ---
  const fcac = first(F, /CAC[^.]*?(?:under|below)\s*INR\s*([\d,]+)/i), dcac = first(D, /INR\s*([\d,]+)\s+(?:blended\s+)?CAC/i);
  if (fcac && dcac && num(dcac[1]) > num(fcac[1])) add({ severity: "red", kind: "conflict", name: "CAC differs", formula: `form "CAC is under INR ${fcac[1]}" vs deck INR ${dcac[1]} blended CAC`, detail: "The deck says the form's claim is a target, not an actual.", ...pageOf(deck, /blended CAC/i) });

  // --- Payback: CAC / (monthly money per customer x margin) against the stated months ---
  const cac = first(D, /INR\s*([\d,]+)\s+CAC\s+per/i), payback = first(D, /(~?\d+(?:\.\d+)?)\s+months\s+payback/i), pay = first(D, /Average [\w ]+? pays INR\s*([\d,]+)\s+a month/i), gm = first(D, /[Gg]ross margin\s*(\d+)%|(\d+)%\s+gross margin/);
  if (cac && payback && pay && gm) {
    const months = num(cac[1]) / (num(pay[1]) * (num(gm[1] ?? gm[2]) / 100)), claimed = num(payback[1].replace("~", ""));
    if (!near(months, claimed, 0.25)) add({ severity: "red", kind: "arithmetic", name: "Payback does not follow from its own inputs", formula: `INR ${cac[1]} / (INR ${pay[1]} x ${gm[1] ?? gm[2]}%) = ${months.toFixed(1)} months, deck says ${payback[1].replace("~", "")}`, detail: "The deck's payback is longer than its own numbers give. Ask what is included.", ...pageOf(deck, /months\s+payback/i) });
  }

  // --- Assumption versus actual: market size assumes more per customer than the deck's own data shows ---
  const sens = first(D, /x\s*(\d+)\s+(sensors?)/i), avg = first(D, /Average customer:\s*(\d+)\s+sensors?/i) ?? first(F, /average\s+(\d+)\s+per customer/i);
  if (sens && avg && num(sens[1]) / num(avg[1]) > 1.5) add({ severity: "red", kind: "assumption_vs_actual", name: "Market size assumes more than the actual average", formula: `market size assumes ${sens[1]} ${sens[2]} per customer; actual average is ${avg[1]}`, detail: `At ${avg[1]} the market is about ${((num(avg[1]) / num(sens[1])) * 100).toFixed(0)}% of the stated figure.`, ...pageOf(deck, /x\s*\d+\s+sensors/i) });
  const monthly = first(D, /INR\s*([\d.,]+\s*L)\s+monthly purchases/i), gmv = first(D, /INR\s*([\d.,]+\s*L)\s+GMV in \w+/i), stores = first(D, /(\d+)\s+retailers\s+onboarded/i);
  if (monthly && gmv && stores) { const actual = parseInr(`INR ${gmv[1]}`)! / num(stores[1]), assumed = parseInr(`INR ${monthly[1]}`)!; if (assumed / actual > 2) add({ severity: "red", kind: "assumption_vs_actual", name: "Market size assumes far more per store than the actual", formula: `assumes INR ${monthly[1]} a month per store; actual GMV INR ${gmv[1]} / ${stores[1]} stores = INR ${fmtIn(actual)} a month`, detail: `About ${(assumed / actual).toFixed(0)}x higher than the actual.`, ...pageOf(deck, /monthly purchases/i) }); }

  // --- Credit funding: the form and the deck describe different arrangements ---
  if (/credit[^.]*through our NBFC partner|provided through our NBFC partner/i.test(F) && /own capital|NBFC partnership in discussion/i.test(D))
    add({ severity: "red", kind: "conflict", name: "How credit is funded differs", formula: `form: "${SENTENCE(F, /NBFC partner/i)?.slice(0, 110)}" vs deck: "${SENTENCE(D, /own capital/i)?.slice(0, 120)}"`, detail: "Who funds the book, and who carries first loss, decides the structure. Ask for the agreement.", ...pageOf(deck, /own capital/i), favoursFounder: true });

  // --- Credentials: the deck's labels are bigger than what the form describes ---
  const ex = first(D, /Ex-[A-Z][\w ]+\.(?:\s*Ex-[A-Z][\w ]+\.)*(?:\s*MBA,?\s*IIM[\w ]*\.)?/), mba = first(D, /MBA,?\s*IIM[\w ]*/);
  const small = first(F, /(?:summer\s+)?(?:analyst\s+)?intern(?:ship)?[^.]*\.|[^.]*contract\s+role[^.]*\.|tier-2 business school[^.]*/i);
  if ((ex || mba) && small) add({ severity: "red", kind: "conflict", name: "Credentials in the deck are larger than in the form", formula: `deck: "${(ex?.[0] ?? mba![0]).replace(/\s+/g, " ").slice(0, 100)}" vs form: "${(first(F, /Summer[^.]*\.[^.]*\.[^.]*\.|Founder and CEO\.[^|]*?(?:MBA[^.]*\.)/i)?.[0] ?? small[0]).replace(/\s+/g, " ").slice(0, 200)}"`, detail: "The form describes an internship, a vendor contract and a different school. Ask for the roles and dates.", ...pageOf(deck, /Ex-[A-Z]/) });

  // --- Omissions and overclaims in the deck ---
  if (/no direct competitors/i.test(D)) add({ severity: "warn", kind: "overclaim", name: "Deck claims no direct competitors", formula: `deck: "${SENTENCE(D, /no direct competitors/i)?.slice(0, 100)}"`, detail: "Almost every product has a substitute. Ask who the customer uses today.", ...pageOf(deck, /no direct competitors/i) });
  const net = first(F, /net revenue is INR\s*([\d.,]+\s*L)/i), gross = first(F, /INR\s*([\d.,]+\s*L)\s+gross/i);
  if (net && gross && /INR\s*[\d.,]+\s*L\s+revenue \(/i.test(D) && !/\bnet\b/i.test(D.slice(D.search(/revenue \(/i) - 60, D.search(/revenue \(/i) + 60)))
    add({ severity: "warn", kind: "omission", name: "Deck shows gross revenue, form shows net", formula: `deck: INR ${gross[1]} revenue; form: INR ${gross[1]} gross, INR ${net[1]} net after the fee paid to the payment partner`, detail: "Net revenue is about half. Ask which figure the 12-month plan is built on.", ...pageOf(deck, /revenue \(/i) });
  if (/single (?:payment )?(?:aggregator|partner)/i.test(F) && !/single|sole|dependen/i.test(D)) add({ severity: "warn", kind: "omission", name: "Single-partner dependence is not in the deck", formula: `form: "${SENTENCE(F, /single (?:payment )?(?:aggregator|partner)/i)?.slice(0, 120)}"; deck: not mentioned`, detail: "The form discloses a risk the deck leaves out." });
  const th = first(D, /thousands of travell?ers/i), tr = first(F, /about\s+([\d,]+)\s+travell?ers/i);
  if (th && tr) add({ severity: "warn", kind: "overclaim", name: "Deck says thousands, form says about " + tr[1], formula: `deck: "thousands of travellers" vs form: "about ${tr[1]} travellers"`, detail: "1,300 is not thousands. Ask for the booking records.", ...pageOf(deck, /thousands of travell?ers/i) });
  const growth = first(D, /\b(\d+)x growth\b/i);
  if (growth && !/\b(?:Jun|Jul|Aug|Sep|Oct)\b.*\b\d/.test(D)) add({ severity: "warn", kind: "overclaim", name: "Growth multiple with no numbers behind it", formula: `deck: "${growth[0]}" with no figures shown`, detail: "Ask for the months and the base.", ...pageOf(deck, /\d+x growth/i) });
  if (/manual/i.test(F) && !/manual/i.test(D)) add({ severity: "warn", kind: "omission", name: "Manual operations are not in the deck", formula: `form: "${SENTENCE(F, /manual/i)?.slice(0, 120)}"; deck: not mentioned`, detail: "The deck presents the product as automated. Ask what is done by hand." });

  // --- Financing without a loss figure ---
  if (/NBFC|financ|credit book|advances|lend/i.test(F + D) && /invoice financing|credit|advances|financing book/i.test(F + D) && !/(?:defaults?|credit loss(?:es)?|loss rate|NPA|write-?offs?)[^.|]*?(?:\d|none)/i.test(F + D))
    add({ severity: "warn", kind: "missing", name: "No loss or default figure for a business that lends or advances", formula: "no default rate, loss rate or write-off figure in the form or the deck", detail: "Ask for losses to date and who bears them." });

  // --- The founders say they have not measured something ---
  const nm = first(F, /(?:We have not measured|have not measured|not measured)[^.]*\./i);
  if (nm) add({ severity: "info", kind: "missing", name: "A key number is not measured", formula: `form: "${nm[0].slice(0, 110)}"`, detail: "A missing number lowers the score. It is not skipped." });
  return out;
}
export const hasRed = (c: Check[]) => c.some(x => x.severity === "red");
