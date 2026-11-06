import Link from "next/link";
import { Delta, Donut, DualBars, RankBars } from "@/components/charts";
import { Icon } from "@/components/icons";
import { Alert, Badge, Card, CardHeader, EmptyState, Flash, PageHeader, StatCard } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { all, count } from "@/lib/db";
import {
  CAMPAIGN_STATUSES,
  CONTENT_STATUSES,
  CONTENT_TYPES,
  PLATFORMS,
  formatDate,
  formatDateTime,
  formatRelative,
  labelOf,
} from "@/lib/format";
import { resolveAiConfig } from "@/lib/settings";
import { analyticsSummary, resolvePeriod } from "@/lib/reports";

export const metadata = { title: "Tableau de bord" };

const DAYS = 14;

function dayLabel(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string; saved?: string; error?: string }>;
}) {
  const user = await requireUser("dashboard.view");
  const params = await searchParams;
  const companyId = user.companyId!;
  const period = resolvePeriod(null, null);
  const summary = analyticsSummary(companyId, period);
  const ai = resolveAiConfig(companyId);

  const todayIso = new Date().toISOString();
  const series: { label: string; a: number; b: number }[] = [];
  for (let index = DAYS - 1; index >= 0; index -= 1) {
    const day = new Date(Date.now() - index * 86400000).toISOString().slice(0, 10);
    const row = summary.series.find((item) => item.date === day);
    series.push({ label: dayLabel(day), a: Number(row?.created ?? 0), b: Number(row?.published ?? 0) });
  }

  const pendingContents = all<{
    id: string;
    title: string;
    type: string;
    status: string;
    scheduled_at: string | null;
    updated_at: string;
    assignee: string | null;
  }>(
    `SELECT c.id, c.title, c.type, c.status, c.scheduled_at, c.updated_at, u.name AS assignee
     FROM contents c LEFT JOIN users u ON u.id = c.assignee_id
     WHERE c.company_id = ? AND c.archived_at IS NULL AND c.status IN ('draft','in_progress','in_review','approved')
     ORDER BY c.updated_at DESC LIMIT 5`,
    [companyId]
  );

  const upcoming = all<{ id: string; title: string; scheduled_at: string; platform: string | null }>(
    `SELECT c.id, c.title, c.scheduled_at, s.platform
     FROM contents c LEFT JOIN social_accounts s ON s.id = c.social_account_id
     WHERE c.company_id = ? AND c.scheduled_at IS NOT NULL AND c.scheduled_at >= ?
     ORDER BY c.scheduled_at ASC LIMIT 4`,
    [companyId, todayIso]
  );

  const campaigns = all<{
    id: string;
    name: string;
    status: string;
    type: string;
    end_date: string | null;
    budget_cents: number;
    currency: string;
  }>(
    `SELECT id, name, status, type, end_date, budget_cents, currency FROM campaigns
     WHERE company_id = ? AND status IN ('active','planned') ORDER BY start_date ASC LIMIT 4`,
    [companyId]
  );

  const recentContents = all<{ id: string; title: string; type: string; status: string; created_at: string; author: string | null }>(
    `SELECT c.id, c.title, c.type, c.status, c.created_at, u.name AS author
     FROM contents c LEFT JOIN users u ON u.id = c.author_id
     WHERE c.company_id = ? AND c.archived_at IS NULL ORDER BY c.created_at DESC LIMIT 5`,
    [companyId]
  );

  const recentContacts = all<{ id: string; name: string; category: string | null; company_name: string | null; created_at: string; whatsapp: string | null }>(
    `SELECT id, name, category, company_name, created_at, whatsapp FROM contacts
     WHERE company_id = ? AND kind = 'client' ORDER BY created_at DESC LIMIT 4`,
    [companyId]
  );

  const activity = all<{ id: string; actor_name: string; action: string; entity: string; created_at: string; details: string | null }>(
    `SELECT id, actor_name, action, entity, created_at, details FROM audit_logs
     WHERE company_id = ? ORDER BY created_at DESC LIMIT 6`,
    [companyId]
  );

  const myTasks = all<{ id: string; title: string; due_date: string | null; status: string; priority: string }>(
    `SELECT id, title, due_date, status, priority FROM tasks
     WHERE company_id = ? AND assignee_id = ? AND status <> 'done' ORDER BY COALESCE(due_date, '9999') ASC LIMIT 4`,
    [companyId, user.id]
  );

  const totals = {
    contents: count("SELECT COUNT(*) AS n FROM contents WHERE company_id = ? AND archived_at IS NULL", [companyId]),
    contacts: count("SELECT COUNT(*) AS n FROM contacts WHERE company_id = ? AND kind = 'client'", [companyId]),
    campaigns: count("SELECT COUNT(*) AS n FROM campaigns WHERE company_id = ?", [companyId]),
    accounts: count("SELECT COUNT(*) AS n FROM social_accounts WHERE company_id = ?", [companyId]),
  };

  const onboarding = [
    { done: totals.contents > 0, label: "Créer un premier contenu", href: "/app/content", icon: "pen" },
    { done: ai.configured, label: "Configurer le fournisseur IA", href: "/app/settings/ai", icon: "sparkles" },
    { done: totals.accounts > 0, label: "Déclarer vos comptes sociaux", href: "/app/social", icon: "share" },
    { done: totals.contacts > 0, label: "Ajouter un contact client", href: "/app/contacts", icon: "users" },
    { done: totals.campaigns > 0, label: "Créer une campagne", href: "/app/campaigns", icon: "megaphone" },
  ];
  const onboardingDone = onboarding.filter((item) => item.done).length;

  return (
    <>
      <PageHeader
        title={`Bonjour ${user.name.split(" ")[0]}`}
        subtitle={`Vue d'ensemble de la communication de ${user.company?.name} · période ${period.label}`}
        icon="dashboard"
        actions={
          <>
            <Link href="/app/ai" className="btn">
              <Icon name="sparkles" className="h-4 w-4" /> Centre IA
            </Link>
            {user.permissions.includes("content.create") ? (
              <Link href="/app/content?new=1" className="btn btn-primary">
                <Icon name="plus" className="h-4 w-4" /> Nouveau contenu
              </Link>
            ) : null}
          </>
        }
      />

      <Flash saved={params.saved} error={params.error} />
      {params.denied ? (
        <div className="mb-4">
          <Alert tone="warning" title="Accès refusé">
            Votre rôle ne dispose pas de la permission « {params.denied} ». Contactez l'administrateur de
            l'espace pour ajuster vos permissions.
          </Alert>
        </div>
      ) : null}
      {!ai.configured ? (
        <div className="mb-4">
          <Alert tone="warning" title="Centre IA non configuré">
            Aucune clé fournisseur n'est enregistrée pour cet espace. La génération de contenus restera
            indisponible jusqu'à la configuration d'un fournisseur.{" "}
            <Link href="/app/settings/ai" className="font-semibold underline">
              Configurer maintenant
            </Link>
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Contenus publiés (30 j)"
          value={summary.current.contentsPublished}
          icon="pen"
          tone="brand"
          trend={{ value: summary.previous.contentsPublished ? Math.round(((summary.current.contentsPublished - summary.previous.contentsPublished) / summary.previous.contentsPublished) * 100) : 0 }}
          hint={`${totals.contents} contenus au total`}
        />
        <StatCard
          label="Campagnes actives"
          value={summary.campaignSummary.active}
          icon="megaphone"
          tone="accent"
          hint={`${summary.campaignSummary.total} campagnes enregistrées`}
        />
        <StatCard
          label="Contenus en attente"
          value={pendingContents.filter((item) => ["draft", "in_progress", "in_review", "approved"].includes(item.status)).length}
          icon="clock"
          tone="violet"
          hint={`${summary.current.contentsScheduled} programmés`}
        />
        <StatCard
          label="Contacts clients"
          value={totals.contacts}
          icon="users"
          tone="emerald"
          trend={{ value: summary.previous.contactsAdded ? Math.round(((summary.current.contactsAdded - summary.previous.contactsAdded) / summary.previous.contactsAdded) * 100) : 0 }}
          hint={`+${summary.current.contactsAdded} sur la période`}
        />
      </div>

      {onboardingDone < onboarding.length ? (
        <Card className="mt-3 border-brand-200 bg-brand-50/40">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[13px] font-semibold text-brand-900">
                Mise en route de votre espace — {onboardingDone}/{onboarding.length} étapes
              </p>
              <p className="text-[11.5px] text-ink-500">Complétez ces étapes pour exploiter toute la plateforme.</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {onboarding.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`badge ${item.done ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-brand-200 bg-white text-brand-700"}`}
                >
                  <Icon name={item.done ? "check" : item.icon} className="h-3 w-3" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </Card>
      ) : null}

      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Activité de publication"
            subtitle="Contenus créés et publiés sur les 14 derniers jours"
            icon="chart"
            action={
              <Link href="/app/analytics" className="btn btn-sm">
                Analytics <Icon name="arrow-right" className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <DualBars items={series} />
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-ink-100 pt-3 sm:grid-cols-4">
            <div>
              <p className="text-[10.5px] uppercase tracking-wide text-ink-400">Portée</p>
              <p className="text-[15px] font-semibold text-ink-900">{summary.current.reach}</p>
              <Delta current={summary.current.reach} previous={summary.previous.reach} />
            </div>
            <div>
              <p className="text-[10.5px] uppercase tracking-wide text-ink-400">Impressions</p>
              <p className="text-[15px] font-semibold text-ink-900">{summary.current.impressions}</p>
              <Delta current={summary.current.impressions} previous={summary.previous.impressions} />
            </div>
            <div>
              <p className="text-[10.5px] uppercase tracking-wide text-ink-400">Engagement</p>
              <p className="text-[15px] font-semibold text-ink-900">{summary.current.engagement}</p>
              <Delta current={summary.current.engagement} previous={summary.previous.engagement} />
            </div>
            <div>
              <p className="text-[10.5px] uppercase tracking-wide text-ink-400">Publications</p>
              <p className="text-[15px] font-semibold text-ink-900">{summary.current.publications}</p>
              <p className="text-[11px] text-ink-400">via comptes connectés</p>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Contenus par statut" subtitle="Ensemble du studio" icon="layers" />
          <Donut
            items={summary.contentsByStatus.map((row) => ({
              label: labelOf(CONTENT_STATUSES, row.status),
              value: Number(row.total),
            }))}
          />
        </Card>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Publications récentes"
            subtitle="Derniers contenus du studio"
            icon="pen"
            action={<Link href="/app/content" className="btn btn-sm">Ouvrir le studio</Link>}
          />
          {recentContents.length === 0 ? (
            <EmptyState
              icon="pen"
              title="Aucun contenu pour le moment"
              description="Créez votre première publication : elle sera enregistrée dans la base et disponible dans le calendrier éditorial."
              action={
                <Link href="/app/content?new=1" className="btn btn-primary btn-sm">
                  <Icon name="plus" className="h-3.5 w-3.5" /> Créer un contenu
                </Link>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Contenu</th>
                    <th>Type</th>
                    <th>Statut</th>
                    <th>Auteur</th>
                    <th>Créé</th>
                  </tr>
                </thead>
                <tbody>
                  {recentContents.map((content) => (
                    <tr key={content.id}>
                      <td className="max-w-[260px]">
                        <Link href={`/app/content/${content.id}`} className="block truncate font-medium text-ink-900 hover:text-brand-700">
                          {content.title}
                        </Link>
                      </td>
                      <td className="text-[12px] text-ink-500">{labelOf(CONTENT_TYPES, content.type)}</td>
                      <td>
                        <Badge status={content.status}>{labelOf(CONTENT_STATUSES, content.status)}</Badge>
                      </td>
                      <td className="text-[12px] text-ink-500">{content.author ?? "—"}</td>
                      <td className="whitespace-nowrap text-[12px] text-ink-500">{formatRelative(content.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-3">
          <Card>
            <CardHeader title="À publier bientôt" subtitle="Prochaines dates programmées" icon="calendar" />
            {upcoming.length === 0 ? (
              <p className="text-[12px] text-ink-500">Aucun contenu programmé.</p>
            ) : (
              <ul className="space-y-2">
                {upcoming.map((item) => (
                  <li key={item.id} className="rounded-xl border border-ink-100 px-3 py-2">
                    <p className="truncate text-[12.5px] font-medium text-ink-800">{item.title}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-500">
                      <Icon name="clock" className="h-3 w-3" />
                      {formatDateTime(item.scheduled_at)}
                      {item.platform ? <span className="text-ink-400">· {labelOf(PLATFORMS, item.platform)}</span> : null}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/app/calendar" className="btn btn-sm mt-3 w-full">
              Ouvrir le calendrier
            </Link>
          </Card>

          <Card>
            <CardHeader title="Mes tâches" subtitle="Affectations en cours" icon="check-circle" />
            {myTasks.length === 0 ? (
              <p className="text-[12px] text-ink-500">Aucune tâche qui vous est affectée.</p>
            ) : (
              <ul className="space-y-2">
                {myTasks.map((task) => (
                  <li key={task.id} className="flex items-start justify-between gap-2 rounded-lg px-1 py-1.5">
                    <div>
                      <p className="text-[12.5px] text-ink-800">{task.title}</p>
                      <p className="text-[10.5px] text-ink-400">{task.due_date ? `Échéance ${formatDate(task.due_date)}` : "Sans échéance"}</p>
                    </div>
                    <Badge status={task.priority}>{task.priority === "high" ? "Urgent" : task.priority === "low" ? "Faible" : "Normal"}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        <Card>
          <CardHeader
            title="Campagnes actives"
            subtitle="Suivi des campagnes en cours"
            icon="megaphone"
            action={<Link href="/app/campaigns" className="btn btn-sm">Gérer</Link>}
          />
          {campaigns.length === 0 ? (
            <p className="text-[12px] text-ink-500">Aucune campagne active ou planifiée.</p>
          ) : (
            <ul className="space-y-2">
              {campaigns.map((campaign) => (
                <li key={campaign.id} className="rounded-xl border border-ink-100 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[12.5px] font-medium text-ink-800">{campaign.name}</p>
                    <Badge status={campaign.status}>{labelOf(CAMPAIGN_STATUSES, campaign.status)}</Badge>
                  </div>
                  <p className="mt-0.5 text-[11px] text-ink-500">
                    Fin : {campaign.end_date ? formatDate(campaign.end_date) : "non définie"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Contacts récents"
            subtitle="Derniers prospects et clients"
            icon="users"
            action={<Link href="/app/contacts" className="btn btn-sm">Ouvrir</Link>}
          />
          {recentContacts.length === 0 ? (
            <p className="text-[12px] text-ink-500">Aucun contact client enregistré.</p>
          ) : (
            <ul className="space-y-2">
              {recentContacts.map((contact) => (
                <li key={contact.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-medium text-ink-800">{contact.name}</p>
                    <p className="truncate text-[11px] text-ink-500">
                      {contact.company_name || contact.category || "—"}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-[10.5px] text-ink-400">{formatRelative(contact.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Activité de l'équipe" subtitle="Dernières actions journalisées" icon="shield" />
          {activity.length === 0 ? (
            <p className="text-[12px] text-ink-500">Aucune activité enregistrée.</p>
          ) : (
            <ul className="space-y-2.5">
              {activity.map((entry) => (
                <li key={entry.id} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                  <div className="min-w-0">
                    <p className="text-[12px] text-ink-800">
                      <span className="font-medium">{entry.actor_name}</span> · {entry.action}
                    </p>
                    <p className="truncate text-[10.5px] text-ink-400">
                      {entry.entity} · {formatRelative(entry.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <Card>
          <CardHeader title="Contenus à traiter" subtitle="Brouillons, validations et approbations" icon="clock" />
          {pendingContents.length === 0 ? (
            <p className="text-[12px] text-ink-500">Aucun contenu en attente.</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {pendingContents.map((content) => (
                <li key={content.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <Link href={`/app/content/${content.id}`} className="truncate text-[12.5px] font-medium text-ink-800 hover:text-brand-700">
                      {content.title}
                    </Link>
                    <p className="text-[10.5px] text-ink-400">
                      {content.assignee ? `Responsable : ${content.assignee}` : "Non affecté"} · maj {formatRelative(content.updated_at)}
                    </p>
                  </div>
                  <Badge status={content.status}>{labelOf(CONTENT_STATUSES, content.status)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Répartition par type" subtitle="Volume de production" icon="layers" />
          <RankBars
            items={summary.contentsByType.slice(0, 6).map((row) => ({
              label: labelOf(CONTENT_TYPES, row.type),
              value: Number(row.total),
            }))}
            tone="accent"
          />
        </Card>
      </div>
    </>
  );
}
