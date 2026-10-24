"use client";

import { useRouter } from "next/navigation";

import { IconLock } from "@/src/components/ui/icons";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST",
    });

    router.push("/unlock");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      aria-label="Lock app"
      className="flex h-9 items-center gap-3 rounded-[10px] px-3 text-sm font-medium text-fog transition hover:bg-white/[0.04] hover:text-paper"
    >
      <IconLock size={17} className="text-fog/70" />
      <span className="hidden lg:inline">Lock app</span>
    </button>
  );
}
