type ApiErrorPayload = {
  error?: string;
};

export async function readApiResponse<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  const raw = await response.text();
  const trimmed = raw.trim();

  if (!trimmed) {
    if (response.ok) {
      return null as T;
    }

    throw new Error(fallbackMessage);
  }

  try {
    const payload = JSON.parse(trimmed) as T | ApiErrorPayload;

    if (!response.ok) {
      throw new Error(
        typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          typeof payload.error === "string" &&
          payload.error.length > 0
          ? payload.error
          : fallbackMessage,
      );
    }

    return payload as T;
  } catch (error) {
    if (error instanceof Error && error.message !== "Unexpected end of JSON input") {
      if (!response.ok && error.message !== fallbackMessage) {
        throw error;
      }
    }

    if (!response.ok) {
      throw new Error(trimmed || fallbackMessage);
    }

    throw new Error("The server returned an invalid response.");
  }
}
