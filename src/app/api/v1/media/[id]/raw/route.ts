import { requireApiUser } from "@/lib/auth";
import { get } from "@/lib/db";

export const dynamic = "force-dynamic";

type MediaRow = {
  name: string;
  mime: string;
  data: Uint8Array | null;
  external_url: string | null;
};

/** Sert un fichier de la mediatheque a l'entreprise proprietaire uniquement. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser("media.view");
  if (!user || !user.companyId) {
    return new Response("Accès refusé.", { status: 401 });
  }
  const { id } = await params;
  const file = get<MediaRow>("SELECT name, mime, data, external_url FROM media WHERE id = ? AND company_id = ?", [
    id,
    user.companyId,
  ]);
  if (!file) return new Response("Fichier introuvable.", { status: 404 });

  if (!file.data && file.external_url) {
    return Response.redirect(file.external_url, 302);
  }
  if (!file.data) return new Response("Contenu indisponible.", { status: 404 });

  const inline = /^(image|video|audio)\//.test(file.mime) || file.mime === "application/pdf";
  const filename = file.name.replace(/["\\\r\n]/g, "_");

  return new Response(new Uint8Array(file.data), {
    headers: {
      "content-type": file.mime || "application/octet-stream",
      "content-length": String(file.data.byteLength ?? file.data.length ?? 0),
      "content-disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
      "cache-control": "private, max-age=3600",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
    },
  });
}
