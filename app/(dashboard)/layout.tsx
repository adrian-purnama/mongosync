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
    <div className="min-h-screen lg:pl-64">
      <AppNav />
      <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        {children}
      </main>
    </div>
  );
}
