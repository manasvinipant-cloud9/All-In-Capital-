export const MAX_PDF = 16 * 1024 * 1024;
export const MAX_FORM_TEXT = 1024 * 1024;
export const MAX_PAGES = 80;

/** A real PDF starts with %PDF- near the top. The file name and the declared type are never trusted. */
export function checkPdf(bytes: Uint8Array, what: string): string | null {
  if (bytes.length === 0) return `The ${what} is empty.`;
  if (bytes.length > MAX_PDF) return `The ${what} is bigger than 16 MB.`;
  if (!new TextDecoder("latin1").decode(bytes.slice(0, 1024)).includes("%PDF-")) return `The ${what} is not a PDF.`;
  return null;
}

/** Simple per-key limit. In memory, so on serverless hosting it limits each running instance, not the whole app. */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private max: number, private windowMs: number) {}
  hit(key: string, now = Date.now()): { ok: true } | { ok: false; retryAfterSec: number } {
    const recent = (this.hits.get(key) ?? []).filter(t => now - t < this.windowMs);
    if (recent.length >= this.max) { this.hits.set(key, recent); return { ok: false, retryAfterSec: Math.ceil((recent[0] + this.windowMs - now) / 1000) }; }
    this.hits.set(key, [...recent, now]); return { ok: true };
  }
}
export const intakeLimiter = new RateLimiter(10, 60 * 60 * 1000);
