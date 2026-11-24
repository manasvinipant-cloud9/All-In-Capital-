// WCAG AA check for every text/background token pair, both themes.
import { readFileSync } from "node:fs";
const css = readFileSync("src/app/globals.css", "utf8");
const grab = (block: string) => Object.fromEntries([...block.matchAll(/--([a-z-]+):\s*(#[0-9A-Fa-f]{6})/g)].map(m => [m[1], m[2]]));
const light = grab(css.split(":root {")[1].split("}")[0]);
const darkBlock = css.match(/:root\[data-theme="dark"\] \{([^}]*)\}/)![1];
const dark = { ...light, ...grab(darkBlock) };
const lum = (h: string) => { const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
export const PAIRS: [string, string, number][] = [["ink","bg",4.5],["ink","card",4.5],["muted","bg",4.5],["muted","card",4.5],["subtle","bg",4.5],["subtle","card",4.5],["cobalt","bg",4.5],["cobalt","card",4.5],["on-cobalt","cobalt",4.5],
  ["green","green-tint",4.5],["amber","amber-tint",4.5],["red","red-tint",4.5],["on-dark","dark-panel",4.5],["ink","amber-tint",4.5],["amber","bg",4.5]];
export function failures() { const f: string[] = []; for (const [n, t] of [["light", light], ["dark", dark]] as const) for (const [a, b, min] of PAIRS) { const r = ratio(t[a], t[b]); if (r < min) f.push(`${n}: ${a} on ${b} = ${r.toFixed(2)} (< ${min})`); } return f; }
if (process.argv[1]?.endsWith("contrast.ts")) { const f = failures(); console.log(f.length ? f.join("\n") : "all pairs pass AA"); process.exit(f.length ? 1 : 0); }
