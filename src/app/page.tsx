import { allApps, judgement } from "../lib/data";
import BoardView from "../components/BoardView";
import { Placeholder } from "../components/bits";
import { threads } from "../lib/outreach";
import { jobs } from "../lib/queue";
import AutoRefresh from "../components/AutoRefresh";
import { fmtSlot } from "../lib/ist";
export const dynamic = "force-dynamic";
const W = ["No","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten"];
const word = (n: number, one: string, first = false) => { const w = W[n] ?? String(n); return `${first ? w : w.toLowerCase()} ${one}`; };

export default async function Board() {
  const apps = await allApps();
  const th = threads(), booked = th.filter(t => t.state === "booked" && t.meeting).sort((a, b) => a.meeting!.start.localeCompare(b.meeting!.start)).slice(0, 3);
  const waiting = th.filter(t => t.state === "sent" || t.state === "reoffered").length, needs = th.filter(t => t.state === "needs_riya").length;
  const look = jobs().filter(j => j.status === "needs_look");
  const n = (l: string) => apps.filter(a => a.lane === l).length;
  const headline = `${word(n("yes"), "clear yes", true)}; ${word(n("your_call"), "for your call")}; ${word(n("no"), "clear no")}.`;
  return (<>
    <AutoRefresh active={jobs().some(j => j.status === "queued" || j.status === "running")} />
    <div className="flex flex-wrap items-start justify-between gap-3"><h1 className="text-2xl md:text-3xl">{headline}</h1><a href="/add" className="btn inline-flex items-center bg-cobalt text-[var(--on-cobalt)] hover:bg-[var(--cobalt-hover)]">Add application</a></div>
    <section aria-label="Meetings booked" className="card my-5 flex flex-wrap items-center justify-between gap-2 p-4">
      <div><h2 className="text-base">Meetings booked</h2>{booked.length === 0 ? <p className="text-sm text-muted">No calls booked yet.</p> : <ul className="mt-1 space-y-1 text-sm">{booked.map(t => <li key={t.id}>{t.company} · <span className="num">{fmtSlot(new Date(t.meeting!.start))}</span>{t.meeting!.withAditya ? " · with Aditya" : ""} · <a className="text-cobalt underline" href={t.meeting!.meetLink}>Join Meet</a></li>)}</ul>}</div>
      <p className="text-sm text-subtle"><span className="num">{waiting}</span> waiting for a reply · <span className="num">{needs}</span> need you · <a className="text-cobalt underline" href="/meetings">See all</a></p>
    </section>
    {look.length > 0 && <section aria-label="Needs a look" className="mb-4 rounded-xl bg-[var(--red-tint)] p-4 text-sm text-red"><h2 className="text-base">Needs a look</h2><ul className="mt-1 list-disc pl-5">{look.map(j => <li key={j.id}><a className="underline" href={`/apps/${j.slug}`}>{j.slug}</a>: {j.reason}</li>)}</ul></section>}
    <Placeholder n={apps.filter(a => a.source === "placeholder").length} of={apps.length} />
    <BoardView cards={apps.map(a => ({ slug: a.slug, company: a.company, oneLiner: a.oneLiner, judgement: judgement(a), score: a.total, gates: a.gates.filter(g => g.tripped).map(g => g.gate), lane: a.lane, leans: a.leans, waiting: a.waiting }))} />
  </>);
}
