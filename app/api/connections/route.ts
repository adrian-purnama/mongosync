import { apiError, apiSuccess } from "@/src/server/api/response";
import { requireMasterPassword } from "@/src/server/auth/auth-guard";
import {
  createConnection,
  listConnections,
} from "@/src/server/connections/connection-service";
import { connectionSchema } from "@/src/server/validation/schemas";

export async function GET(request: Request) {
  try {
    const password = await requireMasterPassword();
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId") ?? undefined;

    return apiSuccess(await listConnections(organizationId, password));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const password = await requireMasterPassword();
    const body = connectionSchema.parse(await request.json());

    return apiSuccess(
      await createConnection({
        ...body,
        password,
      }),
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
