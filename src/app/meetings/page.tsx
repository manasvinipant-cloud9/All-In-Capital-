import Link from "next/link";
import { threads, statusOf } from "../../lib/outreach";
import { fmtSlot } from "../../lib/ist";
import { loadFollowups } from "../../lib/followups";
import FollowupCard from "../../components/FollowupCard";
export const dynamic = "force-dynamic";
const Empty = ({ t }: { t: string }) => <p className="text-sm text-subtle">{t}</p>;

export default function Meetings() {
  const all = threads(), booked = all.filter(t => t.state === "booked" && t.meeting).sort((a, b) => a.meeting!.start.localeCompare(b.meeting!.start));
  const needs = all.filter(t => t.state === "needs_riya"), waiting = all.filter(t => t.state === "sent" || t.state === "reoffered");
  const fus = loadFollowups().filter(f => f.status === "ready");
  const co = (t: typeof all[number]) => <Link className="font-semibold text-cobalt underline" href={`/apps/${t.slug}`}>{t.company}</Link>;
  return (<><h1 className="text-2xl">Meetings</h1><p className="mt-1 text-sm text-muted">Everything after a letter is sent.</p>
    <div className="mt-5 space-y-6">
      <section aria-labelledby="b"><h2 id="b" className="mb-2 text-lg">Booked</h2><div className="space-y-2">{booked.length === 0 && <Empty t="No calls booked yet." />}
        {booked.map(t => <div key={t.id} className="card flex flex-wrap items-center gap-x-4 gap-y-1 p-4">{co(t)}<span className="num text-sm">{fmtSlot(new Date(t.meeting!.start))}</span><span className="text-sm text-muted">30 minutes{t.meeting!.withAditya ? " · with Aditya" : ""}</span>
          <a className="btn inline-flex items-center bg-cobalt text-[var(--on-cobalt)]" href={t.meeting!.meetLink}>Join Meet</a><a className="btn inline-flex items-center border border-line" href={t.meeting!.calendarLink}>Open in Calendar</a></div>)}</div></section>
      <section aria-labelledby="n"><h2 id="n" className="mb-2 text-lg">Replies that need you</h2><div className="space-y-2">{needs.length === 0 && <Empty t="Nothing needs you right now." />}
        {needs.map(t => <div key={t.id} className="card p-4">{co(t)}<p className="mt-1 text-sm text-muted">The founder replied without a clear time. Read it in Gmail and answer there.</p></div>)}</div></section>
      <section aria-labelledby="f"><h2 id="f" className="mb-2 text-lg">Follow-ups ready</h2><p className="mb-2 text-sm text-muted">No reply after 3 working days. Prepared for you. Nothing is sent until you click.</p><div className="space-y-2">{fus.length === 0 && <Empty t="No follow-ups waiting." />}
        {fus.map(f => <div key={f.id} className="card p-4"><Link className="font-semibold text-cobalt underline" href={`/apps/${f.slug}`}>{f.company}</Link><div className="mt-2"><FollowupCard id={f.id} company={f.company} to={f.to} subject={f.subject} body={f.body} offered={f.offered} /></div></div>)}</div></section>
      <section aria-labelledby="w"><h2 id="w" className="mb-2 text-lg">Waiting for the founder</h2><div className="space-y-2">{waiting.length === 0 && <Empty t="No letters waiting for a reply." />}
        {waiting.map(t => <div key={t.id} className="card p-4">{co(t)}<p className="mt-1 text-sm text-muted">{t.state === "reoffered" ? "Their time clashed, so two new times were offered: " : `Letter sent ${Math.max(0, Math.round((Date.now() - new Date(t.sentAt).getTime()) / 86400000))} days ago. Offered `}{t.offered.map(s => fmtSlot(new Date(s))).join(" or ")}</p></div>)}</div></section>
    </div></>);
}
void statusOf;
