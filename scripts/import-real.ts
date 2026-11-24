// Imports the fund's real seed data (as provided) into seed/. Re-runnable. Usage: pnpm tsx scripts/import-real.ts "<apps folder>" "<seed data folder>"
// Replaces every earlier generated (fictional) seed file.
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { extractText, getDocumentProxy } from "unpdf";
import { isTableForm, normalizeSector, parseFormTable } from "../src/lib/intake/form.ts";

const [APPS_DIR, DATA_DIR] = process.argv.slice(2);
if (!APPS_DIR || !DATA_DIR) { console.error('Usage: pnpm tsx scripts/import-real.ts "<Startup Applications & Seed Data>" "<Seed Data>"'); process.exit(2); }

async function pdfText(path: string): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(readFileSync(path)));
  const { text } = await extractText(pdf, { mergePages: false });
  return (text as string[]).join("\n");
}
for (const d of ["seed/decks", "seed/forms", "seed/memos", "seed/meetings", "seed/exports", "seed/source"]) { rmSync(d, { recursive: true, force: true }); mkdirSync(d, { recursive: true }); }
for (const f of ["seed/portfolio.json", "seed/traps.json", "seed/apps.json", "seed/memos.json", "seed/meetings.json", "seed/README.md"]) rmSync(f, { force: true });

// 1) Applications: <Name>_Deck.pdf and <Name>_Form*.pdf
const files = readdirSync(APPS_DIR).filter(f => f.endsWith(".pdf"));
const names = [...new Set(files.filter(f => /_Deck\.pdf$/.test(f)).map(f => f.replace(/_Deck\.pdf$/, "")))].sort();
const apps: unknown[] = [];
for (const name of names) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const formFile = files.find(f => f.startsWith(`${name}_Form`));
  if (!formFile) { console.error(`No form for ${name}`); continue; }
  copyFileSync(`${APPS_DIR}/${name}_Deck.pdf`, `seed/decks/${slug}.pdf`); copyFileSync(`${APPS_DIR}/${formFile}`, `seed/forms/${slug}.pdf`);
  const text = await pdfText(`${APPS_DIR}/${formFile}`);
  if (!isTableForm(text)) console.error(`WARNING: ${formFile} was not recognised as the fund's form layout`);
  const form = parseFormTable(text);
  writeFileSync(`seed/forms/${slug}.json`, JSON.stringify(form, null, 2));
  apps.push({ slug, company: form.Company, sector: normalizeSector(form.Sector ?? ""), stage: form.Stage, city: form.City ?? "" });   // the form keeps the sector as the founder selected it
}
writeFileSync("seed/apps.json", JSON.stringify(apps, null, 2));

// 2) Deal memos
const memoFile = files.find(f => /Deal Memos/i.test(f))!, memoText = await pdfText(`${APPS_DIR}/${memoFile}`);
copyFileSync(`${APPS_DIR}/${memoFile}`, "seed/source/deal-memos.pdf");
const body = memoText.slice(memoText.indexOf("Memo 1:")).replace(/\n/g, " ").replace(/\s+/g, " ");
const memos = [...body.matchAll(/Memo (\d+): (.+?) Sector: (.+?) \| Stage: (.+?) \| Source: (.+?) \| Decision: (INVESTED|PASSED) What it does\. (.+?) Founder assessment\. (.+?) Risks and open questions\. (.+?) Why we (?:invested|passed)\. (.+?)(?= Memo \d+: |$)/g)]
  .map(m => ({ n: +m[1], company: m[2].trim(), sector: m[3].trim(), stage: m[4].trim(), source: m[5].trim(), outcome: m[6] === "INVESTED" ? "invested" : "passed", what: m[7].trim(), founder: m[8].trim(), risks: m[9].trim(), why: m[10].trim() }));
if (memos.length !== 12) console.error(`WARNING: expected 12 memos, parsed ${memos.length}`);
writeFileSync("seed/memos.json", JSON.stringify(memos, null, 2));

// 3) Partner meeting notes
const notesFile = files.find(f => /Meeting Notes/i.test(f))!, notesText = await pdfText(`${APPS_DIR}/${notesFile}`);
copyFileSync(`${APPS_DIR}/${notesFile}`, "seed/source/partner-meeting-notes.pdf");
const parts = notesText.split(/\n(?=Meeting \d+ - )/).slice(1).map(p => ({ title: p.split("\n")[0].trim(), text: p.replace(/\n--- page .*$/gm, "").trim() }));
writeFileSync("seed/meetings.json", JSON.stringify(parts, null, 2));

// 4) Portfolio: only what the provided files say. The memos name six backed companies and meeting 4 names MeetRecord.
const first = (s: string) => s.split(/(?<=\.)\s/).slice(0, 2).join(" ").trim();   // the first two sentences describe the product
const portfolio = [...memos.filter(m => m.outcome === "invested").map(m => ({ name: m.company, one_liner: first(m.what), sector: m.sector, status: "active", tags: [m.sector.split(" ")[0].toLowerCase()], domain: "", source_url: "", source_note: `Deal memo ${m.n} (invested)` })),
  { name: "MeetRecord", one_liner: "Meeting notes and call summaries (a meeting-notes and call-summary product).", sector: "Software", status: "active", tags: ["meetings", "call summaries"], domain: "", source_url: "", source_note: "Partner Meeting Notes, meeting 4. The description is inferred from the overlap discussed there; the fund's own wording was not provided." }];
writeFileSync("seed/portfolio.json", JSON.stringify(portfolio, null, 2));

// 5) The two exports, operating facts and the training template
for (const [src, dst] of [["AIC_B6_Loop1_Screening_Export.csv", "seed/exports/loop1_screening.csv"], ["AIC_B6_Loop2_Email_Export.csv", "seed/exports/loop2_first_email.csv"], ["AIC_B6_Operating_Facts.pdf", "seed/source/operating-facts.pdf"], ["AIC_B6_Training_Data_Template.xlsx", "seed/source/training-data-template.xlsx"]] as const) copyFileSync(`${DATA_DIR}/${src}`, dst);
writeFileSync("seed/README.md", `# Seed data

The fund's real seed data, as provided: ${names.length} applications (deck and form each), twelve deal memos, partner meeting notes, the two B6 exports and the operating facts. Founder names and companies in these files are as supplied by the fund.

- \`decks/<app>.pdf\`, \`forms/<app>.pdf\`: the application documents. \`forms/<app>.json\` is the form read by \`parseFormTable\`.
- \`apps.json\`, \`memos.json\`, \`meetings.json\`: structured from the PDFs in \`source/\`.
- \`portfolio.json\`: **partial**. Only the six backed companies named in the memos and MeetRecord (meeting 4). The full 22-company portfolio list was not provided.
- \`exports/\`: Loop 1 (40 screening rows) and Loop 2 (60 first-email rows).

Re-import with \`pnpm tsx scripts/import-real.ts "<applications folder>" "<seed data folder>"\`.
`);
console.log(`apps ${apps.length}, memos ${memos.length}, meetings ${parts.length}, portfolio ${portfolio.length}`);
