"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function RunAgain() {
  const r = useRouter(), [busy, setBusy] = useState(false);
  return (<div className="flex flex-wrap gap-2">
    <button disabled={busy} className="btn border border-line" onClick={async () => { setBusy(true); await fetch("/api/calibration", { method: "POST" }); r.refresh(); setBusy(false); }}>{busy ? "Running" : "Run again"}</button>
    <a className="btn inline-flex items-center bg-cobalt text-[var(--on-cobalt)]" href="/api/calibration/report" download>Download report</a></div>);
}

export function Logo({ domain, name }: { domain: string; name: string }) {
  const [bad, setBad] = useState(!domain), ref = useRef<HTMLImageElement>(null);
  useEffect(() => { const i = ref.current; if (i && i.complete && i.naturalWidth === 0) setBad(true); }, []);
  const initials = name.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return bad ? <span aria-hidden className="grid h-10 w-10 place-items-center rounded-lg bg-bg text-sm font-semibold text-muted">{initials}</span>
    : /* eslint-disable-next-line @next/next/no-img-element */ <img ref={ref} alt="" width={40} height={40} className="h-10 w-10 rounded-lg" src={`/api/logo/${domain}`} onError={() => setBad(true)} />;
}

export function EditOneLiner({ name, value }: { name: string; value: string }) {
  const r = useRouter(), [open, setOpen] = useState(false), [v, setV] = useState(value), [err, setErr] = useState("");
  if (!open) return <button onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center px-2 text-sm text-cobalt underline" aria-label={`Edit ${name}`}>Edit</button>;
  return (<form className="flex w-full flex-wrap items-center gap-2" onSubmit={async e => { e.preventDefault(); const res = await fetch("/api/portfolio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, one_liner: v }) }); if (res.ok) { setOpen(false); r.refresh(); } else setErr("Could not save."); }}>
    <label className="sr-only" htmlFor={`e-${name}`}>One-line description for {name}</label>
    <input id={`e-${name}`} value={v} onChange={e => setV(e.target.value)} className="min-h-11 flex-1 rounded-lg border border-line bg-card px-3 text-sm" />
    <button className="btn bg-cobalt text-[var(--on-cobalt)]">Save</button><button type="button" className="btn border border-line" onClick={() => setOpen(false)}>Cancel</button>{err && <p role="alert" className="text-sm text-red">{err}</p>}</form>);
}

type Cfg = { weights: Record<string, number>; thresholds: { take: number; dig: number; noBelow: number; leansYes: number }; lensMultiplier: number; fund: { raiseMaxCr: number; postMaxCr: number }; anchors: Record<string, Record<string, string>> };
const NAMES: Record<string, string> = { C1: "Founder-market fit", C2: "Risk ownership", C3: "Customer pull", C4: "Numbers fluency", C5: "Pre-seed fit", C6: "Why now / copy" };
export function SettingsForm({ cfg, version }: { cfg: Cfg; version: number }) {
  const r = useRouter();
  const [w, setW] = useState(Object.fromEntries(Object.entries(cfg.weights).map(([k, v]) => [k, String(Math.round(v * 100))])));
  const [t, setT] = useState(cfg.thresholds), [lens, setLens] = useState(cfg.lensMultiplier), [fund, setFund] = useState(cfg.fund), [anchors, setAnchors] = useState(cfg.anchors);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const sum = Object.values(w).reduce((a, b) => a + (parseFloat(b) || 0), 0);
  async function save() {
    const body = { weights: Object.fromEntries(Object.entries(w).map(([k, v]) => [k, (parseFloat(v) || 0) / 100])), thresholds: t, lensMultiplier: lens, fund, anchors };
    const res = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), j = await res.json();
    setMsg(j.ok ? { ok: true, text: `Saved as version ${j.version}.` } : { ok: false, text: j.error }); if (j.ok) r.refresh();
  }
  const num = "num min-h-11 w-24 rounded-lg border border-line bg-card px-2 text-sm";
  return (<form className="space-y-6" onSubmit={e => { e.preventDefault(); save(); }}>
    <p className="text-sm text-muted">Current version <span className="num">{version}</span>. Saving creates a new version.</p>
    <fieldset className="card p-4"><legend className="px-1 text-base font-semibold">Weights (share of 100%)</legend>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">{Object.keys(NAMES).map(k => <div key={k} className="flex items-center justify-between gap-2"><label htmlFor={`w-${k}`} className="text-sm">{NAMES[k]}</label><span><input id={`w-${k}`} inputMode="decimal" value={w[k]} onChange={e => setW({ ...w, [k]: e.target.value })} className={num} /> %</span></div>)}</div>
      <p className={`mt-2 text-sm ${Math.abs(sum - 100) < 0.5 ? "text-muted" : "text-red"}`} role="status">Total <span className="num">{sum.toFixed(0)}</span>%</p></fieldset>
    <fieldset className="card p-4"><legend className="px-1 text-base font-semibold">Thresholds and lenses</legend>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">{([["take", "Take the call at"], ["leansYes", "Leans yes at"], ["dig", "Dig first from"], ["noBelow", "Clear no below"]] as const).map(([k, n]) => <div key={k} className="flex items-center justify-between gap-2"><label htmlFor={`t-${k}`} className="text-sm">{n}</label><input id={`t-${k}`} inputMode="decimal" value={t[k]} onChange={e => setT({ ...t, [k]: parseFloat(e.target.value) || 0 })} className={num} /></div>)}
        <div className="flex items-center justify-between gap-2"><label htmlFor="lens" className="text-sm">Sector lens multiplier</label><input id="lens" inputMode="decimal" value={lens} onChange={e => setLens(parseFloat(e.target.value) || 0)} className={num} /></div></div></fieldset>
    <fieldset className="card p-4"><legend className="px-1 text-base font-semibold">Fund rules</legend>
      <div className="mt-2 grid gap-3 sm:grid-cols-2"><div className="flex items-center justify-between gap-2"><label htmlFor="rm" className="text-sm">Raise up to (Cr)</label><input id="rm" inputMode="decimal" value={fund.raiseMaxCr} onChange={e => setFund({ ...fund, raiseMaxCr: parseFloat(e.target.value) || 0 })} className={num} /></div>
        <div className="flex items-center justify-between gap-2"><label htmlFor="pm" className="text-sm">Post-money up to (Cr)</label><input id="pm" inputMode="decimal" value={fund.postMaxCr} onChange={e => setFund({ ...fund, postMaxCr: parseFloat(e.target.value) || 0 })} className={num} /></div></div></fieldset>
    <details className="card p-4"><summary className="cursor-pointer text-base font-semibold">Anchors</summary>
      {Object.keys(NAMES).map(k => <div key={k} className="mt-4"><h3 className="text-sm">{NAMES[k]}</h3>{(["0", "3", "5", "7", "10"] as const).map(a => <div key={a} className="mt-1 flex items-center gap-2"><label htmlFor={`a-${k}-${a}`} className="num w-8 text-sm text-subtle">{a}</label><input id={`a-${k}-${a}`} value={anchors[k][a]} onChange={e => setAnchors({ ...anchors, [k]: { ...anchors[k], [a]: e.target.value } })} className="min-h-11 flex-1 rounded-lg border border-line bg-card px-3 text-sm" /></div>)}</div>)}</details>
    <div className="flex flex-wrap items-center gap-3"><button className="btn bg-cobalt text-[var(--on-cobalt)]">Save as a new version</button>{msg && <p role="status" className={`text-sm ${msg.ok ? "text-green" : "text-red"}`}>{msg.text}</p>}</div>
  </form>);
}
