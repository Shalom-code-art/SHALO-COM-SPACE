import { get } from "@/lib/db";

export const dynamic = "force-dynamic";

type MediaRow = { mime: string; data: Uint8Array | null };

/**
 * Visuels de vitrine publique : uniquement des images appartenant a une
 * entreprise dont la boutique est active. Aucun document prive n'est expose.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const company = get<{ id: string }>(
    "SELECT id FROM companies WHERE slug = ? AND shop_enabled = 1 AND status = 'active'",
    [slug]
  );
  if (!company) return new Response("Vitrine introuvable.", { status: 404 });

  const file = get<MediaRow>(
    "SELECT mime, data FROM media WHERE id = ? AND company_id = ? AND kind = 'image'",
    [id, company.id]
  );
  if (!file?.data) return new Response("Visuel introuvable.", { status: 404 });

  return new Response(new Uint8Array(file.data), {
    headers: {
      "content-type": /^image\/(png|jpeg|webp|gif)$/.test(file.mime) ? file.mime : "application/octet-stream",
      "cache-control": "public, max-age=86400",
      "x-content-type-options": "nosniff",
    },
  });
}
