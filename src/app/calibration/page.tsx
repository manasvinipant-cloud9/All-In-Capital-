import { runCalibration } from "../../lib/calibration";
import { RunAgain } from "../../components/Phase5";
export const dynamic = "force-dynamic";
export default function Calibration() {
  const r = runCalibration(), m = r.matrix;
  return (<><h1 className="text-2xl">Calibration</h1>
    <p className="mt-1 text-sm text-muted">The 12 past memos, scored blind: only what it does, the founder assessment and the risks, with names removed.</p>
    <p className="mt-3 rounded-lg border border-line bg-[var(--amber-tint)] px-3 py-2 text-sm text-amber">This is in-sample: the memos helped shape the rubric, so agreement is optimistic.{r.offline && " Scored by an offline rule-based stand-in, not a model. No model key is set up yet."}</p>
    <div className="my-5 flex flex-wrap items-center justify-between gap-3"><p className="text-xl"><span className="num font-semibold">{r.agreed} of {r.n}</span> agree with what the fund did</p><RunAgain /></div>
    <div className="grid gap-4 md:grid-cols-2">
      <section className="card p-4"><h2 className="text-base">Who we would back</h2>
        <table className="mt-2 w-full text-sm"><caption className="sr-only">Agreement grid</caption><thead><tr className="text-left text-subtle"><th scope="col"></th><th scope="col">We would invest</th><th scope="col">We would pass</th></tr></thead>
          <tbody><tr className="border-t border-line"><th scope="row" className="py-2 text-left font-medium">Fund invested</th><td className="num">{m.investedYes}</td><td className="num">{m.investedNo}</td></tr><tr className="border-t border-line"><th scope="row" className="py-2 text-left font-medium">Fund passed</th><td className="num">{m.passedYes}</td><td className="num">{m.passedNo}</td></tr></tbody></table></section>
      <section className="card p-4"><h2 className="text-base">Ranking agreement</h2><p className="mt-2 text-sm">The company the fund backed outscored the one it passed in <span className="num font-semibold">{r.ranking.wins} of {r.ranking.pairs}</span> pairs.</p></section></div>
    <section className="card mt-4 overflow-x-auto p-4"><h2 className="text-base">Memos</h2>
      <table className="mt-2 w-full min-w-[420px] text-left text-sm"><thead><tr className="text-subtle"><th scope="col">Company</th><th scope="col">Fund did</th><th scope="col">We would</th><th scope="col">Rating</th></tr></thead>
        <tbody>{r.rows.map(x => <tr key={x.company} className="border-t border-line"><th scope="row" className="py-2 font-medium">{x.company}</th><td>{x.fund === "invested" ? "Invested" : "Passed"}</td><td className={x.agrees ? "" : "font-semibold text-red"}>{x.predicted === "invest" ? "Invest" : "Pass"}{x.agrees ? "" : " (differs)"}</td><td title={`${x.score.toFixed(1)} out of 10`}>{x.word}</td></tr>)}</tbody></table></section>
    <section className="mt-4" aria-labelledby="d"><h2 id="d" className="mb-2 text-lg">Where we disagree</h2>
      <div className="grid gap-3 md:grid-cols-2">{r.rows.filter(x => !x.agrees).map(x => <div key={x.company} className="card p-4"><h3 className="text-base">{x.company} <span className="text-sm font-normal text-muted">(fund {x.fund})</span></h3>
        <p className="mt-2 text-sm"><b>Case for yes:</b> {x.yes}</p><p className="mt-1 text-sm"><b>Case for no:</b> {x.no}</p><p className="mt-1 text-xs text-subtle">Sources: {x.sources?.join("; ")}</p></div>)}{r.rows.every(x => x.agrees) && <p className="text-sm text-subtle">No disagreements.</p>}</div></section></>);
}
