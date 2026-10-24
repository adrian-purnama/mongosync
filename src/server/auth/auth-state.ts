import { cookies } from "next/headers";

import { SESSION_COOKIE_NAME } from "@/src/server/config/constants";
import { getRecoveryState } from "./password-management-service";
import { getSession } from "./session-service";
import { getAppData, hasConfiguredUser } from "../storage/config-store";

export async function getAuthState() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSession(sessionId);
  const data = await getAppData();
  const recovery = getRecoveryState(data.user);

  return {
    hasUser: await hasConfiguredUser(),
    unlocked: Boolean(session),
    hasRecovery: recovery.hasRecovery,
    recoveryQuestion: recovery.recoveryQuestion,
  };
}
