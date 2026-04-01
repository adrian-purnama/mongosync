import { cookies } from "next/headers";

import { SESSION_COOKIE_NAME } from "@/src/server/config/constants";
import { AppError } from "@/src/server/utils/errors";
import { getSession } from "./session-service";

export async function requireMasterPassword() {
  const cookieStore = await cookies();
  // Do not use cookieStore.toString() — it is not a Cookie header string and breaks parsing.
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSession(sessionId);

  if (!session) {
    throw new AppError("Unlock the application to continue.", 401);
  }

  return session.password;
}
