import { readFileSync } from "node:fs";
import { extractText, getDocumentProxy } from "unpdf";

export type Page = { page: number; text: string };
export async function pdfPages(path: string): Promise<Page[]> {
  const pdf = await getDocumentProxy(new Uint8Array(readFileSync(path)));
  const { text } = await extractText(pdf, { mergePages: false });
  return (text as string[]).map((t, i) => ({ page: i + 1, text: t.replace(/\s+/g, " ").trim() }));
}
/** Form parsed deterministically: JSON object or "Label: value" lines. No model. */
export function parseForm(raw: string): Record<string, string> {
  try { const j = JSON.parse(raw); return Object.fromEntries(Object.entries(j).filter(([k]) => k !== "synthetic").map(([k, v]) => [k, String(v)])); } catch {}
  const out: Record<string, string> = {};
  for (const line of raw.split("\n")) { const m = line.match(/^\s*([^:]{2,40}):\s*(.+)$/); if (m) out[m[1].trim()] = m[2].trim(); }
  return out;
}
