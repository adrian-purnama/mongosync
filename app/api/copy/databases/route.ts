import { apiError, apiSuccess } from "@/src/server/api/response";
import { requireMasterPassword } from "@/src/server/auth/auth-guard";
import {
  decryptConnectionUrl,
  getConnectionById,
} from "@/src/server/connections/connection-service";
import { listDatabasesFromMongo } from "@/src/server/mongo/collection-service";
import { AppError } from "@/src/server/utils/errors";

export async function GET(request: Request) {
  try {
    const password = await requireMasterPassword();
    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get("connectionId");

    if (!connectionId) {
      throw new AppError("Connection id is required.");
    }

    const connection = await getConnectionById(connectionId);

    if (!connection) {
      throw new AppError("Connection not found.", 404);
    }

    return apiSuccess(
      await listDatabasesFromMongo(decryptConnectionUrl(connection, password)),
    );
  } catch (error) {
    return apiError(error);
  }
}
