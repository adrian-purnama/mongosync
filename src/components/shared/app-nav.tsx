import Image from "next/image";
import Link from "next/link";

import { APP_NAME } from "@/src/server/config/constants";
import { LogoutButton } from "./logout-button";

const navItems = [
  { href: "/workspace", label: "Workspace" },
  { href: "/copy", label: "Copy Tool" },
];

export function AppNav() {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/assets/logo only.png"
            alt={`${APP_NAME} logo`}
            width={72}
            height={72}
            className="w-20 shrink-0 object-contain"
            priority
          />
          <div className="grid gap-1 min-w-0 items-center">
          {/* <Image
            src="/assets/logo only.png"
            alt={`${APP_NAME} logo`}
            width={72}
            height={72}
            className="h-12 w-12 shrink-0 object-contain"
            priority
          /> */}
            {/* <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">
              Local-first Mongo utility
            </p> */}
          </div>
        </Link>

        <nav className="flex items-center gap-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/"
            aria-label="How this app works"
            title="How this app works"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-900 bg-zinc-950 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            ?
          </Link>
          <LogoutButton />
        </nav>
      </div>
    </header>
  );
}
