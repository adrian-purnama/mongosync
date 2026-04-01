import { apiError } from "@/src/server/api/response";
import { requireMasterPassword } from "@/src/server/auth/auth-guard";
import { loadPersistedJobArtifact } from "@/src/server/jobs/job-store";
import { getCopyJob } from "@/src/server/mongo/copy-job-store";
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
    const job = await getCopyJob(id);

    if (!job) {
      throw new AppError("Job not found.", 404);
    }

    if (job.kind !== "export") {
      throw new AppError("Only export jobs can be downloaded.", 400);
    }

    if (job.status !== "completed" || !job.resultAvailable) {
      throw new AppError("Export artifact is not ready yet.", 409);
    }

    const artifact = await loadPersistedJobArtifact(id);

    return new Response(artifact, {
      status: 200,
      headers: {
        "Content-Type": job.artifactContentType ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${job.artifactFileName ?? `${job.id}.bin`}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
