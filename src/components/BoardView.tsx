"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Rating, GateChip } from "./bits";
export type Card = { slug: string; company: string; oneLiner: string; judgement: string; score: number; gates: string[]; lane: "yes" | "your_call" | "no" | "unscored"; leans?: "yes" | "no"; waiting?: string };
const COLS = [["yes", "Yes", "Give it 30 minutes"], ["your_call", "Your call", "Gray area"], ["no", "No", "Don't spend time"]] as const;

export default function BoardView({ cards }: { cards: Card[] }) {
  const [view, setView] = useState<"grid" | "list">("grid"), [q, setQ] = useState(""), search = useRef<HTMLInputElement>(null), root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "/") { e.preventDefault(); search.current?.focus(); }
      if (e.key === "j" || e.key === "k") { const l = [...(root.current?.querySelectorAll<HTMLAnchorElement>("a[data-card]") ?? [])]; const i = l.indexOf(document.activeElement as HTMLAnchorElement); l[Math.max(0, Math.min(l.length - 1, i + (e.key === "j" ? 1 : -1)))]?.focus(); }
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);
  const shown = cards.filter(c => (c.company + c.oneLiner).toLowerCase().includes(q.toLowerCase()));
  const Item = ({ c }: { c: Card }) => (
    <Link data-card href={`/apps/${c.slug}`} className="card block p-4 hover:border-cobalt">
      <div className="flex items-start justify-between gap-2"><h3 className="text-base">{c.company}</h3>
        {c.leans && <span className="rounded-full bg-bg px-2 py-0.5 text-xs font-semibold text-muted">Leans {c.leans}</span>}</div>
      <p className="mt-1 text-sm text-muted">{c.oneLiner}</p>
      {c.lane !== "unscored" && <p className="mt-3 text-sm">{c.judgement}</p>}
      {c.lane === "unscored" ? <p className="mt-3 text-sm text-muted">{c.waiting}</p> : <div className="mt-3"><Rating score={c.score} /></div>}
      {c.gates.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{c.gates.map(g => <GateChip key={g} code={g} />)}</div>}
    </Link>);
  return (<div ref={root}>
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <label className="sr-only" htmlFor="q">Search applications</label>
      <input id="q" ref={search} value={q} onChange={e => setQ(e.target.value)} placeholder="Search" className="min-h-11 flex-1 rounded-lg border border-line bg-card px-3 text-sm md:max-w-xs" />
      <div role="group" aria-label="View" className="flex rounded-lg border border-line bg-card p-0.5">
        {(["grid", "list"] as const).map(v => <button key={v} aria-pressed={view === v} onClick={() => setView(v)} className={`btn !min-h-10 text-sm ${view === v ? "bg-cobalt text-[var(--on-cobalt)]" : "text-muted"}`}>{v === "grid" ? "Columns" : "List"}</button>)}
      </div></div>
    {view === "grid" ? (
      <><div className="grid gap-4 md:grid-cols-3">{COLS.map(([k, name, sub]) => { const items = shown.filter(c => c.lane === k); return (
        <section key={k} aria-labelledby={`h-${k}`}><div className="mb-2 flex items-baseline gap-2"><h2 id={`h-${k}`} className="text-lg">{name}</h2><span className="num text-sm text-subtle">{items.length}</span><span className="text-sm text-subtle">{sub}</span></div>
          <div className="flex flex-col gap-3">{items.map(c => <Item key={c.slug} c={c} />)}{items.length === 0 && <p className="text-sm text-subtle">Nothing here.</p>}</div></section>); })}</div>
      {shown.some(c => c.lane === "unscored") && <section aria-labelledby="h-unscored" className="mt-6"><div className="mb-2 flex items-baseline gap-2"><h2 id="h-unscored" className="text-lg">Waiting to be scored</h2><span className="num text-sm text-subtle">{shown.filter(c => c.lane === "unscored").length}</span><span className="text-sm text-subtle">Checks are real. No rating yet.</span></div>
        <div className="grid gap-3 md:grid-cols-3">{shown.filter(c => c.lane === "unscored").map(c => <Item key={c.slug} c={c} />)}</div></section>}</>
    ) : (
      <ul className="card divide-y divide-line">{shown.map(c => <li key={c.slug}><Link data-card href={`/apps/${c.slug}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3 hover:bg-bg">
        <span className="w-44 font-semibold">{c.company}</span><span className="w-24 text-sm text-muted">{c.lane === "your_call" ? "Your call" : c.lane === "yes" ? "Yes" : c.lane === "no" ? "No" : "Not scored"}</span>{c.lane === "unscored" ? <span className="text-sm text-muted">{c.waiting}</span> : <Rating score={c.score} />}<span className="flex gap-1.5">{c.gates.map(g => <GateChip key={g} code={g} />)}</span></Link></li>)}</ul>
    )}
  </div>);
}
