import { apiError } from "@/src/server/api/response";
import { requireMasterPassword } from "@/src/server/auth/auth-guard";
import { startExportJob } from "@/src/server/mongo/export-service";
import { exportRequestSchema } from "@/src/server/validation/schemas";

export async function POST(request: Request) {
  try {
    const password = await requireMasterPassword();
    const body = exportRequestSchema.parse(await request.json());
    const job = await startExportJob({
      ...body,
      password,
    });

    return Response.json(job, { status: 202 });
  } catch (error) {
    return apiError(error);
  }
}
