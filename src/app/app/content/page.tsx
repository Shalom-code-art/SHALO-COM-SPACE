import Link from "next/link";
import { ConfirmSubmit, Disclosure, SearchForm } from "@/components/controls";
import { Icon } from "@/components/icons";
import { Badge, Card, EmptyState, Flash, PageHeader, Tabs } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { all, count } from "@/lib/db";
import { CONTENT_STATUSES, CONTENT_TYPES, EDITORIAL_TONES, formatDateTime, labelOf, formatRelative } from "@/lib/format";
import { archiveContentAction, createContentAction, deleteContentAction, duplicateContentAction } from "@/server/actions/content";

export const metadata = { title: "Studio de contenus" };

const PAGE_SIZE = 25;

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; type?: string; archived?: string; page?: string; error?: string; saved?: string; new?: string }>;
}) {
  const user = await requireUser("content.view");
  const companyId = user.companyId!;
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const archived = params.archived === "1";

  const where: string[] = ["c.company_id = ?"];
  const args: unknown[] = [companyId];
  where.push(archived ? "c.archived_at IS NOT NULL" : "c.archived_at IS NULL");
  if (params.q) {
    where.push("(c.title LIKE ? OR c.body LIKE ? OR c.tags LIKE ?)");
    const like = `%${params.q}%`;
    args.push(like, like, like);
  }
  if (params.status && params.status !== "all") {
    where.push("c.status = ?");
    args.push(params.status);
  }
  if (params.type && params.type !== "all") {
    where.push("c.type = ?");
    args.push(params.type);
  }
  const whereSql = where.join(" AND ");

  const total = count(`SELECT COUNT(*) AS n FROM contents c WHERE ${whereSql}`, args);
  const rows = all<{
    id: string;
    title: string;
    type: string;
    status: string;
    tone: string | null;
    scheduled_at: string | null;
    updated_at: string;
    tags: string | null;
    assignee: string | null;
    author: string | null;
    campaign: string | null;
    comments: number;
  }>(
    `SELECT c.id, c.title, c.type, c.status, c.tone, c.scheduled_at, c.updated_at, c.tags,
            a.name AS assignee, au.name AS author, cp.name AS campaign,
            (SELECT COUNT(*) FROM content_comments cc WHERE cc.content_id = c.id) AS comments
     FROM contents c
     LEFT JOIN users a ON a.id = c.assignee_id
     LEFT JOIN users au ON au.id = c.author_id
     LEFT JOIN campaigns cp ON cp.id = c.campaign_id
     WHERE ${whereSql}
     ORDER BY c.updated_at DESC
     LIMIT ? OFFSET ?`,
    [...args, PAGE_SIZE, (page - 1) * PAGE_SIZE]
  );

  const statusCounts = all<{ status: string; total: number }>(
    "SELECT status, COUNT(*) AS total FROM contents WHERE company_id = ? AND archived_at IS NULL GROUP BY status",
    [companyId]
  );
  const totalAll = statusCounts.reduce((sum, row) => sum + Number(row.total), 0);
  const campaigns = all<{ id: string; name: string }>(
    "SELECT id, name FROM campaigns WHERE company_id = ? AND status IN ('planned','active') ORDER BY name",
    [companyId]
  );
  const members = all<{ id: string; name: string }>(
    "SELECT id, name FROM users WHERE company_id = ? AND status = 'active' ORDER BY name",
    [companyId]
  );
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const baseQuery = new URLSearchParams();
  if (params.q) baseQuery.set("q", params.q);
  if (params.type && params.type !== "all") baseQuery.set("type", params.type);
  if (archived) baseQuery.set("archived", "1");
  const tabHref = (status: string) => {
    const query = new URLSearchParams(baseQuery);
    if (status !== "all") query.set("status", status);
    return `/app/content?${query.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Studio de contenus"
        subtitle="Créez, classez, dupliquez et envoyez vos contenus vers le calendrier éditorial."
        icon="pen"
        actions={
          <Link href={archived ? "/app/content" : "/app/content?archived=1"} className="btn">
            <Icon name="folder" className="h-4 w-4" /> {archived ? "Contenus actifs" : "Archive"}
          </Link>
        }
      />

      <Flash saved={params.saved} error={params.error} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchForm
          action="/app/content"
          placeholder="Rechercher un titre, un texte, un tag…"
          defaultValue={params.q ?? ""}
          hidden={{ ...(params.status && params.status !== "all" ? { status: params.status } : {}), ...(archived ? { archived: "1" } : {}) }}
        />
        <form action="/app/content" method="get" className="flex items-center gap-2">
          {archived ? <input type="hidden" name="archived" value="1" /> : null}
          {params.q ? <input type="hidden" name="q" value={params.q} /> : null}
          <select name="type" defaultValue={params.type ?? "all"} className="input w-auto">
            <option value="all">Tous les types</option>
            {Object.entries(CONTENT_TYPES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <button type="submit" className="btn">Appliquer</button>
        </form>
      </div>

      <Tabs
        items={[
          { label: "Tous", href: tabHref("all"), active: !params.status || params.status === "all", count: totalAll },
          ...Object.entries(CONTENT_STATUSES).map(([key, label]) => ({
            label,
            href: tabHref(key),
            active: params.status === key,
            count: Number(statusCounts.find((row) => row.status === key)?.total ?? 0),
          })),
        ]}
      />

      {user.permissions.includes("content.create") ? (
        <div className="mb-4">
          <Disclosure title="Nouveau contenu" defaultOpen={params.new === "1"}>
            <form action={createContentAction} className="card card-pad grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="label" htmlFor="title">Titre *</label>
                <input id="title" name="title" required className="input" placeholder="Ex. Promotion de fin d'année" />
              </div>
              <div>
                <label className="label" htmlFor="type">Type de contenu</label>
                <select id="type" name="type" className="input">
                  {Object.entries(CONTENT_TYPES).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="tone">Ton rédactionnel</label>
                <select id="tone" name="tone" className="input">
                  <option value="">Non précisé</option>
                  {Object.entries(EDITORIAL_TONES).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="label" htmlFor="body">Contenu</label>
                <textarea id="body" name="body" rows={6} className="input font-[inherit]" placeholder="Rédigez ou collez votre contenu…" />
              </div>
              <div>
                <label className="label" htmlFor="campaignId">Campagne associée</label>
                <select id="campaignId" name="campaignId" className="input">
                  <option value="">Aucune</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="assigneeId">Responsable</label>
                <select id="assigneeId" name="assigneeId" className="input">
                  <option value="">Non affecté</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="scheduledAt">Date de publication (optionnel)</label>
                <input id="scheduledAt" name="scheduledAt" type="datetime-local" className="input" />
                <p className="hint">Si renseignée, le contenu passe automatiquement en « Programmé ».</p>
              </div>
              <div>
                <label className="label" htmlFor="tags">Tags</label>
                <input id="tags" name="tags" className="input" placeholder="promo, produit, saison" />
              </div>
              <div className="md:col-span-2 flex justify-end gap-2">
                <button type="submit" className="btn btn-primary">
                  <Icon name="check" className="h-4 w-4" /> Créer le contenu
                </button>
              </div>
            </form>
          </Disclosure>
        </div>
      ) : null}

      <Card padded={false} className="overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon="pen"
              title={archived ? "Aucun contenu archivé" : "Aucun contenu"}
              description="Créez un contenu depuis le bouton « Nouveau contenu » ou utilisez le Centre IA pour générer une première version."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Contenu</th>
                  <th>Type</th>
                  <th>Statut</th>
                  <th>Campagne</th>
                  <th>Responsable</th>
                  <th>Publication</th>
                  <th>Mise à jour</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="max-w-[280px]">
                      <Link href={`/app/content/${row.id}`} className="block truncate font-medium text-ink-900 hover:text-brand-700">
                        {row.title}
                      </Link>
                      <p className="truncate text-[10.5px] text-ink-400">
                        {row.author ? `Créé par ${row.author}` : "—"}
                        {row.comments > 0 ? ` · ${row.comments} commentaire(s)` : ""}
                        {row.tags ? ` · ${row.tags}` : ""}
                      </p>
                    </td>
                    <td className="whitespace-nowrap text-[12px] text-ink-500">{labelOf(CONTENT_TYPES, row.type)}</td>
                    <td><Badge status={row.status}>{labelOf(CONTENT_STATUSES, row.status)}</Badge></td>
                    <td className="max-w-[160px] truncate text-[12px] text-ink-500">{row.campaign ?? "—"}</td>
                    <td className="whitespace-nowrap text-[12px] text-ink-500">{row.assignee ?? "—"}</td>
                    <td className="whitespace-nowrap text-[12px] text-ink-500">{row.scheduled_at ? formatDateTime(row.scheduled_at) : "—"}</td>
                    <td className="whitespace-nowrap text-[12px] text-ink-400">{formatRelative(row.updated_at)}</td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/app/content/${row.id}`} className="btn btn-sm btn-ghost" title="Ouvrir">
                          <Icon name="eye" className="h-3.5 w-3.5" />
                        </Link>
                        {user.permissions.includes("content.create") ? (
                          <form action={duplicateContentAction}>
                            <input type="hidden" name="id" value={row.id} />
                            <button type="submit" className="btn btn-sm btn-ghost" title="Dupliquer">
                              <Icon name="copy" className="h-3.5 w-3.5" />
                            </button>
                          </form>
                        ) : null}
                        {user.permissions.includes("content.edit") ? (
                          <form action={archiveContentAction}>
                            <input type="hidden" name="id" value={row.id} />
                            <input type="hidden" name="restore" value={archived ? "1" : "0"} />
                            <button type="submit" className="btn btn-sm btn-ghost" title={archived ? "Restaurer" : "Archiver"}>
                              <Icon name={archived ? "refresh" : "folder"} className="h-3.5 w-3.5" />
                            </button>
                          </form>
                        ) : null}
                        {user.permissions.includes("content.delete") ? (
                          <form action={deleteContentAction}>
                            <input type="hidden" name="id" value={row.id} />
                            <ConfirmSubmit />
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 ? (
          <div className="flex items-center justify-between border-t border-ink-100 px-3 py-2 text-[12px] text-ink-500">
            <span>{total} contenu(s) — page {page} / {pages}</span>
            <div className="flex gap-1">
              {page > 1 ? (
                <Link
                  className="btn btn-sm"
                  href={`/app/content?${new URLSearchParams({ ...Object.fromEntries(baseQuery), ...(params.status ? { status: params.status } : {}), page: String(page - 1) }).toString()}`}
                >
                  Précédent
                </Link>
              ) : null}
              {page < pages ? (
                <Link
                  className="btn btn-sm"
                  href={`/app/content?${new URLSearchParams({ ...Object.fromEntries(baseQuery), ...(params.status ? { status: params.status } : {}), page: String(page + 1) }).toString()}`}
                >
                  Suivant
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </Card>
    </>
  );
}
