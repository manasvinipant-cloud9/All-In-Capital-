import { ratingWord } from "../lib/rating";
export const GATE_NAME: Record<string, string> = { G1: "Outside the cheque", G2: "Regulatory risk", G3: "Portfolio overlap", G4: "Numbers to confirm" };
export function Rating({ score }: { score: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(score / 2)));
  return (<span className="inline-flex items-center gap-2" title={`${score.toFixed(1)} out of 10 (placeholder)`}>
    <span className="flex gap-0.5" aria-hidden>{[0,1,2,3,4].map(i => <span key={i} className={`h-2 w-4 rounded-sm ${i < filled ? "bg-cobalt" : "bg-line"}`} />)}</span>
    <span className="text-sm font-semibold">{ratingWord(score)}</span></span>);
}
export function GateChip({ code }: { code: string }) {
  return <span className="inline-flex items-center rounded-full bg-[var(--red-tint)] px-2.5 py-1 text-xs font-semibold text-red">{GATE_NAME[code]}</span>;
}
export function Placeholder() {
  return <p className="mb-4 rounded-lg border border-line bg-[var(--amber-tint)] px-3 py-2 text-sm text-amber">Ratings on these screens are placeholders. No model has scored these applications yet. Gates and number checks are real.</p>;
}
