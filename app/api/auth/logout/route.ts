import { NextResponse } from "next/server";

import {
  buildExpiredSessionCookie,
  deleteSession,
} from "@/src/server/auth/session-service";

export async function POST() {
  deleteSession();

  return NextResponse.json(
    {
      success: true,
    },
    {
      headers: {
        "Set-Cookie": buildExpiredSessionCookie(),
      },
    },
  );
}
