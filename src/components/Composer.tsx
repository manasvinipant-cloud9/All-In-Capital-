"use client";
import { useEffect, useMemo, useState } from "react";
import { lint } from "../lib/email/lint";
import { fmtSlot } from "../lib/ist";

type P = { slug: string; company: string; founderName: string; to: string; subject: string; body: string; offered: string[]; deeptech: boolean; sent: boolean; sector: string; modelReady: boolean };
const CHIPS: [string, string][] = [["Shorter", "Make it shorter."], ["Warmer", "Make it warmer without any praise."], ["More direct", "Make it more direct."], ["Different opening", "Use a different opening."], ["Sharper question", "Ask a sharper question about the number."]];

export default function Composer(p: P) {
  const key = `draft:${p.slug}`;
  const [subject, setSubject] = useState(p.subject), [body, setBody] = useState(p.body), [to, setTo] = useState(p.to);
  const [offered, setOffered] = useState(p.offered), [original, setOriginal] = useState(p.body), [note, setNote] = useState(""), [redoing, setRedoing] = useState(false), [redoMsg, setRedoMsg] = useState("");
  const [saved, setSaved] = useState(""), [review, setReview] = useState(false), [msg, setMsg] = useState<string | null>(null), [busy, setBusy] = useState(false);
  useEffect(() => { try { const s = JSON.parse(localStorage.getItem(key) ?? "null"); if (s) { setSubject(s.subject); setBody(s.body); setTo(s.to); setSaved("Restored your edits"); } } catch {} }, [key]);
  useEffect(() => { const t = setTimeout(() => { try { localStorage.setItem(key, JSON.stringify({ subject, body, to })); setSaved("Saved"); } catch {} }, 600); return () => clearTimeout(t); }, [subject, body, to, key]);
  const issues = useMemo(() => lint({ template: "invite", subject, body, deeptech: p.deeptech }), [subject, body, p.deeptech]);
  const times = offered.map(s => fmtSlot(new Date(s))).filter(t => body.includes(t));
  async function redo(n: string) {
    setRedoing(true); setRedoMsg("");
    try {
      const r = await fetch("/api/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: p.slug, note: n }) }), j = await r.json();
      if (!r.ok) { setRedoMsg(j.message ?? "Could not redo this one."); return; }
      setSubject(j.subject); setBody(j.body); setOffered(j.offered); setOriginal(j.body);
      setRedoMsg(j.passed ? "Redone. All checks pass." : "Redone, but some checks still fail. Fix them by hand.");
    } catch { setRedoMsg("Could not reach the server. Try again."); } finally { setRedoing(false); }
  }
  async function send() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: p.slug, company: p.company, founderName: p.founderName, to, confirmRecipient: to, subject, body, offered, deeptech: p.deeptech, sector: p.sector, original }) });
      const j = await r.json(); setMsg(j.message ?? (j.ok ? "Sent." : j.error ?? "Could not send."));
    } catch { setMsg("Could not reach the server. Try again."); } finally { setBusy(false); }
  }
  if (p.sent) return <p className="text-sm text-muted">The letter has been sent. See the Outreach box.</p>;
  return (<div>
    <label htmlFor="to" className="text-sm text-muted">To {!to && <span className="text-amber">(the form has no email address: type it)</span>}</label>
    <input id="to" value={to} onChange={e => setTo(e.target.value)} className="num mb-2 mt-1 min-h-11 w-full rounded-lg border border-line bg-card px-3 text-sm" />
    <label htmlFor="subj" className="text-sm text-muted">Subject</label>
    <input id="subj" value={subject} onChange={e => setSubject(e.target.value)} className="mb-2 mt-1 min-h-11 w-full rounded-lg border border-line bg-card px-3 text-sm" />
    <label htmlFor="body" className="text-sm text-muted">Letter</label>
    <textarea id="body" value={body} onChange={e => setBody(e.target.value)} rows={9} className="mt-1 w-full rounded-lg border border-line bg-card p-3 text-sm leading-relaxed" />
    <p className="mt-1 text-xs text-subtle" role="status">{saved}</p>
    <div className="mt-2 flex flex-wrap gap-2" aria-label="Redo options">{CHIPS.map(([c, n]) => <button key={c} disabled={!p.modelReady || redoing} onClick={() => redo(n)} title={p.modelReady ? n : "Redo needs a model key, which is not set up yet"} className="btn !min-h-11 border border-line text-sm disabled:cursor-not-allowed disabled:opacity-70 disabled:text-subtle">{c}</button>)}</div>
    <div className="mt-2 flex gap-2"><label htmlFor="note" className="sr-only">Redo with a note</label>
      <input id="note" value={note} onChange={e => setNote(e.target.value)} maxLength={200} placeholder="Redo with a note" disabled={!p.modelReady || redoing} className="min-h-11 flex-1 rounded-lg border border-line bg-card px-3 text-sm disabled:opacity-70" />
      <button disabled={!p.modelReady || redoing || !note.trim()} onClick={() => redo(note)} className="btn border border-line text-sm disabled:opacity-70">Redo</button></div>
    <p className="mt-1 text-xs text-subtle" role="status">{redoing ? "Redoing..." : redoMsg || (p.modelReady ? "Redo uses your real past emails as examples." : "Redo needs a model key. Edit by hand for now.")}</p>
    <section aria-label="Live checks" className="mt-3 rounded-lg bg-bg p-3 text-sm">
      <h3 className="text-sm">Live checks</h3>
      {issues.length === 0 ? <p className="mt-1 text-green">All checks pass.</p> : <ul className="mt-1 list-disc space-y-1 pl-5 text-red">{issues.map((i, k) => <li key={k}>{i.msg}</li>)}</ul>}
    </section>
    <button disabled={issues.length > 0 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)} onClick={() => setReview(true)} className="btn mt-3 w-full bg-cobalt text-[var(--on-cobalt)] hover:bg-[var(--cobalt-hover)] disabled:opacity-50">Review and send</button>
    {review && <div role="dialog" aria-modal="true" aria-label="Confirm send" className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4">
      <div className="card max-w-md p-5" style={{ boxShadow: "var(--shadow)" }}>
        <h2 className="text-lg">Send to {to}?</h2>
        <p className="mt-2 text-sm">{times.length ? `The letter offers ${times.join(" or ")}.` : "The letter uses the times as you wrote them."}</p>
        <p className="mt-2 text-sm text-muted">Checked against your calendar again as it sends. Whichever they pick, or any other time they suggest that you&apos;re free for, the app books with a Meet link.</p>
        {msg && <p role="status" className="mt-3 rounded-lg bg-[var(--amber-tint)] p-2 text-sm text-amber">{msg}</p>}
        <div className="mt-4 flex gap-2"><button autoFocus onClick={() => { setReview(false); setMsg(null); }} className="btn flex-1 border border-line">Cancel</button>
          <button disabled={busy} onClick={send} className="btn flex-1 bg-cobalt text-[var(--on-cobalt)]">{busy ? "Sending" : `Send to ${to}`}</button></div>
      </div></div>}
  </div>);
}
