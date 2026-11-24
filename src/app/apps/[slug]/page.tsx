import { notFound } from "next/navigation";
import Link from "next/link";
import { allApps, CRITERIA } from "../../../lib/data";
import { ratingWord } from "../../../lib/rating";
import { Rating, GateChip, GATE_NAME, Placeholder } from "../../../components/bits";
import Composer from "../../../components/Composer";
import { candidateSlots, fillSlots } from "../../../lib/email/slots";
import { offlineInvite, isDeeptech } from "../../../lib/email/offline";
import { statusOf, threadFor } from "../../../lib/outreach";
import { fmtSlot } from "../../../lib/ist";
import { modelNames, realTransport } from "../../../lib/gateway/transport";
import { DecisionPanel, ThesisToggle, Source } from "../../../components/Client";
export const dynamic = "force-dynamic";
const ASK: Record<string, string> = { C1: "What did you learn in the field that others do not know?", C2: "Who carries the loss if this goes wrong?", C3: "How many customers came back, and when?", C4: "Can you show repeat and CAC by channel?", C5: "What does the next round need to look like?", C6: "What stops a well-funded copier?" };
const SENT: Record<string, string> = { C1: "Time in the field and earned insight.", C2: "Who owns credit, regulatory and capital risk.", C3: "Repeat and conversion, not raw size.", C4: "Cohorts, CAC by channel, figures that reconcile.", C5: "Capital intensity and path to the next round.", C6: "What changed, and the answer to a copier." };

export default async function App({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = (await allApps()).find(x => x.slug === slug);
  if (!a) notFound();
  const tripped = a.gates.filter(g => g.tripped);
  const band = a.lane === "yes" ? ["Yes: give it 30 minutes.", "bg-[var(--green-tint)] text-green"] : a.lane === "no" ? ["No: don't spend time on it.", "bg-bg text-muted border border-line"] : ["Your call.", "bg-[var(--amber-tint)] text-amber"];
  const th = threadFor(a.slug), st = statusOf(th);
  const offered = candidateSlots({ now: new Date() });
  const inv = offlineInvite(a.form, a.stage, a.sector, isDeeptech(a.sector));
  const reds = a.checks.filter(c => c.severity === "red");
  const low = Object.entries(a.scores).sort((x, y) => x[1] - y[1]).slice(0, 2).map(([k]) => CRITERIA[k]);
  return (<>
    <Link href="/" className="inline-flex min-h-11 items-center text-sm text-cobalt">Back to board</Link>
    <h1 className="mt-1 text-2xl md:text-3xl">{a.company}</h1>
    <p className="text-sm text-muted">{a.sector} · {a.stage} · {a.city} · {a.form["Round size"]}</p>
    <div className="mt-4">{a.source === "placeholder" ? <Placeholder /> : <p className="mb-4 text-sm text-muted">Scored by the model on {new Date(a.scoredAt!).toLocaleDateString("en-IN")}. Gaps are named under More detail.</p>}</div>
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-5">
        <section className={`rounded-xl p-5 ${band[1]}`}><p className="text-sm font-semibold uppercase tracking-wide">Give it time?</p><p className="font-[family-name:var(--font-head)] text-2xl font-semibold">{band[0]}</p>
          <p className="mt-1 text-sm">{tripped.length ? `${tripped.map(g => GATE_NAME[g.gate]).join(", ")}: ${tripped[0].reason}` : "No check tripped."}</p>
          {a.lane === "your_call" && <ul className="mt-3 space-y-1 text-sm"><li><b>The AI leans {a.leans}:</b> {a.leans === "yes" ? "evidence is close to the line." : "too many gaps for the stage."}</li>
            <li><b>It&apos;s a yes if</b> the {low.join(" and ")} questions below get clear numbers.</li><li><b>It&apos;s a no if</b> {reds.length ? "the flagged numbers cannot be explained." : "the answers stay vague."}</li></ul>}</section>
        <section className="grid gap-3 md:grid-cols-3">
          <div className="card p-4"><h2 className="text-base">For it</h2><p className="mt-1 text-sm">Scores best on {CRITERIA[a.best]}.</p></div>
          <div className="card p-4"><h2 className="text-base">Against it</h2><p className="mt-1 text-sm">{reds.length ? `${reds[0].name}: ${reds[0].formula}` : `Weakest on ${CRITERIA[a.worst]}.`}</p></div>
          <div className="card p-4"><h2 className="text-base">Reminds us of</h2><p className="mt-1 text-sm">{a.reminds ? `${a.reminds.company} (${a.reminds.outcome}). ${a.reminds.why}` : "No close precedent."}</p></div></section>
        {tripped.length > 0 && <section className="card p-4"><h2 className="text-base">Checks</h2><ul className="mt-2 space-y-2 text-sm">{tripped.map(g => <li key={g.gate} className="flex flex-wrap items-center gap-2"><GateChip code={g.gate} /><span>{g.reason}</span>
          {g.cite?.[0]?.page && <Source page={g.cite[0].page} quote={g.cite[0].quote} text={a.deck[g.cite[0].page - 1].text} />}</li>)}</ul></section>}
        <section className="card p-4" aria-labelledby="em"><h2 id="em" className="text-base">Email and meeting</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-2"><Composer slug={a.slug} company={a.company} founderName={a.form["Founder name"]} to={a.form["Email"]} subject={inv.subject} body={fillSlots(inv.body, offered)} offered={offered.map(o => o.toISOString())} deeptech={isDeeptech(a.sector)} sent={!!th} sector={a.sector} modelReady={!!realTransport() && !!modelNames()} />
            <aside aria-label="Outreach" className={`h-fit rounded-lg p-3 ${st.kind === "booked" ? "bg-[var(--green-tint)] text-green" : st.kind === "needs_you" ? "bg-[var(--amber-tint)] text-amber" : "bg-bg"}`}><p className="font-semibold">{st.kind === "none" ? "Not sent yet" : st.text}</p>
              {st.kind === "none" ? <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted"><li>Your letter offers two free times from your calendar.</li><li>The founder picks one or suggests their own.</li><li>If you are free, the call is booked with a Meet link.</li></ol> : st.meeting ? <a className="mt-2 inline-flex min-h-11 items-center underline" href={st.meeting.meetLink}>Join Meet</a> : st.kind === "needs_you" ? <p className="mt-1 text-sm">The reply was not a clear time. Read it in Gmail and answer there.</p> : null}
              <p className="mt-2 text-xs text-subtle">The draft times above were the next free slots when this page loaded ({offered.map(fmtSlot).join(", ")}). Sending checks them again.</p></aside></div>
          </section>
        <details className="card p-4"><summary className="cursor-pointer text-base font-semibold">More detail</summary>
          <table className="mt-3 w-full text-left text-sm"><caption className="sr-only">Areas</caption><thead><tr className="text-subtle"><th scope="col" className="py-1">Area</th><th scope="col">Rating</th><th scope="col" className="hidden md:table-cell">Why</th><th scope="col">Ask</th></tr></thead>
            <tbody>{Object.entries(CRITERIA).map(([k, n]) => <tr key={k} className="border-t border-line align-top"><th scope="row" className="py-2 pr-2 font-medium capitalize">{n}</th><td className="pr-2"><Rating score={a.scores[k]} /></td><td className="hidden pr-2 text-muted md:table-cell">{a.rationale[k] ?? SENT[k]}{a.gaps[k] ? <span className="block text-amber">Gap: {a.gaps[k]}</span> : null}</td><td className="text-muted">{ASK[k]}</td></tr>)}</tbody></table>
          <h3 className="mt-4 text-base">Numbers that don&apos;t add up</h3>
          {a.checks.length === 0 ? <p className="text-sm text-muted">Nothing found.</p> : <ul className="mt-1 space-y-1 text-sm">{a.checks.map((c, i) => <li key={i}><b>{c.name}.</b> <span className="num text-muted">{c.formula}</span> {c.page && <Source page={c.page} quote={c.quote} text={a.deck[c.page - 1].text} />}</li>)}</ul>}
        </details>
      </div>
      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <div className="card p-4"><div className="flex items-center justify-between"><Rating score={a.total} /><span className="rounded-full bg-bg px-2 py-0.5 text-xs font-semibold">{a.lane === "your_call" ? "Your call" : a.lane === "yes" ? "Yes" : "No"}</span></div>
          <p className="mt-2 text-sm text-muted">{tripped.length ? `${tripped.length} check${tripped.length > 1 ? "s" : ""} tripped.` : "No checks tripped."} Word: {ratingWord(a.total)}.</p>
          <div className="mt-3"><ThesisToggle revealed={`How we invest: ${ratingWord(a.total)}. Founder owns the hardest risk, groundwork before product, evidence over pedigree.`} written={`What we say: ${ratingWord(a.totalWritten)}. Fintech, deeptech, consumer tech and consumer brands, pre-seed and seed in India.`} /></div></div>
        <DecisionPanel slug={a.slug} company={a.company} rec={a.rec} hasGate={tripped.length > 0} />
      </aside></div></>);
}
