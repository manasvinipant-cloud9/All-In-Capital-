"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const NAV = [["Board", "/"], ["Meetings", "/meetings"], ["Calibration", "/calibration"], ["Corrections", "/corrections"], ["Portfolio", "/portfolio"], ["Settings", "/settings"]] as const;
const TABS = [["Board", "/"], ["Meetings", "/meetings"], ["Calibration", "/calibration"], ["Portfolio", "/portfolio"], ["More", "/settings"]] as const;
const on = (p: string, h: string) => (h === "/" ? p === "/" || p.startsWith("/apps") : p.startsWith(h));
export default function TopBar() {
  const p = usePathname();
  if (p === "/login") return null;
  return (<>
    <header className="hidden md:block border-b border-line bg-card">
      <nav aria-label="Main" className="mx-auto flex h-14 max-w-[1280px] items-center gap-6 px-6">
        <Link href="/" className="font-[family-name:var(--font-head)] text-lg font-semibold tracking-tight">All In Capital</Link>
        <ul className="flex gap-1">
          {NAV.map(([n, h]) => <li key={h}><Link href={h} aria-current={on(p, h) ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm ${on(p, h) ? "bg-bg font-semibold text-ink" : "text-muted hover:text-ink"}`}>{n}</Link></li>)}
        </ul>
        <span className="ml-auto text-sm text-subtle"><kbd className="num rounded border border-line px-1.5">/</kbd> search</span>
      </nav>
    </header>
    <nav aria-label="Tabs" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-card md:hidden">
      {TABS.map(([n, h]) => <Link key={h} href={h} aria-current={on(p, h) ? "page" : undefined} className={`flex min-h-14 items-center justify-center text-xs ${on(p, h) ? "font-semibold text-cobalt" : "text-muted"}`}>{n}</Link>)}
    </nav>
  </>);
}
