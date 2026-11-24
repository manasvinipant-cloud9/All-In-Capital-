import { allApps, judgement } from "../lib/data";
import BoardView from "../components/BoardView";
import { Placeholder } from "../components/bits";
export const dynamic = "force-dynamic";
const W = ["No","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten"];
const word = (n: number, one: string, first = false) => { const w = W[n] ?? String(n); return `${first ? w : w.toLowerCase()} ${one}`; };

export default async function Board() {
  const apps = await allApps();
  const n = (l: string) => apps.filter(a => a.lane === l).length;
  const headline = `${word(n("yes"), "clear yes", true)}; ${word(n("your_call"), "for your call")}; ${word(n("no"), "clear no")}.`;
  return (<>
    <h1 className="text-2xl md:text-3xl">{headline}</h1>
    <section aria-label="Meetings booked" className="card my-5 flex flex-wrap items-center justify-between gap-2 p-4">
      <div><h2 className="text-base">Meetings booked</h2><p className="text-sm text-muted">No calls booked yet.</p></div>
      <p className="text-sm text-subtle"><span className="num">0</span> waiting for a reply · <span className="num">0</span> need you · <a className="text-cobalt underline" href="/meetings">See all</a></p>
    </section>
    <Placeholder />
    <BoardView cards={apps.map(a => ({ slug: a.slug, company: a.company, oneLiner: a.oneLiner, judgement: judgement(a), score: a.total, gates: a.gates.filter(g => g.tripped).map(g => g.gate), lane: a.lane, leans: a.leans }))} />
  </>);
}
