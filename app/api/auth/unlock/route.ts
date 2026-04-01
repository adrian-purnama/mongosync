import { NextResponse } from "next/server";

import { apiError } from "@/src/server/api/response";
import { verifyMasterPassword } from "@/src/server/auth/password-service";
import { buildSessionCookie, createSession } from "@/src/server/auth/session-service";
import { getAppData } from "@/src/server/storage/config-store";
import { AppError } from "@/src/server/utils/errors";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { password?: string };
    const data = await getAppData();

    if (!data.user) {
      throw new AppError("Set up a master password first.", 404);
    }

    const password = body.password ?? "";
    const valid = await verifyMasterPassword(
      password,
      data.user.masterPasswordHash,
    );

    if (!valid) {
      throw new AppError("Incorrect master password.", 401);
    }

    const sessionId = await createSession(password);

    return NextResponse.json(
      {
        success: true,
      },
      {
        headers: {
          "Set-Cookie": buildSessionCookie(sessionId),
        },
      },
    );
  } catch (error) {
    return apiError(error);
  }
}
