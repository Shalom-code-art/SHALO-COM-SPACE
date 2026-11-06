import Link from "next/link";
import { ConfirmSubmit, Disclosure } from "@/components/controls";
import { Delta, Donut, DualBars, RankBars } from "@/components/charts";
import { Icon } from "@/components/icons";
import { Alert, Badge, Card, CardHeader, EmptyState, Flash, PageHeader, StatCard } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { all, get } from "@/lib/db";
import { CONTENT_STATUSES, CONTENT_TYPES, PLATFORMS, TASK_STATUSES, formatDate, formatNumber, labelOf } from "@/lib/format";
import { analyticsSummary, resolvePeriod } from "@/lib/reports";
import { SOCIAL_PLATFORMS, type SocialPlatformId } from "@/lib/social";
import { deleteSnapshotAction, saveAudienceSnapshotAction, savePublicationMetricsAction } from "@/server/actions/analytics";

export const metadata = { title: "Analyses & rapports" };

function buildSeries(period: { from: string; to: string }, series: { date: string; created: number; published: number }[]) {
  const map = new Map(series.map((item) => [item.date, item]));
  const start = new Date(`${period.from}T00:00:00Z`);
  const end = new Date(`${period.to}T00:00:00Z`);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);

  if (days <= 31) {
    return Array.from({ length: days }, (_, index) => {
      const date = new Date(start.getTime() + index * 86400000);
      const key = date.toISOString().slice(0, 10);
      const hit = map.get(key);
      return {
        label: `${key.slice(8, 10)}/${key.slice(5, 7)}`,
        a: hit?.created ?? 0,
        b: hit?.published ?? 0,
      };
    });
  }

  const buckets = Math.ceil(days / 7);
  const rows = Array.from({ length: buckets }, (_, index) => ({ label: `S${index + 1}`, a: 0, b: 0 }));
  for (const item of series) {
    const date = new Date(`${item.date}T00:00:00Z`);
    const index = Math.min(buckets - 1, Math.max(0, Math.floor((date.getTime() - start.getTime()) / (7 * 86400000))));
    rows[index].a += item.created;
    rows[index].b += item.published;
  }
  return rows;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; saved?: string; error?: string }>;
}) {
  const user = await requireUser("analytics.view");
  const companyId = user.companyId!;
  const query = await searchParams;
  const period = resolvePeriod(query.from, query.to);
  const summary = analyticsSummary(companyId, period);
  const canManage = user.permissions.includes("analytics.manage");
  const canExport = user.permissions.includes("analytics.export");

  const snapshots = all<{
    id: string;
    platform: string;
    captured_on: string;
    followers: number | null;
    reach: number | null;
    impressions: number | null;
    engagement: number | null;
    posts_published: number | null;
    source: string;
    author: string | null;
  }>(
    `SELECT s.id, s.platform, s.captured_on, s.followers, s.reach, s.impressions, s.engagement, s.posts_published,
            s.source, u.name AS author
     FROM analytics_snapshots s LEFT JOIN users u ON u.id = s.created_by
     WHERE s.company_id = ? ORDER BY s.captured_on DESC, s.created_at DESC LIMIT 20`,
    [companyId]
  );

  const publications = all<{ id: string; title: string; platform: string; published_at: string | null }>(
    `SELECT p.id, c.title, p.platform, p.published_at
     FROM publications p JOIN contents c ON c.id = p.content_id
     WHERE p.company_id = ? AND p.status = 'published'
     ORDER BY p.published_at DESC LIMIT 50`,
    [companyId]
  );

  const tasks = all<{ status: string; total: number }>(
    "SELECT status, COUNT(*) AS total FROM tasks WHERE company_id = ? GROUP BY status",
    [companyId]
  );

  const series = buildSeries(period, summary.series);
  const exportQuery = `from=${period.from}&to=${period.to}`;

  return (
    <>
      <PageHeader
        title="Analyses & rapports"
        subtitle="Indicateurs calculés à partir des données réelles de l'entreprise. Aucun chiffre n'est estimé ni inventé."
        icon="chart"
        actions={
          <>
            {canExport ? (
              <Link href={`/api/v1/reports/export?${exportQuery}`} className="btn" prefetch={false}>
                <Icon name="download" className="h-4 w-4" /> Export CSV
              </Link>
            ) : null}
            {canExport ? (
              <Link href={`/api/v1/reports/pdf?${exportQuery}`} className="btn btn-primary" prefetch={false}>
                <Icon name="file" className="h-4 w-4" /> Rapport PDF
              </Link>
            ) : null}
          </>
        }
      />

      <Flash saved={query.saved} error={query.error} />

      <Card className="mb-4">
        <form method="get" action="/app/analytics" className="flex flex-wrap items-end gap-2">
          <div>
            <label className="label" htmlFor="from">Du</label>
            <input id="from" name="from" type="date" defaultValue={period.from} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="to">Au</label>
            <input id="to" name="to" type="date" defaultValue={period.to} className="input" />
          </div>
          <button type="submit" className="btn btn-primary">
            <Icon name="filter" className="h-4 w-4" /> Actualiser
          </button>
          <p className="ml-auto text-[11.5px] text-ink-400">Période analysée : {period.label}</p>
        </form>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card card-pad animate-rise">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Contenus créés</p>
          <p className="kpi-value mt-2">{formatNumber(summary.current.contentsCreated)}</p>
          <Delta current={summary.current.contentsCreated} previous={summary.previous.contentsCreated} />
        </div>
        <div className="card card-pad animate-rise">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Contenus publiés</p>
          <p className="kpi-value mt-2">{formatNumber(summary.current.contentsPublished)}</p>
          <Delta current={summary.current.contentsPublished} previous={summary.previous.contentsPublished} />
        </div>
        <div className="card card-pad animate-rise">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Contacts ajoutés</p>
          <p className="kpi-value mt-2">{formatNumber(summary.current.contactsAdded)}</p>
          <Delta current={summary.current.contactsAdded} previous={summary.previous.contactsAdded} />
        </div>
        <div className="card card-pad animate-rise">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Interactions clients</p>
          <p className="kpi-value mt-2">{formatNumber(summary.current.interactions)}</p>
          <Delta current={summary.current.interactions} previous={summary.previous.interactions} />
        </div>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="Production éditoriale" subtitle="Contenus créés et publiés sur la période" icon="chart" />
          <DualBars items={series} firstLabel="Créés" secondLabel="Publiés" />
        </Card>
        <Card>
          <CardHeader title="Répartition des contenus" subtitle="Tous statuts confondus" icon="layers" />
          <Donut
            items={summary.contentsByStatus.map((row) => ({
              label: labelOf(CONTENT_STATUSES, row.status),
              value: Number(row.total),
            }))}
          />
        </Card>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader title="Types de contenus" icon="pen" />
          <RankBars
            items={summary.contentsByType.slice(0, 6).map((row) => ({
              label: labelOf(CONTENT_TYPES, row.type),
              value: Number(row.total),
            }))}
          />
        </Card>
        <Card>
          <CardHeader title="Publications par réseau" subtitle="Période analysée" icon="share" />
          <RankBars
            items={summary.platformActivity.map((row) => ({ label: labelOf(PLATFORMS, row.platform), value: Number(row.total) }))}
            tone="accent"
          />
        </Card>
        <Card>
          <CardHeader title="Tâches de l'équipe" subtitle="État courant" icon="check-circle" />
          <RankBars items={tasks.map((row) => ({ label: labelOf(TASK_STATUSES, row.status), value: Number(row.total) }))} />
        </Card>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader title="Audience par plateforme" subtitle="Dernier relevé enregistré" icon="users" />
          {summary.audienceByPlatform.length === 0 ? (
            <EmptyState
              icon="users"
              title="Aucun relevé d'audience"
              description="Saisissez vos chiffres réels depuis les statistiques officielles de chaque réseau, ou connectez une API pour une synchronisation automatique."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Plateforme</th>
                    <th>Abonnés</th>
                    <th>Relevé</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.audienceByPlatform.map((row) => (
                    <tr key={row.platform}>
                      <td className="text-[12.5px] font-medium text-ink-800">
                        {SOCIAL_PLATFORMS[row.platform as SocialPlatformId]?.label ?? labelOf(PLATFORMS, row.platform)}
                      </td>
                      <td className="text-[12.5px] text-ink-700">{formatNumber(row.followers)}</td>
                      <td className="text-[11.5px] text-ink-500">{formatDate(row.capturedOn)}</td>
                      <td>
                        <Badge status={row.source === "api" ? "connected" : "planned"}>{row.source === "api" ? "API" : "Manuelle"}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-ink-50 px-2 py-2">
              <p className="text-[10px] uppercase tracking-wide text-ink-400">Portée</p>
              <p className="text-[13px] font-semibold text-ink-800">{formatNumber(summary.current.reach)}</p>
            </div>
            <div className="rounded-xl bg-ink-50 px-2 py-2">
              <p className="text-[10px] uppercase tracking-wide text-ink-400">Impressions</p>
              <p className="text-[13px] font-semibold text-ink-800">{formatNumber(summary.current.impressions)}</p>
            </div>
            <div className="rounded-xl bg-ink-50 px-2 py-2">
              <p className="text-[10px] uppercase tracking-wide text-ink-400">Engagement</p>
              <p className="text-[13px] font-semibold text-ink-800">{formatNumber(summary.current.engagement)}</p>
            </div>
          </div>
          <p className="hint">Les mesures proviennent des relevés saisis ({summary.snapshotCount} relevé(s) sur la période) ou d&apos;une synchronisation API connectée.</p>
        </Card>

        <Card>
          <CardHeader title="Contenus les plus performants" subtitle="Selon l'engagement relevé" icon="star" />
          {summary.topContents.length === 0 ? (
            <p className="text-[12px] text-ink-500">
              Aucune mesure de performance enregistrée sur la période. Renseignez les mesures d&apos;une publication publiée pour alimenter ce classement.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Contenu</th>
                    <th>Réseau</th>
                    <th>Portée</th>
                    <th>Engagement</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.topContents.map((item) => (
                    <tr key={`${item.id}-${item.platform}`}>
                      <td>
                        <Link href={`/app/content/${item.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                          {item.title}
                        </Link>
                        <p className="text-[10.5px] text-ink-400">{item.publishedAt ? formatDate(item.publishedAt) : "non publié"}</p>
                      </td>
                      <td className="text-[11.5px] text-ink-600">{labelOf(PLATFORMS, item.platform)}</td>
                      <td className="text-[11.5px] text-ink-600">{formatNumber(item.reach)}</td>
                      <td className="text-[11.5px] font-medium text-ink-800">{formatNumber(item.engagement)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <StatCard label="Campagnes actives" value={summary.campaignSummary.active} icon="megaphone" tone="accent" />
            <StatCard label="Comptes connectés" value={`${summary.accountsConnected}/${summary.accountsTotal}`} icon="share" tone="brand" />
          </div>
        </Card>
      </div>

      {canManage ? (
        <div className="mt-4 flex flex-wrap items-start gap-2">
          <Disclosure title="Saisir un relevé d'audience">
            <form action={saveAudienceSnapshotAction} className="card card-pad grid gap-3 md:grid-cols-3">
              <div>
                <label className="label" htmlFor="platform">Plateforme *</label>
                <select id="platform" name="platform" className="input" required defaultValue="facebook">
                  {Object.keys(SOCIAL_PLATFORMS).map((platform) => (
                    <option key={platform} value={platform}>
                      {SOCIAL_PLATFORMS[platform as SocialPlatformId].label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="capturedOn">Date du relevé</label>
                <input id="capturedOn" name="capturedOn" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="followers">Abonnés</label>
                <input id="followers" name="followers" type="number" min="0" defaultValue={0} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="reach">Portée</label>
                <input id="reach" name="reach" type="number" min="0" defaultValue={0} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="impressions">Impressions</label>
                <input id="impressions" name="impressions" type="number" min="0" defaultValue={0} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="engagement">Engagement</label>
                <input id="engagement" name="engagement" type="number" min="0" defaultValue={0} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="postsPublished">Publications sur la période</label>
                <input id="postsPublished" name="postsPublished" type="number" min="0" defaultValue={0} className="input" />
              </div>
              <div className="md:col-span-3 flex justify-end">
                <button type="submit" className="btn btn-primary">
                  <Icon name="check" className="h-4 w-4" /> Enregistrer le relevé
                </button>
              </div>
            </form>
          </Disclosure>

          <Disclosure title="Mesures d'une publication" variant="ghost">
            <form action={savePublicationMetricsAction} className="card card-pad grid gap-3 md:grid-cols-3">
              <div className="md:col-span-3">
                <label className="label" htmlFor="publicationId">Publication *</label>
                <select id="publicationId" name="publicationId" className="input" required>
                  <option value="">Sélectionner une publication déclarée</option>
                  {publications.map((publication) => (
                    <option key={publication.id} value={publication.id}>
                      {publication.title} — {labelOf(PLATFORMS, publication.platform)} ({publication.published_at ? formatDate(publication.published_at) : "date inconnue"})
                    </option>
                  ))}
                </select>
                {publications.length === 0 ? (
                  <p className="hint">Aucune publication déclarée : marquez d&apos;abord un contenu comme publié.</p>
                ) : null}
              </div>
              <div>
                <label className="label" htmlFor="m-impressions">Impressions</label>
                <input id="m-impressions" name="impressions" type="number" min="0" defaultValue={0} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="m-reach">Portée</label>
                <input id="m-reach" name="reach" type="number" min="0" defaultValue={0} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="m-engagement">Engagement</label>
                <input id="m-engagement" name="engagement" type="number" min="0" defaultValue={0} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="m-clicks">Clics</label>
                <input id="m-clicks" name="clicks" type="number" min="0" defaultValue={0} className="input" />
              </div>
              <div className="md:col-span-3 flex justify-end">
                <button type="submit" className="btn btn-primary">
                  <Icon name="check" className="h-4 w-4" /> Enregistrer les mesures
                </button>
              </div>
            </form>
          </Disclosure>
        </div>
      ) : null}

      <Card className="mt-4">
        <CardHeader title="Historique des relevés" subtitle="Traçabilité des données saisies" icon="clock" />
        {snapshots.length === 0 ? (
          <p className="text-[12px] text-ink-500">Aucun relevé enregistré pour le moment.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Plateforme</th>
                  <th>Abonnés</th>
                  <th>Portée</th>
                  <th>Impressions</th>
                  <th>Engagement</th>
                  <th>Saisi par</th>
                  {canManage ? <th className="text-right">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {snapshots.map((snapshot) => (
                  <tr key={snapshot.id}>
                    <td className="text-[11.5px] text-ink-600">{formatDate(snapshot.captured_on)}</td>
                    <td className="text-[12px] font-medium text-ink-800">
                      {SOCIAL_PLATFORMS[snapshot.platform as SocialPlatformId]?.label ?? snapshot.platform}
                    </td>
                    <td className="text-[11.5px] text-ink-600">{formatNumber(snapshot.followers)}</td>
                    <td className="text-[11.5px] text-ink-600">{formatNumber(snapshot.reach)}</td>
                    <td className="text-[11.5px] text-ink-600">{formatNumber(snapshot.impressions)}</td>
                    <td className="text-[11.5px] text-ink-600">{formatNumber(snapshot.engagement)}</td>
                    <td className="text-[11px] text-ink-400">{snapshot.author ?? "—"}</td>
                    {canManage ? (
                      <td>
                        <form action={deleteSnapshotAction} className="flex justify-end">
                          <input type="hidden" name="id" value={snapshot.id} />
                          <ConfirmSubmit message="Supprimer ce relevé ?">Supprimer</ConfirmSubmit>
                        </form>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-3">
        <Alert tone="info" title="Méthodologie">
          <ul className="ml-1 list-disc space-y-1 pl-4">
            {summary.dataNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
            <li>Les exports CSV et PDF reprennent exactement les valeurs affichées ici, sans arrondi supplémentaire.</li>
          </ul>
        </Alert>
      </div>

      <p className="mt-3 text-[11px] text-ink-400">
        Besoin d&apos;un indicateur supplémentaire ? BATIANA TECH peut ajouter une source officielle (API réseau, CRM, facturation) sans modifier vos données existantes.
      </p>
    </>
  );
}
