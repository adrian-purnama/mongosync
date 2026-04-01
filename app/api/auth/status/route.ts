import { NextResponse } from "next/server";
import { parse } from "cookie";

import { SESSION_COOKIE_NAME } from "@/src/server/config/constants";
import { getSession } from "@/src/server/auth/session-service";
import { hasConfiguredUser } from "@/src/server/storage/config-store";

export async function GET(request: Request) {
  const sessionToken = parse(request.headers.get("cookie") ?? "")[
    SESSION_COOKIE_NAME
  ];
  const session = await getSession(sessionToken);

  return NextResponse.json({
    hasUser: await hasConfiguredUser(),
    unlocked: Boolean(session),
  });
}
