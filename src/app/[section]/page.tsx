import { notFound } from "next/navigation";
const S: Record<string, [string, string]> = { calibration: ["Calibration", "Phase 5"], corrections: ["Corrections", "Phase 5"], portfolio: ["Portfolio", "Phase 5"], settings: ["Settings", "Phase 5"] };
export function generateStaticParams() { return Object.keys(S).map(section => ({ section })); }
export default async function Stub({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params; const s = S[section]; if (!s) notFound();
  return <><h1 className="text-2xl">{s[0]}</h1><p className="mt-2 text-muted">This screen arrives in {s[1]}.</p></>;
}
