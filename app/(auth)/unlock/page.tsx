import { redirect } from "next/navigation";

import { UnlockScreen } from "@/src/components/auth/unlock-screen";
import { getAuthState } from "@/src/server/auth/auth-state";

export default async function UnlockPage() {
  const authState = await getAuthState();

  if (authState.unlocked) {
    redirect("/workspace");
  }

  return <UnlockScreen hasUser={authState.hasUser} />;
}
