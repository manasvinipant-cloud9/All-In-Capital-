import Link from "next/link";
import { loadDecisions } from "../../lib/decisions";
export const dynamic = "force-dynamic";
export default function Corrections() {
  const rows = loadDecisions().filter(d => d.against).sort((a, b) => b.at.localeCompare(a.at));
  return (<><h1 className="text-2xl">Corrections</h1><p className="mt-1 text-sm text-muted">Decisions that went against the recommendation. Similar ones are shown to the scorer on future applications, with the company name removed.</p>
    <div className="mt-5 space-y-3">{rows.length === 0 && <p className="text-sm text-subtle">Nothing yet. A decision appears here when you say Yes to a Pass or No to a Take the call.</p>}
      {rows.map(d => <div key={d.slug} className="card p-4"><div className="flex flex-wrap items-baseline justify-between gap-2"><Link className="font-semibold text-cobalt underline" href={`/apps/${d.slug}`}>{d.company}</Link><span className="num text-xs text-subtle">{new Date(d.at).toLocaleDateString("en-IN")}</span></div>
        <p className="mt-1 text-sm"><b>You decided:</b> {d.decision === "yes" ? "Yes" : "No"}. <span className="text-muted">The recommendation was {d.rec}.</span></p>
        <p className="mt-1 text-sm"><b>Your note:</b> {d.note || <span className="text-subtle">None</span>}</p>
        <p className="mt-1 text-sm text-muted">{d.reusedIn.length ? `Reused when scoring: ${d.reusedIn.join(", ")}` : "Not reused yet."}</p></div>)}</div></>);
}
