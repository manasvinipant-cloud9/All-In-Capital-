import { readFileSync } from "node:fs";
import { pdfPages, parseForm } from "../pipeline/ingest.ts";
import { foundersOf } from "../pipeline/score.ts";
import { APPS } from "../../../scripts/seed/apps.ts";
import { draftEmail } from "./draft.ts";
import { styleExamples } from "./examples.ts";
import { isDeeptech } from "./offline.ts";
import { candidateSlots, fillSlots } from "./slots.ts";
import { lint } from "./lint.ts";
import type { Transport } from "../gateway/index.ts";

const PRIVATE = new Set(["Email", "Phone", "LinkedIn"]);

/** Model draft of the first email for one application. Riya's two real free times are filled in before she sees it. */
export async function draftForApp(slug: string, o: { transport: Transport; names: { primary: string; fallback: string }; note?: string; now?: Date }) {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error("bad application id");
  const meta = APPS.find(a => a.slug === slug); if (!meta) throw new Error("unknown application");
  const form = parseForm(readFileSync(`seed/forms/${slug}.json`, "utf8")), deck = await pdfPages(`seed/decks/${slug}.pdf`);
  const facts = [`Sector: ${meta.sector}`, `Stage: ${meta.stage}`, ...Object.entries(form).filter(([k]) => !PRIVATE.has(k)).map(([k, v]) => `${k}: ${v}`), `Deck: ${deck.slice(0, 3).map(p => p.text).join(" ")}`].join("\n");
  const deeptech = isDeeptech(meta.sector);
  const r = await draftEmail({ template: "invite", facts, examples: styleExamples(meta.sector), founders: foundersOf(form, deck), deeptech, ...o.names, transport: o.transport, note: o.note?.slice(0, 200), application: slug });
  const offered = candidateSlots({ now: o.now ?? new Date() });
  const body = offered.length === 2 ? fillSlots(r.body, offered) : r.body;
  const issues = lint({ template: "invite", subject: r.subject, body, deeptech });
  return { subject: r.subject, body, offered: offered.map(d => d.toISOString()), issues, passed: r.passed && issues.length === 0, attempts: r.attempts };
}
