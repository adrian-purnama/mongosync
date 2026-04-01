import { apiError, apiSuccess } from "@/src/server/api/response";
import { requireMasterPassword } from "@/src/server/auth/auth-guard";
import {
  deleteConnection,
  decryptConnectionUrl,
  getConnectionById,
  updateConnection,
} from "@/src/server/connections/connection-service";
import { AppError } from "@/src/server/utils/errors";
import { connectionUpdateSchema } from "@/src/server/validation/schemas";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const password = await requireMasterPassword();
    const { id } = await context.params;
    const connection = await getConnectionById(id);

    if (!connection) {
      throw new AppError("Connection not found.", 404);
    }

    return apiSuccess({
      mongoUrl: decryptConnectionUrl(connection, password),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const password = await requireMasterPassword();
    const { id } = await context.params;
    const body = connectionUpdateSchema.parse({
      ...(await request.json()),
      id,
    });

    return apiSuccess(
      await updateConnection({
        ...body,
        password,
      }),
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await requireMasterPassword();
    const { id } = await context.params;
    await deleteConnection(id);

    return apiSuccess({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
