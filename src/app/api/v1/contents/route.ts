import type { NextRequest } from "next/server";
import { apiError, apiJson, authenticateApi, likeTerm, pagination, readParam } from "@/lib/api";
import { all, count } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liste paginee des contenus non archives. */
export async function GET(request: NextRequest) {
  const auth = await authenticateApi("content.view");
  if (!auth.ok) return apiError(auth.status, auth.code, auth.message);
  const { companyId } = auth.identity;
  const { limit, offset } = pagination(request);

  const status = readParam(request, "status");
  const type = readParam(request, "type");
  const q = readParam(request, "q");

  const clauses = ["company_id = ?", "archived_at IS NULL"];
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
    clauses.push("(title LIKE ? OR body LIKE ? OR tags LIKE ?)");
    params.push(likeTerm(q), likeTerm(q), likeTerm(q));
  }
  const where = clauses.join(" AND ");

  const total = count(`SELECT COUNT(*) AS n FROM contents WHERE ${where}`, params);
  const items = all(
    `SELECT id, type, title, status, tone, language, campaign_id, assignee_id, author_id,
            scheduled_at, published_at, tags, source, created_at, updated_at
     FROM contents WHERE ${where}
     ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return apiJson({ data: items, pagination: { total, limit, offset } });
}
