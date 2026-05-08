"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = {
  href: string;
  label: string;
};

export function HorizontalTabs({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname() ?? "";

  function isActive(href: string) {
    if (href === pathname) return true;
    if (pathname.startsWith(`${href}/`)) return true;
    return false;
  }

  if (tabs.length === 0) return null;

  return (
    <nav className="rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Section navigation">
      <div className="flex gap-1 overflow-x-auto px-2 py-2">
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={
                active
                  ? "shrink-0 rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white shadow-sm"
                  : "shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-orange-50 hover:text-orange-700"
              }
              aria-current={active ? "page" : undefined}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
