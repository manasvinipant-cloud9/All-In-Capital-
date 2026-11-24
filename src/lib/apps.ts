// One registry for every application: the fictional seed set and anything uploaded through intake.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { pdfPages, parseForm, type Page } from "./pipeline/ingest.ts";

export type Meta = { slug: string; company: string; sector: string; stage: string; city: string; source: "seed" | "uploaded"; addedAt?: string; addedBy?: string; deckSha?: string };
export const BASE = ".local/applications";
/** Slugs end up in file paths, so only this shape is ever accepted. */
export const validSlug = (s: string) => /^[a-z0-9][a-z0-9-]{0,60}$/.test(s);

function uploaded(): Meta[] {
  if (!existsSync(BASE)) return [];
  return readdirSync(BASE).filter(validSlug).map(s => `${BASE}/${s}/meta.json`).filter(existsSync)
    .map(f => JSON.parse(readFileSync(f, "utf8")) as Meta).sort((a, b) => (a.addedAt ?? "").localeCompare(b.addedAt ?? ""));
}
const seedApps = (): Meta[] => (existsSync("seed/apps.json") ? (JSON.parse(readFileSync("seed/apps.json", "utf8")) as Omit<Meta, "source">[]).map(a => ({ ...a, source: "seed" as const })) : []);
export const listMeta = (): Meta[] => [...seedApps(), ...uploaded()];
export const getMeta = (slug: string) => (validSlug(slug) ? listMeta().find(m => m.slug === slug) : undefined);
export const pathsFor = (m: Pick<Meta, "slug" | "source">) =>
  m.source === "seed" ? { deck: `seed/decks/${m.slug}.pdf`, form: `seed/forms/${m.slug}.json` } : { deck: `${BASE}/${m.slug}/deck.pdf`, form: `${BASE}/${m.slug}/form.json` };

export async function loadFiles(slug: string): Promise<{ meta: Meta; deck: Page[]; form: Record<string, string> }> {
  const meta = getMeta(slug); if (!meta) throw new Error("unknown application");
  const p = pathsFor(meta);
  return { meta, deck: await pdfPages(p.deck), form: parseForm(readFileSync(p.form, "utf8")) };
}
