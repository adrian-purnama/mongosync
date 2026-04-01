import { apiError, apiSuccess } from "@/src/server/api/response";
import { requireMasterPassword } from "@/src/server/auth/auth-guard";
import {
  createOrganization,
  listOrganizations,
} from "@/src/server/organizations/organization-service";
import { organizationSchema } from "@/src/server/validation/schemas";

export async function GET() {
  try {
    await requireMasterPassword();
    return apiSuccess(await listOrganizations());
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireMasterPassword();
    const body = organizationSchema.parse(await request.json());
    return apiSuccess(await createOrganization(body.name), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
