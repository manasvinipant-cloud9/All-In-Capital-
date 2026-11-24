"use client";
import Link from "next/link";
import { useState } from "react";

type Result = { slug: string; company: string; duplicate: boolean; warnings: string[] };
const SECTORS = ["Fintech", "Deeptech", "Consumer tech", "Consumer brand", "B2B SaaS", "Healthcare", "Crypto", "Real estate", "Other"];
const input = "min-h-11 w-full rounded-lg border border-line bg-card px-3 text-sm";

export default function IntakeForm() {
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [done, setDone] = useState<Result | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(null); setDone(null);
    try {
      const r = await fetch("/api/intake", { method: "POST", body: new FormData(e.currentTarget) }), j = await r.json();
      if (j.ok) setDone(j); else setError(j.message ?? "Could not add this application.");
    } catch { setError("Could not reach the server. Please try again."); } finally { setBusy(false); }
  }
  if (done) return (<div className="card p-5" role="status">
    <h2 className="text-lg">{done.duplicate ? `${done.company} was already added` : `${done.company} is in the queue`}</h2>
    <p className="mt-2 text-sm text-muted">{done.duplicate ? "This deck is already in the app, so nothing new was created." : "It is read on the next run, within 5 minutes. The checks on numbers, stage and portfolio overlap appear first."}</p>
    {done.warnings.length > 0 && <ul className="mt-3 list-disc pl-5 text-sm text-amber">{done.warnings.map(w => <li key={w}>{w}</li>)}</ul>}
    <div className="mt-4 flex flex-wrap gap-2"><Link href={`/apps/${done.slug}`} className="btn inline-flex items-center bg-cobalt text-[var(--on-cobalt)]">Open {done.company}</Link><button onClick={() => setDone(null)} className="btn border border-line">Add another</button></div></div>);
  return (<form onSubmit={submit} className="space-y-5" encType="multipart/form-data">
    <section className="card p-4"><h2 className="text-base">1. The two documents</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <div><label htmlFor="deck" className="text-sm font-medium">Pitch deck (PDF, required)</label><input id="deck" name="deck" type="file" accept="application/pdf,.pdf" required className={`${input} pt-2`} /></div>
        <div><label htmlFor="form" className="text-sm font-medium">Founder form (PDF, text or JSON)</label><input id="form" name="form" type="file" accept=".pdf,.txt,.json,application/pdf,text/plain,application/json" className={`${input} pt-2`} /></div></div>
      <p className="mt-2 text-xs text-subtle">Up to 16 MB each. The form is read by its labels (Company, Founder name, Email, Stage, Round size and so on), not by position.</p></section>
    <section className="card p-4"><h2 className="text-base">2. Type what the form is missing</h2>
      <p className="mt-1 text-sm text-muted">Anything you type here replaces what was read from the form. Company and founder name are required if the form does not have them.</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {([["company", "Company"], ["founderName", "Founder name"], ["email", "Email"], ["stage", "Stage (Pre-seed or Seed)"], ["round", "Round size (for example INR 2 Cr)"], ["valuation", "Post-money valuation (for example INR 12 Cr)"], ["team", "Team size"], ["revenue", "Revenue (for example INR 6 L monthly)"], ["city", "City"]] as const).map(([n, l]) => <div key={n}><label htmlFor={n} className="text-sm">{l}</label><input id={n} name={n} className={input} maxLength={500} autoComplete="off" /></div>)}
        <div><label htmlFor="sector" className="text-sm">Sector</label><select id="sector" name="sector" defaultValue="" className={input}><option value="">Read from the form</option>{SECTORS.map(s => <option key={s}>{s}</option>)}</select></div>
        <div className="md:col-span-2"><label htmlFor="background" className="text-sm">Founder background</label><textarea id="background" name="background" rows={3} maxLength={2000} className={`${input} py-2`} /></div></div></section>
    {error && <p role="alert" className="rounded-lg bg-[var(--red-tint)] p-3 text-sm text-red">{error}</p>}
    <p className="text-xs text-subtle">Decks stay inside the app. Only extracted text goes to the model, with names, emails, phone numbers and LinkedIn links removed. Nothing is sent to the founder.</p>
    <button disabled={busy} className="btn bg-cobalt text-[var(--on-cobalt)] hover:bg-[var(--cobalt-hover)] disabled:opacity-60">{busy ? "Adding..." : "Add application"}</button>
  </form>);
}
