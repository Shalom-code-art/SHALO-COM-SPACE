import Link from "next/link";
import { ConfirmSubmit, Disclosure, SearchForm } from "@/components/controls";
import { Icon } from "@/components/icons";
import { Card, CardHeader, EmptyState, Flash, PageHeader, Progress, StatCard, Tabs } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { formatBytes, formatDate } from "@/lib/format";
import { mediaUrl, storageUsage } from "@/lib/media";
import { deleteMediaAction, updateMediaAction, uploadMediaAction } from "@/server/actions/media";

export const metadata = { title: "Médiathèque" };

const KIND_LABELS: Record<string, string> = {
  image: "Images",
  video: "Vidéos",
  audio: "Audios",
  document: "Documents",
};

const KIND_ICONS: Record<string, string> = {
  video: "play",
  audio: "play",
  document: "file",
  image: "image",
};

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string; folder?: string; saved?: string; error?: string }>;
}) {
  const user = await requireUser("media.view");
  const companyId = user.companyId!;
  const query = await searchParams;
  const canManage = user.permissions.includes("media.manage");
  const canDelete = user.permissions.includes("media.delete");

  const usage = storageUsage(companyId);
  const folders = all<{ folder: string; total: number }>(
    `SELECT folder, COUNT(*) AS total FROM media WHERE company_id = ?
     GROUP BY folder ORDER BY folder`,
    [companyId]
  );
  const kindCounts = all<{ kind: string; total: number }>(
    "SELECT kind, COUNT(*) AS total FROM media WHERE company_id = ? GROUP BY kind",
    [companyId]
  );

  const where = ["m.company_id = ?"];
  const args: unknown[] = [companyId];
  if (query.q) {
    where.push("(m.name LIKE ? OR m.tags LIKE ?)");
    const like = `%${query.q.trim()}%`;
    args.push(like, like);
  }
  if (query.kind && query.kind !== "all") {
    where.push("m.kind = ?");
    args.push(query.kind);
  }
  if (query.folder) {
    where.push("m.folder = ?");
    args.push(query.folder);
  }

  const files = all<{
    id: string;
    name: string;
    mime: string;
    kind: string;
    size_bytes: number;
    folder: string;
    tags: string | null;
    created_at: string;
    uploader: string | null;
  }>(
    `SELECT m.id, m.name, m.mime, m.kind, m.size_bytes, m.folder, m.tags, m.created_at, u.name AS uploader
     FROM media m LEFT JOIN users u ON u.id = m.uploaded_by
     WHERE ${where.join(" AND ")}
     ORDER BY m.created_at DESC LIMIT 200`,
    args
  );

  const totalFiles = kindCounts.reduce((sum, row) => sum + Number(row.total), 0);
  const filterHref = (kind?: string) => {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (query.folder) params.set("folder", query.folder);
    if (kind && kind !== "all") params.set("kind", kind);
    const search = params.toString();
    return `/app/media${search ? `?${search}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Médiathèque"
        subtitle="Images, logos, vidéos, documents, affiches et fichiers audio de l'entreprise, stockés et contrôlés par cette plateforme."
        icon="folder"
        actions={
          <Link href="/app/content" className="btn">
            <Icon name="pen" className="h-4 w-4" /> Utiliser dans un contenu
          </Link>
        }
      />

      <Flash saved={query.saved} error={query.error} />

      <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader title="Stockage de l'entreprise" subtitle={`${formatBytes(usage.usedBytes)} utilisés sur ${usage.quotaMb} Mo`} icon="database" />
          <Progress value={usage.percent} tone={usage.percent > 85 ? "rose" : "brand"} />
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-ink-50 px-2 py-2">
              <p className="text-[10px] uppercase tracking-wide text-ink-400">Fichiers</p>
              <p className="text-[13px] font-semibold text-ink-800">{totalFiles}</p>
            </div>
            <div className="rounded-xl bg-ink-50 px-2 py-2">
              <p className="text-[10px] uppercase tracking-wide text-ink-400">Utilisé</p>
              <p className="text-[13px] font-semibold text-ink-800">{formatBytes(usage.usedBytes)}</p>
            </div>
            <div className="rounded-xl bg-ink-50 px-2 py-2">
              <p className="text-[10px] uppercase tracking-wide text-ink-400">Restant</p>
              <p className="text-[13px] font-semibold text-ink-800">{formatBytes(usage.remainingBytes)}</p>
            </div>
          </div>
          <p className="hint">
            Le quota dépend de l&apos;abonnement. Les fichiers sont stockés en base et servis uniquement aux personnes autorisées de l&apos;entreprise.
          </p>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard label="Images" value={Number(kindCounts.find((row) => row.kind === "image")?.total ?? 0)} icon="image" tone="brand" />
          <StatCard label="Vidéos" value={Number(kindCounts.find((row) => row.kind === "video")?.total ?? 0)} icon="play" tone="violet" />
          <StatCard label="Audios" value={Number(kindCounts.find((row) => row.kind === "audio")?.total ?? 0)} icon="bell" tone="sky" />
          <StatCard label="Documents" value={Number(kindCounts.find((row) => row.kind === "document")?.total ?? 0)} icon="file" tone="accent" />
        </div>
      </div>

      {canManage ? (
        <div className="mt-4">
          <Disclosure title="Importer des fichiers">
            <form action={uploadMediaAction} className="card card-pad grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="label" htmlFor="files">Fichiers (10 Mo maximum par fichier)</label>
                <input id="files" type="file" name="files" multiple required className="input" />
                <p className="hint">Formats acceptés : images (png, jpg, webp, gif, svg), vidéos (mp4, webm), audio (mp3, wav, ogg), PDF, textes, tableurs, présentations et archives ZIP.</p>
              </div>
              <div>
                <label className="label" htmlFor="folder">Dossier</label>
                <input id="folder" name="folder" list="media-folders" defaultValue="Général" className="input" />
                <datalist id="media-folders">
                  {folders.map((row) => (
                    <option key={row.folder} value={row.folder} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="label" htmlFor="tags">Étiquettes</label>
                <input id="tags" name="tags" className="input" placeholder="logo, affiche, campagne-2026" />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <button type="submit" className="btn btn-primary">
                  <Icon name="upload" className="h-4 w-4" /> Importer
                </button>
              </div>
            </form>
          </Disclosure>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <SearchForm
          action="/app/media"
          placeholder="Nom de fichier, étiquette…"
          defaultValue={query.q ?? ""}
          hidden={{ ...(query.kind ? { kind: query.kind } : {}), ...(query.folder ? { folder: query.folder } : {}) }}
        />
        {query.folder ? (
          <Link href={filterHref(query.kind)} className="badge border-brand-200 bg-brand-50 text-brand-700">
            Dossier : {query.folder} <Icon name="close" className="ml-1 h-3 w-3" />
          </Link>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {folders.map((row) => (
          <Link
            key={row.folder}
            href={`/app/media?folder=${encodeURIComponent(row.folder)}`}
            className={
              query.folder === row.folder
                ? "badge border-brand-700 bg-brand-700 text-white"
                : "badge border-ink-200 bg-white text-ink-600 hover:border-brand-200 hover:text-brand-700"
            }
          >
            <Icon name="folder" className="mr-1 h-3 w-3" /> {row.folder}
            <span className="ml-1 text-[10px] opacity-70">{row.total}</span>
          </Link>
        ))}
      </div>

      <div className="mt-3">
        <Tabs
          items={[
            { label: "Tous les fichiers", href: filterHref("all"), active: !query.kind || query.kind === "all", count: totalFiles },
            ...Object.entries(KIND_LABELS).map(([key, label]) => ({
              label,
              href: filterHref(key),
              active: query.kind === key,
              count: Number(kindCounts.find((row) => row.kind === key)?.total ?? 0),
            })),
          ]}
        />
      </div>

      <Card>
        <CardHeader title="Fichiers" subtitle={`${files.length} fichier(s) affiché(s)`} icon="folder" />
        {files.length === 0 ? (
          <EmptyState
            icon="folder"
            title="Aucun fichier"
            description="Importez vos logos, affiches, vidéos et documents pour les réutiliser dans vos contenus et votre boutique."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {files.map((file) => {
              const src = mediaUrl(file.id) ?? "";
              const tags = (file.tags ?? "").split(",").map((tag) => tag.trim()).filter(Boolean);
              return (
                <div key={file.id} className="animate-rise rounded-xl border border-ink-200 bg-white p-2.5">
                  <div className="mb-2 grid h-32 place-items-center overflow-hidden rounded-lg bg-ink-50">
                    {file.kind === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt={file.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="grid place-items-center gap-1 text-ink-400">
                        <Icon name={KIND_ICONS[file.kind] ?? "file"} className="h-8 w-8" />
                        <span className="text-[10px] uppercase tracking-wide">{file.mime.split("/").pop()}</span>
                      </span>
                    )}
                  </div>
                  <p className="truncate text-[12.5px] font-semibold text-ink-900" title={file.name}>{file.name}</p>
                  <p className="text-[10.5px] text-ink-400">
                    {formatBytes(file.size_bytes)} · {file.folder} · {formatDate(file.created_at)}
                  </p>
                  {tags.length ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="rounded-md bg-ink-100 px-1.5 py-0.5 text-[10px] text-ink-600">{tag}</span>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    <a href={src} target="_blank" rel="noreferrer" className="btn btn-sm">
                      <Icon name="eye" className="h-3.5 w-3.5" /> Ouvrir
                    </a>
                    {canManage ? (
                      <details className="relative">
                        <summary className="btn btn-sm cursor-pointer list-none">
                          <Icon name="edit" className="h-3.5 w-3.5" /> Modifier
                        </summary>
                        <form action={updateMediaAction} className="card card-pad mt-2 space-y-2">
                          <input type="hidden" name="id" value={file.id} />
                          <div>
                            <label className="label" htmlFor={`name-${file.id}`}>Nom</label>
                            <input id={`name-${file.id}`} name="name" defaultValue={file.name} className="input" required />
                          </div>
                          <div>
                            <label className="label" htmlFor={`folder-${file.id}`}>Dossier</label>
                            <input id={`folder-${file.id}`} name="folder" defaultValue={file.folder} className="input" />
                          </div>
                          <div>
                            <label className="label" htmlFor={`tags-${file.id}`}>Étiquettes</label>
                            <input id={`tags-${file.id}`} name="tags" defaultValue={file.tags ?? ""} className="input" />
                          </div>
                          <button type="submit" className="btn btn-primary btn-sm w-full justify-center">
                            <Icon name="check" className="h-3.5 w-3.5" /> Enregistrer
                          </button>
                        </form>
                      </details>
                    ) : null}
                    {canDelete ? (
                      <form action={deleteMediaAction}>
                        <input type="hidden" name="id" value={file.id} />
                        <ConfirmSubmit message="Supprimer ce fichier ?">Supprimer</ConfirmSubmit>
                      </form>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <p className="mt-3 text-[11px] text-ink-400">
        Les fichiers importés par {user.name} et l&apos;équipe restent privés à l&apos;entreprise. Toute suppression est enregistrée dans le journal d&apos;audit.
      </p>
    </>
  );
}
