import { loadFiles, validSlug } from "../apps.ts";
import { foundersOf } from "../pipeline/score.ts";
import { draftEmail } from "./draft.ts";
import { styleExamples } from "./examples.ts";
import { isDeeptech } from "./offline.ts";
import { candidateSlots, fillSlots } from "./slots.ts";
import { lint } from "./lint.ts";
import type { Transport } from "../gateway/index.ts";

const PRIVATE = new Set(["Email", "Phone", "LinkedIn"]);

/** Model draft of the first email for one application. Riya's two real free times are filled in before she sees it. */
export async function draftForApp(slug: string, o: { transport: Transport; names: { primary: string; fallback: string }; note?: string; now?: Date }) {
  if (!validSlug(slug)) throw new Error("bad application id");
  const { meta, form, deck } = await loadFiles(slug);
  const facts = [`Sector: ${meta.sector}`, `Stage: ${meta.stage}`, ...Object.entries(form).filter(([k]) => !PRIVATE.has(k)).map(([k, v]) => `${k}: ${v}`), `Deck: ${deck.slice(0, 3).map(p => p.text).join(" ")}`].join("\n");
  const deeptech = isDeeptech(meta.sector);
  const r = await draftEmail({ template: "invite", facts, examples: styleExamples(meta.sector), founders: foundersOf(form, deck), deeptech, ...o.names, transport: o.transport, note: o.note?.slice(0, 200), application: slug });
  const offered = candidateSlots({ now: o.now ?? new Date() });
  const body = offered.length === 2 ? fillSlots(r.body, offered) : r.body;
  const issues = lint({ template: "invite", subject: r.subject, body, deeptech });
  return { subject: r.subject, body, offered: offered.map(d => d.toISOString()), issues, passed: r.passed && issues.length === 0, attempts: r.attempts };
}
