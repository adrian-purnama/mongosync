import { redirect } from "next/navigation";

import { AppNav } from "@/src/components/shared/app-nav";
import { getAuthState } from "@/src/server/auth/auth-state";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const authState = await getAuthState();

  if (!authState.unlocked) {
    redirect("/unlock");
  }

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto w-full max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
