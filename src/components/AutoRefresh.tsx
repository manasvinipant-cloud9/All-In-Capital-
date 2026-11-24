"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
/** Refreshes the page every 5 seconds while something is still being read. */
export default function AutoRefresh({ active }: { active: boolean }) {
  const r = useRouter();
  useEffect(() => { if (!active) return; const t = setInterval(() => r.refresh(), 5000); return () => clearInterval(t); }, [active, r]);
  return null;
}
