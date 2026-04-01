import { apiError, apiSuccess } from "@/src/server/api/response";
import { requireMasterPassword } from "@/src/server/auth/auth-guard";
import {
  decryptConnectionUrl,
  getConnectionById,
} from "@/src/server/connections/connection-service";
import { listCollectionsFromMongo } from "@/src/server/mongo/collection-service";
import { AppError } from "@/src/server/utils/errors";

export async function GET(request: Request) {
  try {
    const password = await requireMasterPassword();
    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get("connectionId");
    const databaseName = searchParams.get("databaseName");

    if (!connectionId) {
      throw new AppError("Connection id is required.");
    }

    if (!databaseName) {
      throw new AppError("Database name is required.");
    }

    const connection = await getConnectionById(connectionId);

    if (!connection) {
      throw new AppError("Connection not found.", 404);
    }

    return apiSuccess(
      await listCollectionsFromMongo(
        decryptConnectionUrl(connection, password),
        databaseName,
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}
