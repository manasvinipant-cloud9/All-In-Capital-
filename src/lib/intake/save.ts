import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { extractText, getDocumentProxy } from "unpdf";
import { BASE, listMeta, pathsFor, validSlug, type Meta } from "../apps.ts";
import { pdfPages } from "../pipeline/ingest.ts";
import { enqueue } from "../queue.ts";
import { normalizeForm, parseFormJson, parseFormText } from "./form.ts";
import { checkPdf, MAX_FORM_TEXT, MAX_PAGES } from "./limits.ts";

export type Saved = { ok: true; slug: string; company: string; duplicate: boolean; warnings: string[] } | { ok: false; message: string };
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "application";

async function readFormFile(bytes: Uint8Array): Promise<Record<string, string> | string> {
  if (bytes.length > MAX_FORM_TEXT * 16) return "The form file is too big.";
  if (!checkPdf(bytes, "form")) {
    try { const { text } = await extractText(await getDocumentProxy(bytes.slice()), { mergePages: true }); return parseFormText(String(text)); }
    catch { return "The form PDF could not be read. Type the details in the box below instead."; }
  }
  if (bytes.length > MAX_FORM_TEXT) return "The form file is too big.";
  const text = new TextDecoder("utf-8").decode(bytes);
  if (text.trimStart().startsWith("{")) { try { return parseFormJson(JSON.parse(text)); } catch { return "The form file is not valid JSON."; } }
  return parseFormText(text);
}

/**
 * Saves one application: the deck PDF, the normalised form and a record, then queues it. Everything uploaded is treated as data.
 * Nothing from a file name or a field ever becomes part of a path: the folder name is built from a checked slug.
 */
export async function saveApplication(i: { deck: Uint8Array; formFile?: Uint8Array; typed?: Record<string, string>; addedBy: string; now?: Date }): Promise<Saved> {
  const bad = checkPdf(i.deck, "deck"); if (bad) return { ok: false, message: bad };
  const sha = createHash("sha256").update(i.deck).digest("hex");
  const dup = listMeta().find(m => m.deckSha === sha);
  if (dup) return { ok: true, slug: dup.slug, company: dup.company, duplicate: true, warnings: [] };

  let read: Record<string, string> = {};
  if (i.formFile && i.formFile.length > 0) { const r = await readFormFile(i.formFile); if (typeof r === "string") return { ok: false, message: r }; read = r; }
  const n = normalizeForm(read, i.typed); if (!n.ok) return n;

  const slug = `${slugify(n.form.Company)}-${sha.slice(0, 6)}`;
  if (!validSlug(slug)) return { ok: false, message: "That company name could not be used. Try a simpler name." };
  const meta: Meta = { slug, company: n.form.Company, sector: n.sector, stage: n.stage, city: n.city, source: "uploaded", addedAt: (i.now ?? new Date()).toISOString(), addedBy: i.addedBy, deckSha: sha };
  const dir = `${BASE}/${slug}`, p = pathsFor(meta), warnings = [...n.warnings];
  mkdirSync(dir, { recursive: true });
  try {
    writeFileSync(p.deck, i.deck);
    const pages = await pdfPages(p.deck);
    if (pages.length === 0 || pages.length > MAX_PAGES) throw new Error(pages.length === 0 ? "The deck has no pages." : `The deck has more than ${MAX_PAGES} pages.`);
    if (pages.map(x => x.text).join(" ").length < 200) warnings.push("The deck has almost no readable text. It may be scanned images, so scoring will be weak.");
  } catch (e: any) {
    rmSync(dir, { recursive: true, force: true });          // our own folder, built from the checked slug above
    return { ok: false, message: /pages/.test(String(e?.message)) ? e.message : "The deck PDF could not be read. Is it damaged or password protected?" };
  }
  writeFileSync(p.form, JSON.stringify(n.form, null, 2)); writeFileSync(`${dir}/meta.json`, JSON.stringify(meta, null, 2));
  appendFileSync(".local/audit.jsonl", JSON.stringify({ at: meta.addedAt, who: i.addedBy, action: "intake", slug }) + "\n");
  enqueue(slug, i.now);
  return { ok: true, slug, company: meta.company, duplicate: false, warnings };
}
