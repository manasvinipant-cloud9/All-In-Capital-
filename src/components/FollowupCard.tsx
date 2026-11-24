"use client";
import { useState } from "react";
import { fmtSlot } from "../lib/ist";

export default function FollowupCard(p: { id: string; company: string; to: string; subject: string; body: string; offered: string[] }) {
  const [body, setBody] = useState(p.body), [review, setReview] = useState(false), [msg, setMsg] = useState<string | null>(null), [busy, setBusy] = useState(false), [done, setDone] = useState(false);
  async function send() {
    setBusy(true); setMsg(null);
    try { const r = await fetch("/api/followup/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id, body, confirmRecipient: p.to }) }), j = await r.json(); if (j.ok) setDone(true); else setMsg(j.message ?? "Could not send."); }
    catch { setMsg("Could not reach the server. Try again."); } finally { setBusy(false); }
  }
  if (done) return <p className="text-sm text-green" role="status">Follow-up sent.</p>;
  return (<div>
    <label htmlFor={`f-${p.id}`} className="text-sm text-muted">Follow-up to {p.to}</label>
    <textarea id={`f-${p.id}`} value={body} onChange={e => setBody(e.target.value)} rows={5} className="mt-1 w-full rounded-lg border border-line bg-card p-3 text-sm" />
    <button onClick={() => setReview(true)} className="btn mt-2 bg-cobalt text-[var(--on-cobalt)]">Review and send</button>
    {review && <div role="dialog" aria-modal="true" aria-label="Confirm send" className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4"><div className="card max-w-md p-5" style={{ boxShadow: "var(--shadow)" }}>
      <h2 className="text-lg">Send to {p.to}?</h2><p className="mt-2 text-sm">Offers {p.offered.map(s => fmtSlot(new Date(s))).filter(t => body.includes(t)).join(" or ") || "the times as you wrote them"}. Checked against your calendar again as it sends.</p>
      {msg && <p role="status" className="mt-3 rounded-lg bg-[var(--amber-tint)] p-2 text-sm text-amber">{msg}</p>}
      <div className="mt-4 flex gap-2"><button autoFocus onClick={() => { setReview(false); setMsg(null); }} className="btn flex-1 border border-line">Cancel</button><button disabled={busy} onClick={send} className="btn flex-1 bg-cobalt text-[var(--on-cobalt)]">{busy ? "Sending" : "Send"}</button></div></div></div>}
  </div>);
}
