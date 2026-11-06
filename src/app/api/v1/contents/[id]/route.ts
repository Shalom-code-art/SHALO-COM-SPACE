import { apiError, apiJson, authenticateApi } from "@/lib/api";
import { all, get } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Detail d'un contenu avec ses commentaires et revisions associees. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApi("content.view");
  if (!auth.ok) return apiError(auth.status, auth.code, auth.message);
  const { companyId } = auth.identity;
  const { id } = await context.params;

  const content = get(
    `SELECT id, type, title, body, tone, language, status, campaign_id, social_account_id, assignee_id,
            author_id, scheduled_at, published_at, tags, source, archived_at, created_at, updated_at
     FROM contents WHERE id = ? AND company_id = ?`,
    [id, companyId]
  );
  if (!content) return apiError(404, "not_found", "Contenu introuvable.");

  const comments = all(
    "SELECT id, author_id, body, created_at FROM content_comments WHERE content_id = ? AND company_id = ? ORDER BY created_at",
    [id, companyId]
  );
  const revisions = all(
    "SELECT id, title, author_id, created_at FROM content_revisions WHERE content_id = ? AND company_id = ? ORDER BY created_at DESC LIMIT 20",
    [id, companyId]
  );
  const media = all(
    `SELECT m.id, m.name, m.mime, m.kind FROM content_media cm
     JOIN media m ON m.id = cm.media_id WHERE cm.content_id = ? AND m.company_id = ?`,
    [id, companyId]
  );

  return apiJson({ data: { content, comments, revisions, media } });
}
