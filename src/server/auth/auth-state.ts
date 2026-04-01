import { cookies } from "next/headers";

import { SESSION_COOKIE_NAME } from "@/src/server/config/constants";
import { getSession } from "./session-service";
import { hasConfiguredUser } from "../storage/config-store";

export async function getAuthState() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSession(sessionId);

  return {
    hasUser: await hasConfiguredUser(),
    unlocked: Boolean(session),
  };
}
