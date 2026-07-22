"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, NAV_COLOR_CLASSES } from "./navItems";
import type { Role } from "@prisma/client";

export function BottomNav({ role }: { role: Role }) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border-muted bg-surface pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-3xl items-stretch justify-around">
        {NAV_ITEMS[role].map(({ label, href, icon: Icon, color }) => {
          const isOverviewPage = !href.includes("#") && pathname === href;
          const classes = NAV_COLOR_CLASSES[color];
          return (
            <Link
              key={label}
              href={href}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium ${classes.text}`}
            >
              <span className={`flex h-8 w-8 items-center justify-center rounded-full ${isOverviewPage ? classes.bg : ""}`}>
                <Icon className="h-5 w-5" />
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
