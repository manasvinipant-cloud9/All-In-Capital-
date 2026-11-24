/** Models often wrap JSON in a code fence or add a sentence before it. Pull out the first JSON value. */
export function parseJson<T>(text: string): T {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(t) as T; } catch {}
  const start = t.search(/[\[{]/);
  if (start < 0) throw new Error("The model's reply had no JSON in it");
  const open = t[start], close = open === "[" ? "]" : "}";
  const end = t.lastIndexOf(close);
  if (end <= start) throw new Error("The model's reply had incomplete JSON");
  return JSON.parse(t.slice(start, end + 1)) as T;
}
