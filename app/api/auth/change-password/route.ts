import { NextResponse } from "next/server";

import { apiError } from "@/src/server/api/response";
import { requireMasterPassword } from "@/src/server/auth/auth-guard";
import { changeMasterPassword } from "@/src/server/auth/password-management-service";
import { buildSessionCookie, createSession } from "@/src/server/auth/session-service";

export async function POST(request: Request) {
  try {
    await requireMasterPassword();

    const body = (await request.json()) as {
      currentPassword?: string;
      newPassword?: string;
    };

    await changeMasterPassword(
      body.currentPassword ?? "",
      body.newPassword ?? "",
    );

    const rotatedSessionId = await createSession(body.newPassword ?? "");

    return NextResponse.json(
      {
        success: true,
      },
      {
        headers: {
          "Set-Cookie": buildSessionCookie(rotatedSessionId),
        },
      },
    );
  } catch (error) {
    return apiError(error);
  }
}
