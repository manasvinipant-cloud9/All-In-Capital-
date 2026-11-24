"use client";
import { useState } from "react";

export function DecisionPanel({ slug, company, rec, hasGate }: { slug: string; company: string; rec: string; hasGate: boolean }) {
  const [d, setD] = useState<"yes" | "no" | null>(null), [why, setWhy] = useState(""), [msg, setMsg] = useState("");
  async function save(v: "yes" | "no") { setD(v); setMsg("Saving"); try { const r = await fetch("/api/decision", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, company, rec, decision: v, note: why }) }); const j = await r.json(); setMsg(j.ok ? (j.against ? "Saved. This went against the recommendation, so it will appear under Corrections." : "Saved.") : "Could not save. Try again."); } catch { setMsg("Could not save. Try again."); } }
  return (<section aria-label="Your decision" className="rounded-xl bg-[var(--dark-panel)] p-4 text-[var(--on-dark)]">
    <h2 className="text-base">Your decision</h2>
    <p className="mt-1 text-sm opacity-80">{hasGate ? "A check tripped. You still decide." : "Nothing is sent or rejected until you click."}</p>
    <label htmlFor="why" className="mt-3 block text-sm">Why? (optional)</label>
    <textarea id="why" value={why} onChange={e => setWhy(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-white/20 bg-transparent p-2 text-sm" />
    <div className="mt-3 grid grid-cols-2 gap-2">
      <button className="btn bg-[var(--cobalt)] text-[var(--on-cobalt)] hover:bg-[var(--cobalt-hover)]" aria-pressed={d === "yes"} onClick={() => save("yes")}>Yes, give it time</button>
      <button className="btn border border-white/30" aria-pressed={d === "no"} onClick={() => save("no")}>No</button></div>
    {d && <p role="status" className="mt-3 text-sm">{msg}</p>}
  </section>);
}

export function ThesisToggle({ revealed, written }: { revealed: string; written: string }) {
  const [v, setV] = useState<"revealed" | "written">("revealed");
  return (<div>
    <div role="group" aria-label="Thesis view" className="flex rounded-lg border border-line p-0.5">
      {([["revealed", "How we invest"], ["written", "What we say"]] as const).map(([k, n]) => <button key={k} aria-pressed={v === k} onClick={() => setV(k)} className={`btn !min-h-10 flex-1 text-sm ${v === k ? "bg-cobalt text-[var(--on-cobalt)]" : "text-muted"}`}>{n}</button>)}</div>
    <p className="mt-2 text-sm text-muted">{v === "revealed" ? revealed : written}</p></div>);
}

export function Source({ page, quote, text, label = "Source" }: { page: number; quote?: string; text: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const i = quote ? text.toLowerCase().indexOf(quote.toLowerCase().slice(0, 40)) : -1;
  return (<>
    <button onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center px-1 text-sm text-cobalt underline">{label}</button>
    {open && <div role="dialog" aria-modal="true" aria-label={`Deck page ${page}`} className="fixed inset-y-0 right-0 z-30 w-full max-w-md overflow-auto bg-card p-5" style={{ boxShadow: "var(--shadow)" }}>
      <div className="flex items-center justify-between"><h2 className="text-base">Deck page {page}</h2><button autoFocus className="btn border border-line" onClick={() => setOpen(false)}>Close</button></div>
      <p className="mt-4 text-sm leading-relaxed">{i >= 0 ? <>{text.slice(0, i)}<mark className="bg-[var(--amber-tint)] text-ink">{text.slice(i, i + (quote?.length ?? 0))}</mark>{text.slice(i + (quote?.length ?? 0))}</> : text}</p></div>}
  </>);
}
