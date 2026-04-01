import { apiError, apiSuccess } from "@/src/server/api/response";
import { requireMasterPassword } from "@/src/server/auth/auth-guard";
import { loadPersistedJob } from "@/src/server/jobs/job-store";
import { getCopyJob, requestCopyJobCancellation } from "@/src/server/mongo/copy-job-store";
import { AppError } from "@/src/server/utils/errors";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireMasterPassword();
    const { id } = await context.params;
    const job = (await loadPersistedJob(id).catch(() => null)) ?? (await getCopyJob(id));

    if (!job) {
      throw new AppError("Copy job not found.", 404);
    }

    return apiSuccess(job);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(_request: Request, context: RouteContext) {
  try {
    await requireMasterPassword();
    const { id } = await context.params;
    const job = await requestCopyJobCancellation(id);

    if (!job) {
      throw new AppError("Job not found.", 404);
    }

    return apiSuccess(job);
  } catch (error) {
    return apiError(error);
  }
}
