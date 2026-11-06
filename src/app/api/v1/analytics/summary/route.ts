import type { NextRequest } from "next/server";
import { apiError, apiJson, authenticateApi, readParam } from "@/lib/api";
import { analyticsSummary, resolvePeriod } from "@/lib/reports";

export const dynamic = "force-dynamic";

/**
 * Synthese analytique sur une periode (from/to au format YYYY-MM-DD).
 * Les chiffres proviennent exclusivement de la base : aucune valeur simulee.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateApi("analytics.view");
  if (!auth.ok) return apiError(auth.status, auth.code, auth.message);
  const { companyId } = auth.identity;

  const from = readParam(request, "from");
  const to = readParam(request, "to");
  const period = resolvePeriod(from || null, to || null);
  const summary = analyticsSummary(companyId, period);

  return apiJson({ data: summary });
}
