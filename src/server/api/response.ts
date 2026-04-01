import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError, getErrorMessage } from "@/src/server/utils/errors";

export function apiSuccess<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function apiError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Validation failed.",
        issues: error.issues,
      },
      { status: 400 },
    );
  }

  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: error.message,
      },
      { status: error.statusCode },
    );
  }

  return NextResponse.json(
    {
      error: getErrorMessage(error),
    },
    { status: 500 },
  );
}
