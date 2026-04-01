import { NextResponse } from "next/server";

import { apiError } from "@/src/server/api/response";
import { hashMasterPassword } from "@/src/server/auth/password-service";
import { buildSessionCookie, createSession } from "@/src/server/auth/session-service";
import { getAppData, saveAppData } from "@/src/server/storage/config-store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { password?: string };
    const data = await getAppData();

    if (data.user) {
      return NextResponse.json(
        { error: "Master password has already been configured." },
        { status: 409 },
      );
    }

    const password = body.password ?? "";
    const masterPasswordHash = await hashMasterPassword(password);

    await saveAppData({
      ...data,
      user: {
        masterPasswordHash,
        createdAt: new Date().toISOString(),
      },
    });

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
