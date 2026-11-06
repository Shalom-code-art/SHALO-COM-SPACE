import type { NextRequest } from "next/server";
import { apiError, apiJson, authenticateApi, likeTerm, pagination, readParam } from "@/lib/api";
import { all, count } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liste paginee des campagnes. */
export async function GET(request: NextRequest) {
  const auth = await authenticateApi("campaign.view");
  if (!auth.ok) return apiError(auth.status, auth.code, auth.message);
  const { companyId } = auth.identity;
  const { limit, offset } = pagination(request);

  const status = readParam(request, "status");
  const type = readParam(request, "type");
  const q = readParam(request, "q");

  const clauses = ["company_id = ?"];
  const params: unknown[] = [companyId];
  if (status) {
    clauses.push("status = ?");
    params.push(status);
  }
  if (type) {
    clauses.push("type = ?");
    params.push(type);
  }
  if (q) {
    clauses.push("(name LIKE ? OR objective LIKE ? OR description LIKE ? OR audience LIKE ?)");
    params.push(likeTerm(q), likeTerm(q), likeTerm(q), likeTerm(q));
  }
  const where = clauses.join(" AND ");

  const total = count(`SELECT COUNT(*) AS n FROM campaigns WHERE ${where}`, params);
  const items = all(
    `SELECT id, name, type, objective, audience, start_date, end_date, budget_cents, currency, channels,
            status, owner_id, kpi_target, results_notes, created_at, updated_at
     FROM campaigns WHERE ${where} ORDER BY COALESCE(start_date, created_at) DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return apiJson({ data: items, pagination: { total, limit, offset } });
}
