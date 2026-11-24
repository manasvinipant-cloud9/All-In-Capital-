import { existsSync, readFileSync } from "node:fs";
import { getPortfolio } from "../../lib/seedData";
import { Logo, EditOneLiner } from "../../components/Phase5";
export const dynamic = "force-dynamic";
type P = { name: string; one_liner: string; sector: string; status: string; tags: string[]; domain: string; source_url: string; source_note: string };
const nice = (t: string) => t.replace(/[_-]+/g, " ").replace(/^./, c => c.toUpperCase());
const STATUS: Record<string, string> = { active: "Active", exited: "Exited", shut_down: "Shut down" };
export default function Portfolio() {
  const edits = existsSync(".local/portfolio-edits.json") ? JSON.parse(readFileSync(".local/portfolio-edits.json", "utf8")) : {};
  const rows = (getPortfolio() as P[]).map(p => ({ ...p, ...(edits[p.name] ?? {}) }));
  const exited = rows.filter(r => r.status === "exited").length, shut = rows.filter(r => r.status === "shut_down").length, needs = rows.filter(r => r.one_liner.trim().length < 15).length;
  return (<><h1 className="text-2xl">Portfolio</h1>
    <p className="mt-1 text-sm text-muted">{rows.length} companies · {exited} exited · {shut} shut down · {needs} need a description</p>
    <ul className="card mt-4 divide-y divide-line">{rows.map(r => <li key={r.name} className="flex flex-wrap items-center gap-3 p-3"><Logo domain={r.domain} name={r.name} />
      <div className="min-w-0 flex-1 basis-56"><p className="font-semibold">{r.name} <span className="ml-1 text-xs font-normal text-subtle">{STATUS[r.status]}</span></p><p className="text-sm text-muted">{r.one_liner}</p>
        <p className="mt-1 text-xs text-subtle">{r.sector} · {r.tags.map(nice).join(", ")}</p></div>
      <a href={r.source_url} title={r.source_note} className="inline-flex min-h-11 items-center px-2 text-sm text-cobalt underline">Source</a><EditOneLiner name={r.name} value={r.one_liner} /></li>)}</ul></>);
}
