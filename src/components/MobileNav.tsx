"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { HaloLogo } from "./HaloLogo";
import { NAV_ITEMS } from "./navItems";
import { logoutAction } from "@/app/(auth)/login/actions";
import type { Role } from "@prisma/client";

export function MobileNav({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <div className="flex items-center justify-between border-b border-border-muted bg-surface px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <HaloLogo size={24} />
          <span className="font-display text-base tracking-[0.15em] text-text">HALO</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation menu"
          className="rounded-lg p-2 text-text-muted hover:bg-surface-raised hover:text-text"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="relative flex w-72 max-w-[80vw] flex-col justify-between border-r border-border-muted bg-surface px-4 py-6">
            <div>
              <div className="flex items-center justify-between px-2">
                <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
                  <HaloLogo size={24} />
                  <span className="font-display text-base tracking-[0.15em] text-text">HALO</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close navigation menu"
                  className="rounded-lg p-2 text-text-muted hover:bg-surface-raised hover:text-text"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="mt-8 flex flex-col gap-1">
                {NAV_ITEMS[role].map(({ label, href, icon: Icon }) => (
                  <Link
                    key={label}
                    href={href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface-raised hover:text-text"
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                ))}
              </nav>
            </div>
            <form action={logoutAction}>
              <button type="submit" className="btn-secondary w-full text-sm">
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
