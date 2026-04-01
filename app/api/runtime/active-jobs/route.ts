import { apiError, apiSuccess } from "@/src/server/api/response";
import { listActiveCopyJobs } from "@/src/server/mongo/copy-job-store";
import { AppError } from "@/src/server/utils/errors";

function requireInternalToken(request: Request) {
  const expectedToken = process.env.MONGOSYNC_INTERNAL_TOKEN;

  if (!expectedToken) {
    throw new AppError("Internal runtime token is not configured.", 503);
  }

  const providedToken = request.headers.get("x-mongosync-internal-token");

  if (providedToken !== expectedToken) {
    throw new AppError("Unauthorized.", 401);
  }
}

export async function GET(request: Request) {
  try {
    requireInternalToken(request);
    const jobs = await listActiveCopyJobs();
    return apiSuccess({
      activeJobCount: jobs.length,
      hasActiveJobs: jobs.length > 0,
      jobs: jobs.map((job) => ({
        id: job.id,
        status: job.status,
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}
