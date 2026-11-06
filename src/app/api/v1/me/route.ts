import { apiError, apiJson, authenticateApi } from "@/lib/api";
import { get } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Identite de l'appelant et droits effectifs. */
export async function GET() {
  const auth = await authenticateApi();
  if (!auth.ok) return apiError(auth.status, auth.code, auth.message);
  const { identity } = auth;

  const company = get<{ id: string; name: string; slug: string; plan: string; subscription_status: string; status: string }>(
    "SELECT id, name, slug, plan, subscription_status, status FROM companies WHERE id = ?",
    [identity.companyId]
  );

  return apiJson({
    data: {
      actor: identity.actor,
      via: identity.via,
      permissions: identity.permissions,
      company,
    },
  });
}
