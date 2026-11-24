// Step 3: seal a 20-row test set BEFORE any training or prompt work. The harness refuses to run if it changes.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { DATA, readJson, sha256, writeJson } from "./lib.ts";

type Row = { row_id: string; founder_type: string };
if (existsSync(`${DATA}/sealed_test.sha256`)) { console.error("Already sealed. Refusing to re-seal: that would defeat the seal."); process.exit(1); }

const clean = readJson<Row[]>("clean.json");
// Fixed seed: order rows by a hash of their id, then take a share of each founder type so the 20 are stratified.
const order = (xs: Row[]) => [...xs].sort((a, b) => sha256("b6-seed-1" + a.row_id).localeCompare(sha256("b6-seed-1" + b.row_id)));
const types = [...new Set(clean.map(r => r.founder_type))].sort();
const sealed: Row[] = [];
let left = 20;
types.forEach((t, i) => {
  const pool = order(clean.filter(r => r.founder_type === t));
  const n = i === types.length - 1 ? left : Math.round((pool.length / clean.length) * 20);
  sealed.push(...pool.slice(0, n)); left -= n;
});
const ids = new Set(sealed.map(r => r.row_id));
const body = JSON.stringify(sealed.sort((a, b) => a.row_id.localeCompare(b.row_id)));
const fingerprint = sha256(body);
writeJson("sealed_test.json", JSON.parse(body));
writeJson("train_pool.json", clean.filter(r => !ids.has(r.row_id)));
writeFileSync(`${DATA}/sealed_test.sha256`, fingerprint);
writeFileSync("docs/B6_SEAL.txt", `Sealed test set fingerprint (SHA-256): ${fingerprint}\nRows: ${sealed.length}; by founder type: ${types.map(t => `${t} ${sealed.filter(r => r.founder_type === t).length}`).join(", ")}\nSealed before any prompt, harness or training work.\n`);
console.log(readFileSync("docs/B6_SEAL.txt", "utf8"));
