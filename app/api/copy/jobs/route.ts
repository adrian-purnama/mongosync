import { apiError, apiSuccess } from "@/src/server/api/response";
import { requireMasterPassword } from "@/src/server/auth/auth-guard";
import { startCopyJob } from "@/src/server/mongo/copy-service";
import { listCopyJobs } from "@/src/server/mongo/copy-job-store";
import { copyRequestSchema } from "@/src/server/validation/schemas";

export async function GET() {
  try {
    await requireMasterPassword();
    return apiSuccess(await listCopyJobs());
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const password = await requireMasterPassword();
    const body = copyRequestSchema.parse(await request.json());

    return apiSuccess(
      await startCopyJob({
        ...body,
        password,
      }),
      { status: 202 },
    );
  } catch (error) {
    return apiError(error);
  }
}
