// Deterministic form reading (no model): labels are matched by meaning, not position, so differently laid-out forms read the same.
export const REQUIRED = ["Company", "Founder name"] as const;
const ALIASES: Record<string, string[]> = {
  "Founder name": ["founder name", "founder", "full name", "applicant name", "your name", "name"],
  Email: ["email address", "e-mail", "email"],
  Phone: ["phone number", "contact number", "mobile", "phone"],
  LinkedIn: ["linkedin profile", "linkedin url", "linkedin"],
  Company: ["company name", "startup name", "company", "startup"],
  Sector: ["industry", "category", "sector"],
  Stage: ["funding stage", "round stage", "stage"],
  "Round size": ["amount raising", "round size", "funding ask", "raising", "raise", "ask"],
  "Valuation (post-money)": ["valuation (post-money)", "post-money valuation", "post-money", "post money", "valuation"],
  "Team size": ["number of employees", "team size", "employees", "team"],
  Revenue: ["monthly revenue", "revenue", "mrr", "arr", "traction"],
  "Founder background": ["about the founder", "founder background", "founder bio", "background", "experience"],
  City: ["location", "city", "based in"],
};
const FLAT = Object.entries(ALIASES).flatMap(([canon, al]) => al.map(a => [a, canon] as const)).sort((a, b) => b[0].length - a[0].length);
const canonOf = (label: string) => FLAT.find(([a]) => a === label.trim().toLowerCase().replace(/\s+/g, " "))?.[1];
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const LABEL = new RegExp(`(?<![A-Za-z])(${FLAT.map(([a]) => esc(a)).join("|")})\\s*[:\\u2013\\u2014-]\\s*`, "gi");

/** Reads "Label: value" text, with or without line breaks (PDF text often loses them). Unknown "Label: value" lines are kept as extras. */
export function parseFormText(text: string): Record<string, string> {
  const out: Record<string, string> = {}, hits = [...text.matchAll(LABEL)];
  hits.forEach((m, i) => {
    const canon = canonOf(m[1]); if (!canon || out[canon]) return;
    const end = i + 1 < hits.length ? hits[i + 1].index! : text.length;
    let raw = text.slice(m.index! + m[0].length, end);
    const next = raw.search(/\n\s*[A-Za-z][^:\n]{1,40}:\s/);      // a following line that is itself "Label: value" ends this value
    if (next >= 0) raw = raw.slice(0, next);
    const v = raw.replace(/\s+/g, " ").trim();
    if (v) out[canon] = v;
  });
  let extras = 0;
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Za-z][^:\n]{1,40}):\s*(.+)$/);
    if (m && !canonOf(m[1]) && extras < 30 && !(m[1].trim() in out)) { out[m[1].trim()] = m[2].trim(); extras++; }
  }
  return out;
}
/** A JSON form: keys are mapped to the same names by meaning. */
export function parseFormJson(j: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!j || typeof j !== "object" || Array.isArray(j)) return out;
  for (const [k, v] of Object.entries(j as Record<string, unknown>)) {
    if (typeof v === "object" && v !== null) continue;
    out[canonOf(k) ?? k] = String(v);
  }
  return out;
}

const SECTORS: [RegExp, string][] = [[/fintech|lending|payments|credit/i, "Fintech"], [/deep|hardware|robot|drone|space|semicond/i, "Deeptech"], [/brand|d2c|dtc|fmcg/i, "Consumer brand"], [/consumer/i, "Consumer tech"],
  [/saas|b2b|enterprise|software/i, "B2B SaaS"], [/crypto|web3|blockchain/i, "Crypto"], [/health|medtech|pharma/i, "Healthcare"], [/real estate|proptech/i, "Real estate"]];
export const normalizeSector = (s: string) => SECTORS.find(([re]) => re.test(s))?.[1] ?? "Other";
export function normalizeStage(s: string) {
  const t = s.toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
  if (/^pre ?seed$/.test(t) || t === "preseed") return "Pre-seed";
  if (t === "seed") return "Seed";
  const m = t.match(/^series ([a-z])$/); return m ? `Series ${m[1].toUpperCase()}` : s.trim();
}
const clean = (s: string, max = 500) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Typed fields win over what was read from the file. Returns the form the pipeline uses, or a plain message about what is wrong. */
export function normalizeForm(read: Record<string, string>, typed: Record<string, string> = {}): { ok: true; form: Record<string, string>; sector: string; stage: string; city: string; warnings: string[] } | { ok: false; message: string } {
  const f: Record<string, string> = {};
  for (const [k, v] of Object.entries({ ...read, ...Object.fromEntries(Object.entries(typed).filter(([, v]) => v && v.trim())) }).slice(0, 40)) {
    const key = clean(k, 60), val = clean(String(v), key === "Founder background" ? 2000 : 500);
    if (key && val && key.toLowerCase() !== "synthetic") f[key] = val;
  }
  for (const r of REQUIRED) if (!f[r]) return { ok: false, message: `${r} is missing. Type it in the box below.` };
  if (f.Email && !EMAIL.test(f.Email)) return { ok: false, message: "That email address does not look right." };
  if (f.Stage) f.Stage = normalizeStage(f.Stage);
  const sector = normalizeSector(f.Sector ?? ""); f.Sector = sector;
  const warnings = ["Email", "Stage", "Round size", "Valuation (post-money)"].filter(k => !f[k]).map(k => `${k} is missing, so checks that need it will say so.`);
  return { ok: true, form: f, sector, stage: f.Stage ?? "Unknown", city: f.City ?? "", warnings };
}
