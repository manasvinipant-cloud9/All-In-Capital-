// Prints every flag and gate the checks raise on the applications in seed/.
import { loadFiles, listMeta } from "../src/lib/apps.ts";
import { reconcile } from "../src/lib/pipeline/reconcile.ts";
import { describe, g1, g2Offline, g3, g4 } from "../src/lib/pipeline/gates.ts";
import { getPortfolio } from "../src/lib/seedData.ts";
const brief = process.argv.includes("--gates");
for (const m of listMeta()) {
  const { form, deck } = await loadFiles(m.slug), c = reconcile(form, deck), gates = [g1(form), g2Offline(deck), g3(describe(form, deck), getPortfolio()), g4(c)];
  console.log(`\n== ${m.company} | ${m.sector} | ${m.stage} | flags ${c.length} (red ${c.filter(x => x.severity === "red").length}) | gates tripped: ${gates.filter(g => g.tripped).map(g => g.gate).join(", ") || "none"}`);
  for (const g of gates.filter(g => g.tripped && g.gate !== "G4")) console.log(`   ${g.gate}: ${g.reason}`);
  if (!brief) for (const x of c) console.log(`  [${x.severity.padEnd(4)}] ${x.kind.padEnd(20)} ${x.name}\n         ${x.formula.slice(0, 230)}`);
}
