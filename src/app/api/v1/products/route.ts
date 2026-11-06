import type { NextRequest } from "next/server";
import { apiError, apiJson, authenticateApi, likeTerm, pagination, readParam } from "@/lib/api";
import { all, count } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liste paginee du catalogue (produits et services). */
export async function GET(request: NextRequest) {
  const auth = await authenticateApi("catalog.view");
  if (!auth.ok) return apiError(auth.status, auth.code, auth.message);
  const { companyId } = auth.identity;
  const { limit, offset } = pagination(request);

  const kind = readParam(request, "kind");
  const availability = readParam(request, "availability");
  const category = readParam(request, "category");
  const q = readParam(request, "q");

  const clauses = ["company_id = ?"];
  const params: unknown[] = [companyId];
  if (kind === "product" || kind === "service") {
    clauses.push("kind = ?");
    params.push(kind);
  }
  if (availability) {
    clauses.push("availability = ?");
    params.push(availability);
  }
  if (category) {
    clauses.push("category_id = ?");
    params.push(category);
  }
  if (q) {
    clauses.push("(name LIKE ? OR sku LIKE ? OR description LIKE ?)");
    params.push(likeTerm(q), likeTerm(q), likeTerm(q));
  }
  const where = clauses.join(" AND ");

  const total = count(`SELECT COUNT(*) AS n FROM products WHERE ${where}`, params);
  const items = all(
    `SELECT id, kind, name, sku, category_id, price_cents, currency, image_media_id, availability,
            featured, is_public, position, created_at, updated_at
     FROM products WHERE ${where} ORDER BY position, name LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return apiJson({ data: items, pagination: { total, limit, offset } });
}
