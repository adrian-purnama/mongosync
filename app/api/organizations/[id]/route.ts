import { apiError, apiSuccess } from "@/src/server/api/response";
import { requireMasterPassword } from "@/src/server/auth/auth-guard";
import { renameOrganization } from "@/src/server/organizations/organization-service";
import { organizationSchema } from "@/src/server/validation/schemas";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireMasterPassword();
    const { id } = await context.params;
    const body = organizationSchema.parse(await request.json());

    return apiSuccess(await renameOrganization(id, body.name));
  } catch (error) {
    return apiError(error);
  }
}
