import { NextResponse } from "next/server";

import { apiError } from "@/src/server/api/response";
import { resetAllLocalData } from "@/src/server/auth/password-management-service";
import { buildExpiredSessionCookie, deleteSession } from "@/src/server/auth/session-service";

export async function POST() {
  try {
    await resetAllLocalData();
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
  } catch (error) {
    return apiError(error);
  }
}
