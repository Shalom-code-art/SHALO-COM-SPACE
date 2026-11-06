import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmSubmit, CopyButton } from "@/components/controls";
import { Icon } from "@/components/icons";
import { Alert, Badge, Card, CardHeader, Flash, InfoRow, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { all, get } from "@/lib/db";
import {
  CONTENT_STATUSES,
  CONTENT_TYPES,
  EDITORIAL_TONES,
  PLATFORMS,
  formatDateTime,
  formatRelative,
  labelOf,
} from "@/lib/format";
import {
  addContentCommentAction,
  archiveContentAction,
  attachMediaAction,
  deleteContentAction,
  detachMediaAction,
  duplicateContentAction,
  scheduleContentAction,
  setContentStatusAction,
  updateContentAction,
} from "@/server/actions/content";

export const metadata = { title: "Contenu" };

export default async function ContentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const user = await requireUser("content.view");
  const companyId = user.companyId!;
  const { id } = await params;
  const query = await searchParams;

  const content = get<{
    id: string;
    title: string;
    body: string;
    type: string;
    tone: string | null;
    status: string;
    tags: string | null;
    campaign_id: string | null;
    assignee_id: string | null;
    author_id: string | null;
    scheduled_at: string | null;
    published_at: string | null;
    created_at: string;
    updated_at: string;
    archived_at: string | null;
    source: string;
    campaign_name: string | null;
    author_name: string | null;
    assignee_name: string | null;
  }>(
    `SELECT c.*, cp.name AS campaign_name, au.name AS author_name, a.name AS assignee_name
     FROM contents c
     LEFT JOIN campaigns cp ON cp.id = c.campaign_id
     LEFT JOIN users au ON au.id = c.author_id
     LEFT JOIN users a ON a.id = c.assignee_id
     WHERE c.id = ? AND c.company_id = ?`,
    [id, companyId]
  );
  if (!content) notFound();

  const campaigns = all<{ id: string; name: string }>(
    "SELECT id, name FROM campaigns WHERE company_id = ? ORDER BY name",
    [companyId]
  );
  const members = all<{ id: string; name: string }>(
    "SELECT id, name FROM users WHERE company_id = ? AND status = 'active' ORDER BY name",
    [companyId]
  );
  const accounts = all<{ id: string; platform: string; account_name: string; status: string }>(
    "SELECT id, platform, account_name, status FROM social_accounts WHERE company_id = ? ORDER BY platform",
    [companyId]
  );
  const attachments = all<{ id: string; name: string; mime: string; kind: string; size_bytes: number }>(
    `SELECT m.id, m.name, m.mime, m.kind, m.size_bytes
     FROM content_media cm JOIN media m ON m.id = cm.media_id
     WHERE cm.content_id = ? AND m.company_id = ?`,
    [id, companyId]
  );
  const library = all<{ id: string; name: string; kind: string }>(
    "SELECT id, name, kind FROM media WHERE company_id = ? ORDER BY created_at DESC LIMIT 40",
    [companyId]
  );
  const comments = all<{ id: string; body: string; created_at: string; author: string | null }>(
    `SELECT cc.id, cc.body, cc.created_at, u.name AS author
     FROM content_comments cc LEFT JOIN users u ON u.id = cc.author_id
     WHERE cc.content_id = ? ORDER BY cc.created_at DESC`,
    [id]
  );
  const revisions = all<{ id: string; title: string; body: string; created_at: string; author: string | null }>(
    `SELECT r.id, r.title, r.body, r.created_at, u.name AS author
     FROM content_revisions r LEFT JOIN users u ON u.id = r.author_id
     WHERE r.content_id = ? ORDER BY r.created_at DESC LIMIT 5`,
    [id]
  );
  const publications = all<{ id: string; platform: string; status: string; method: string; scheduled_at: string | null; published_at: string | null; error: string | null; account: string | null }>(
    `SELECT p.id, p.platform, p.status, p.method, p.scheduled_at, p.published_at, p.error, s.account_name AS account
     FROM publications p LEFT JOIN social_accounts s ON s.id = p.social_account_id
     WHERE p.content_id = ? ORDER BY p.created_at DESC`,
    [id]
  );

  const canEdit = user.permissions.includes("content.edit");
  const canPublish = user.permissions.includes("content.publish");
  const canApprove = user.permissions.includes("content.approve");

  return (
    <>
      <PageHeader
        title={content.title}
        subtitle={`${labelOf(CONTENT_TYPES, content.type)} · créé le ${formatDateTime(content.created_at)}${
          content.source === "ai" ? " · généré avec l’assistance IA" : ""
        }`}
        icon="pen"
        actions={
          <>
            <Link href="/app/content" className="btn">
              <Icon name="arrow-right" className="h-4 w-4 rotate-180" /> Retour
            </Link>
            <CopyButton text={content.body} label="Copier le texte" />
            {user.permissions.includes("content.create") ? (
              <form action={duplicateContentAction}>
                <input type="hidden" name="id" value={content.id} />
                <button type="submit" className="btn">
                  <Icon name="copy" className="h-4 w-4" /> Dupliquer
                </button>
              </form>
            ) : null}
            {canEdit ? (
              <form action={archiveContentAction}>
                <input type="hidden" name="id" value={content.id} />
                <input type="hidden" name="restore" value={content.archived_at ? "1" : "0"} />
                <button type="submit" className="btn">
                  <Icon name="folder" className="h-4 w-4" /> {content.archived_at ? "Restaurer" : "Archiver"}
                </button>
              </form>
            ) : null}
            {user.permissions.includes("content.delete") ? (
              <form action={deleteContentAction}>
                <input type="hidden" name="id" value={content.id} />
                <ConfirmSubmit>Supprimer</ConfirmSubmit>
              </form>
            ) : null}
          </>
        }
      />

      <Flash saved={query.saved} error={query.error} />
      {content.archived_at ? (
        <div className="mb-4">
          <Alert tone="warning">Ce contenu est archivé. Restaurez-le pour le réintégrer au studio et au calendrier.</Alert>
        </div>
      ) : null}

      <div className="grid gap-3 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-3">
          <Card>
            <CardHeader title="Édition du contenu" subtitle="Toutes les modifications sont enregistrées en base" icon="pen" />
            {canEdit ? (
              <form action={updateContentAction} className="grid gap-3 md:grid-cols-2">
                <input type="hidden" name="id" value={content.id} />
                <div className="md:col-span-2">
                  <label className="label" htmlFor="title">Titre</label>
                  <input id="title" name="title" required defaultValue={content.title} className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="type">Type</label>
                  <select id="type" name="type" defaultValue={content.type} className="input">
                    {Object.entries(CONTENT_TYPES).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="tone">Ton</label>
                  <select id="tone" name="tone" defaultValue={content.tone ?? ""} className="input">
                    <option value="">Non précisé</option>
                    {Object.entries(EDITORIAL_TONES).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="label" htmlFor="body">Contenu</label>
                  <textarea id="body" name="body" rows={12} defaultValue={content.body} className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="campaignId">Campagne</label>
                  <select id="campaignId" name="campaignId" defaultValue={content.campaign_id ?? ""} className="input">
                    <option value="">Aucune</option>
                    {campaigns.map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="assigneeId">Responsable</label>
                  <select id="assigneeId" name="assigneeId" defaultValue={content.assignee_id ?? ""} className="input">
                    <option value="">Non affecté</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>{member.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="scheduledAt">Date de publication</label>
                  <input
                    id="scheduledAt"
                    name="scheduledAt"
                    type="datetime-local"
                    defaultValue={content.scheduled_at ? content.scheduled_at.slice(0, 16) : ""}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="status">Statut</label>
                  {canPublish ? (
                    <select id="status" name="status" defaultValue={content.status} className="input">
                      {Object.entries(CONTENT_STATUSES).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  ) : (
                    <>
                      <input type="hidden" name="status" value={content.status} />
                      <p className="input bg-ink-50 text-ink-500">{labelOf(CONTENT_STATUSES, content.status)}</p>
                      <p className="hint">Seuls les rôles autorisés peuvent modifier le statut.</p>
                    </>
                  )}
                </div>
                <div>
                  <label className="label" htmlFor="tags">Tags</label>
                  <input id="tags" name="tags" defaultValue={content.tags ?? ""} className="input" />
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <button type="submit" className="btn btn-primary">
                    <Icon name="check" className="h-4 w-4" /> Enregistrer
                  </button>
                </div>
              </form>
            ) : (
              <pre className="whitespace-pre-wrap rounded-xl bg-ink-50 p-4 text-[12.5px] leading-relaxed text-ink-800">
                {content.body || "Aucun contenu rédigé."}
              </pre>
            )}
          </Card>

          <Card>
            <CardHeader title="Commentaires internes" subtitle="Échanges de l'équipe sur ce contenu" icon="message" />
            <form action={addContentCommentAction} className="mb-4 flex flex-col gap-2 sm:flex-row">
              <input type="hidden" name="contentId" value={content.id} />
              <input name="body" required className="input" placeholder="Ajouter un commentaire…" />
              <button type="submit" className="btn btn-primary shrink-0">
                <Icon name="send" className="h-4 w-4" /> Publier
              </button>
            </form>
            {comments.length === 0 ? (
              <p className="text-[12px] text-ink-500">Aucun commentaire.</p>
            ) : (
              <ul className="space-y-3">
                {comments.map((comment) => (
                  <li key={comment.id} className="rounded-xl border border-ink-100 px-3 py-2">
                    <p className="text-[12.5px] text-ink-800">{comment.body}</p>
                    <p className="mt-1 text-[10.5px] text-ink-400">
                      {comment.author ?? "—"} · {formatRelative(comment.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Historique des versions" subtitle="5 dernières versions enregistrées" icon="layers" />
            {revisions.length === 0 ? (
              <p className="text-[12px] text-ink-500">Aucune version enregistrée.</p>
            ) : (
              <ul className="space-y-2">
                {revisions.map((revision) => (
                  <li key={revision.id} className="rounded-xl border border-ink-100 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[12.5px] font-medium text-ink-800">{revision.title}</p>
                      <span className="whitespace-nowrap text-[10.5px] text-ink-400">{formatDateTime(revision.created_at)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11.5px] text-ink-500">{revision.body.slice(0, 220)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-3">
          <Card>
            <CardHeader title="Workflow éditorial" subtitle="Validation, programmation et publication" icon="check-circle" />
            <div className="mb-3 flex flex-wrap gap-1.5">
              {canEdit ? (
                <form action={setContentStatusAction}>
                  <input type="hidden" name="id" value={content.id} />
                  <input type="hidden" name="status" value="in_review" />
                  <button type="submit" className="btn btn-sm">Soumettre à validation</button>
                </form>
              ) : null}
              {canApprove ? (
                <form action={setContentStatusAction}>
                  <input type="hidden" name="id" value={content.id} />
                  <input type="hidden" name="status" value="approved" />
                  <button type="submit" className="btn btn-sm">Approuver</button>
                </form>
              ) : null}
              {canPublish ? (
                <>
                  <form action={setContentStatusAction}>
                    <input type="hidden" name="id" value={content.id} />
                    <input type="hidden" name="status" value="published" />
                    <button type="submit" className="btn btn-sm btn-accent">Marquer publié (manuel)</button>
                  </form>
                  <form action={setContentStatusAction}>
                    <input type="hidden" name="id" value={content.id} />
                    <input type="hidden" name="status" value="cancelled" />
                    <button type="submit" className="btn btn-sm btn-ghost">Annuler</button>
                  </form>
                </>
              ) : null}
            </div>

            {canPublish ? (
              <form action={scheduleContentAction} className="space-y-2 border-t border-ink-100 pt-3">
                <input type="hidden" name="id" value={content.id} />
                <label className="label" htmlFor="scheduleAt">Programmer la publication</label>
                <input
                  id="scheduleAt"
                  name="scheduledAt"
                  type="datetime-local"
                  required
                  defaultValue={content.scheduled_at ? content.scheduled_at.slice(0, 16) : ""}
                  className="input"
                />
                {accounts.length > 0 ? (
                  <div className="rounded-xl border border-ink-100 p-2">
                    <p className="mb-1.5 text-[11px] font-medium text-ink-600">Comptes destinataires</p>
                    <div className="space-y-1">
                      {accounts.map((account) => (
                        <label key={account.id} className="flex items-center gap-2 text-[12px] text-ink-700">
                          <input type="checkbox" name="socialAccountIds" value={account.id} className="h-3.5 w-3.5" />
                          {labelOf(PLATFORMS, account.platform)} — {account.account_name}
                          <span className={`badge ${account.status === "connected" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-ink-200 bg-ink-50 text-ink-500"}`}>
                            {account.status === "connected" ? "connecté" : "manuel"}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="hint">Aucun compte social déclaré. La programmation reste interne au calendrier.</p>
                )}
                <button type="submit" className="btn btn-primary w-full btn-sm">Programmer</button>
                <p className="hint">
                  Aucune publication automatique n'est effectuée : sans intégration API officielle configurée, la
                  programmation génère un rappel et une procédure manuelle.
                </p>
              </form>
            ) : null}
          </Card>

          <Card>
            <CardHeader title="Informations" subtitle="Métadonnées du contenu" icon="file" />
            <InfoRow label="Statut" value={<Badge status={content.status}>{labelOf(CONTENT_STATUSES, content.status)}</Badge>} />
            <InfoRow label="Auteur" value={content.author_name ?? "—"} />
            <InfoRow label="Responsable" value={content.assignee_name ?? "Non affecté"} />
            <InfoRow label="Campagne" value={content.campaign_name ?? "Aucune"} />
            <InfoRow label="Programmé" value={content.scheduled_at ? formatDateTime(content.scheduled_at) : "—"} />
            <InfoRow label="Publié" value={content.published_at ? formatDateTime(content.published_at) : "—"} />
            <InfoRow label="Dernière mise à jour" value={formatRelative(content.updated_at)} />
          </Card>

          <Card>
            <CardHeader title="Publications associées" subtitle="Suivi des envois par plateforme" icon="share" />
            {publications.length === 0 ? (
              <p className="text-[12px] text-ink-500">Aucune publication préparée.</p>
            ) : (
              <ul className="space-y-2">
                {publications.map((publication) => (
                  <li key={publication.id} className="rounded-xl border border-ink-100 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[12.5px] font-medium text-ink-800">
                        {labelOf(PLATFORMS, publication.platform)} · {publication.account ?? "compte supprimé"}
                      </p>
                      <Badge status={publication.status === "queued" ? "scheduled" : publication.status}>
                        {publication.status === "queued" ? "En file" : publication.status}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-[10.5px] text-ink-400">
                      {publication.method === "manual" ? "Procédure manuelle" : "Via API officielle"}
                      {publication.scheduled_at ? ` · ${formatDateTime(publication.scheduled_at)}` : ""}
                      {publication.published_at ? ` · publié ${formatDateTime(publication.published_at)}` : ""}
                    </p>
                    {publication.error ? <p className="text-[10.5px] text-rose-600">{publication.error}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Fichiers associés" subtitle="Visuels et supports liés au contenu" icon="folder" />
            {attachments.length === 0 ? (
              <p className="mb-3 text-[12px] text-ink-500">Aucun fichier associé.</p>
            ) : (
              <ul className="mb-3 space-y-1.5">
                {attachments.map((file) => (
                  <li key={file.id} className="flex items-center justify-between gap-2 rounded-lg border border-ink-100 px-2.5 py-1.5">
                    <a href={`/api/v1/media/${file.id}/raw`} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 text-[12px] text-brand-700 hover:underline">
                      <Icon name={file.kind === "image" ? "image" : "file"} className="h-3.5 w-3.5" />
                      <span className="truncate">{file.name}</span>
                    </a>
                    {canEdit ? (
                      <form action={detachMediaAction}>
                        <input type="hidden" name="contentId" value={content.id} />
                        <input type="hidden" name="mediaId" value={file.id} />
                        <button type="submit" className="text-ink-400 hover:text-rose-600" title="Retirer">
                          <Icon name="close" className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {canEdit && library.length > 0 ? (
              <form action={attachMediaAction} className="flex gap-2">
                <input type="hidden" name="contentId" value={content.id} />
                <select name="mediaId" className="input" required>
                  <option value="">Choisir un fichier…</option>
                  {library.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
                <button type="submit" className="btn btn-sm shrink-0">Associer</button>
              </form>
            ) : (
              <p className="hint">Importez des fichiers depuis la médiathèque pour les associer.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
