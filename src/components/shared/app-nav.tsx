"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/src/components/brand/logo";
import { cn } from "@/src/components/ui/cn";
import { IconGrid, IconHelp, IconRefresh } from "@/src/components/ui/icons";
import { LogoutButton } from "./logout-button";

const navItems = [
  { href: "/workspace", label: "Workspace", icon: IconGrid },
  { href: "/copy", label: "Copy & Export", icon: IconRefresh },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-[var(--titlebar-height)] z-40 border-b border-white/5 bg-ink text-paper lg:min-h-[calc(100dvh-var(--titlebar-height))] lg:border-b-0 lg:border-r lg:border-white/5">
      <div className="flex items-center gap-4 px-4 py-3 lg:flex-col lg:items-stretch lg:gap-0 lg:px-4 lg:py-6">
        <Link href="/workspace" className="shrink-0 lg:px-2">
          <Logo tone="dark" size="sm" />
        </Link>

        <p className="hidden px-3 pb-2 pt-8 font-display text-[10px] font-medium uppercase tracking-[0.2em] text-fog/60 lg:block">
          Navigate
        </p>

        <nav className="flex min-w-0 flex-1 items-center gap-1 lg:flex-none lg:flex-col lg:items-stretch lg:gap-0.5">
          {navItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex h-9 items-center gap-3 rounded-[10px] px-3 text-sm font-medium transition",
                  active
                    ? "bg-white/[0.08] text-paper"
                    : "text-fog hover:bg-white/[0.04] hover:text-paper",
                )}
              >
                {active ? (
                  <span className="absolute left-0 hidden h-5 w-1 rounded-r-full bg-sync-glow lg:block" />
                ) : null}
                <Icon
                  size={17}
                  className={active ? "text-sync-glow" : "text-fog/70 group-hover:text-fog"}
                />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 hidden border-t border-white/[0.06] pt-4 lg:grid lg:gap-1">
          <div className="mb-1 flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
            <span className="relative flex size-2 shrink-0">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-sync-glow opacity-50" />
              <span className="relative inline-flex size-2 rounded-full bg-sync-glow" />
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-paper">Unlocked</p>
              <p className="truncate text-[11px] text-fog/70">Session stays on this device</p>
            </div>
          </div>
          <Link
            href="/"
            aria-label="How this app works"
            className="flex h-9 items-center gap-3 rounded-[10px] px-3 text-sm font-medium text-fog transition hover:bg-white/[0.04] hover:text-paper"
          >
            <IconHelp size={17} className="text-fog/70" />
            <span>How it works</span>
          </Link>
          <LogoutButton />
        </div>

        <div className="flex items-center gap-1 lg:hidden">
          <Link
            href="/"
            aria-label="How this app works"
            className="flex h-9 items-center gap-3 rounded-[10px] px-3 text-sm font-medium text-fog transition hover:bg-white/[0.04] hover:text-paper"
          >
            <IconHelp size={17} className="text-fog/70" />
          </Link>
          <LogoutButton />
        </div>
      </div>
    </aside>
  );
}
