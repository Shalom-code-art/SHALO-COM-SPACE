import Link from "next/link";
import { Icon } from "@/components/icons";
import { Alert, Badge, Card, CardHeader, EmptyState, PageHeader, Tabs } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { CONTENT_STATUSES, CONTENT_TYPES, PLATFORMS, formatDate, formatDateTime, labelOf } from "@/lib/format";

export const metadata = { title: "Calendrier éditorial" };

const DAY_MS = 86400000;

function parseDate(value?: string | null): Date {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00.000Z`);
  }
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfWeek(date: Date): Date {
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(date, diff);
}

type CalendarItem = {
  id: string;
  title: string;
  type: string;
  status: string;
  scheduled_at: string;
  assignee: string | null;
  platform: string | null;
  account: string | null;
};

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string; assignee?: string }>;
}) {
  const user = await requireUser("calendar.view");
  const companyId = user.companyId!;
  const query = await searchParams;
  const view = query.view === "day" || query.view === "week" ? query.view : "month";
  const anchor = parseDate(query.date);

  let rangeStart: Date;
  let rangeEnd: Date;
  if (view === "day") {
    rangeStart = anchor;
    rangeEnd = addDays(anchor, 1);
  } else if (view === "week") {
    rangeStart = startOfWeek(anchor);
    rangeEnd = addDays(rangeStart, 7);
  } else {
    rangeStart = addDays(startOfWeek(new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1))), 0);
    rangeEnd = addDays(rangeStart, 42);
  }

  const args: unknown[] = [companyId, rangeStart.toISOString(), rangeEnd.toISOString()];
  let assigneeFilter = "";
  if (query.assignee) {
    assigneeFilter = " AND c.assignee_id = ?";
    args.push(query.assignee);
  }

  const items = all<CalendarItem>(
    `SELECT c.id, c.title, c.type, c.status, c.scheduled_at, u.name AS assignee,
            s.platform, s.account_name AS account
     FROM contents c
     LEFT JOIN users u ON u.id = c.assignee_id
     LEFT JOIN social_accounts s ON s.id = c.social_account_id
     WHERE c.company_id = ? AND c.scheduled_at IS NOT NULL AND c.scheduled_at >= ? AND c.scheduled_at < ?
       AND c.archived_at IS NULL${assigneeFilter}
     ORDER BY c.scheduled_at ASC`,
    args
  );

  const members = all<{ id: string; name: string }>(
    "SELECT id, name FROM users WHERE company_id = ? AND status = 'active' ORDER BY name",
    [companyId]
  );
  const campaigns = all<{ id: string; name: string; status: string; start_date: string | null; end_date: string | null }>(
    `SELECT id, name, status, start_date, end_date FROM campaigns
     WHERE company_id = ? AND status IN ('planned','active')
       AND (end_date IS NULL OR end_date >= ?) ORDER BY start_date ASC LIMIT 4`,
    [companyId, isoDay(anchor)]
  );
  const pendingCount = all<{ total: number }>(
    "SELECT COUNT(*) AS total FROM contents WHERE company_id = ? AND status IN ('in_review','approved') AND archived_at IS NULL",
    [companyId]
  )[0]?.total ?? 0;

  const byDay = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const key = item.scheduled_at.slice(0, 10);
    const list = byDay.get(key) ?? [];
    list.push(item);
    byDay.set(key, list);
  }

  const navBase = `/app/calendar?view=${view}${query.assignee ? `&assignee=${query.assignee}` : ""}`;
  const shift =
    view === "day" ? 1 : view === "week" ? 7 : 30;
  const prevDate = isoDay(addDays(view === "month" ? new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1)) : anchor, -shift));
  const nextDate = isoDay(addDays(view === "month" ? new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1)) : anchor, shift));

  const title =
    view === "day"
      ? formatDate(anchor.toISOString())
      : view === "week"
        ? `Semaine du ${formatDate(rangeStart.toISOString())}`
        : anchor.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  const monthGrid: Date[] = [];
  if (view === "month") {
    for (let index = 0; index < 42; index += 1) monthGrid.push(addDays(rangeStart, index));
  }

  return (
    <>
      <PageHeader
        title="Calendrier éditorial"
        subtitle="Programmation, responsabilités et statuts de validation des contenus."
        icon="calendar"
        actions={
          <>
            <Link href={`/app/calendar?view=${view}`} className="btn">
              <Icon name="refresh" className="h-4 w-4" /> Aujourd'hui
            </Link>
            {user.permissions.includes("content.create") ? (
              <Link href="/app/content?new=1" className="btn btn-primary">
                <Icon name="plus" className="h-4 w-4" /> Nouveau contenu
              </Link>
            ) : null}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Tabs
          items={[
            { label: "Mois", href: `/app/calendar?view=month&date=${isoDay(anchor)}`, active: view === "month" },
            { label: "Semaine", href: `/app/calendar?view=week&date=${isoDay(anchor)}`, active: view === "week" },
            { label: "Jour", href: `/app/calendar?view=day&date=${isoDay(anchor)}`, active: view === "day" },
          ]}
        />
        <div className="flex items-center gap-2">
          <form action="/app/calendar" method="get" className="flex items-center gap-1.5">
            <input type="hidden" name="view" value={view} />
            <input type="hidden" name="date" value={isoDay(anchor)} />
            <select name="assignee" defaultValue={query.assignee ?? ""} className="input w-auto text-[12px]">
              <option value="">Tous les responsables</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
            <button type="submit" className="btn btn-sm">Filtrer</button>
          </form>
        </div>
      </div>

      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <Link href={`${navBase}&date=${prevDate}`} className="btn btn-icon btn-sm" aria-label="Période précédente">
              <Icon name="chevron" className="h-4 w-4 rotate-90" />
            </Link>
            <Link href={`${navBase}&date=${nextDate}`} className="btn btn-icon btn-sm" aria-label="Période suivante">
              <Icon name="chevron" className="h-4 w-4 -rotate-90" />
            </Link>
            <p className="text-[14px] font-semibold capitalize text-ink-900">{title}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10.5px] text-ink-500">
            <span>{items.length} contenu(s) programmé(s)</span>
            <span className="text-ink-300">|</span>
            <span>{pendingCount} en attente de validation</span>
          </div>
        </div>

        {view === "month" ? (
          <div>
            <div className="grid grid-cols-7 border-b border-ink-100 bg-ink-50/60">
              {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => (
                <div key={day} className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-ink-500">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {monthGrid.map((day) => {
                const key = isoDay(day);
                const dayItems = byDay.get(key) ?? [];
                const outside = day.getUTCMonth() !== anchor.getUTCMonth();
                const isToday = key === isoDay(new Date());
                return (
                  <div
                    key={key}
                    className={`min-h-[104px] border-b border-r border-ink-100 p-1.5 ${outside ? "bg-ink-50/40" : "bg-white"}`}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        className={`grid h-5 w-5 place-items-center rounded-full text-[10.5px] ${
                          isToday ? "bg-brand-700 font-semibold text-white" : outside ? "text-ink-300" : "text-ink-600"
                        }`}
                      >
                        {day.getUTCDate()}
                      </span>
                      {dayItems.length > 2 ? <span className="text-[9px] text-ink-400">+{dayItems.length - 2}</span> : null}
                    </div>
                    <ul className="space-y-1">
                      {dayItems.slice(0, 2).map((item) => (
                        <li key={item.id}>
                          <Link
                            href={`/app/content/${item.id}`}
                            className={`block truncate rounded px-1 py-0.5 text-[9.5px] leading-tight ${statusTint(item.status)}`}
                            title={`${item.title} — ${labelOf(CONTENT_STATUSES, item.status)}`}
                          >
                            {item.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {view === "week" ? (
          <div className="grid grid-cols-1 divide-y divide-ink-100 sm:grid-cols-7 sm:divide-x sm:divide-y-0">
            {Array.from({ length: 7 }).map((_, index) => {
              const day = addDays(rangeStart, index);
              const key = isoDay(day);
              const dayItems = byDay.get(key) ?? [];
              return (
                <div key={key} className="min-h-[160px] p-2">
                  <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-ink-500">
                    {day.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit" })} 
                  </p>
                  <ul className="space-y-1.5">
                    {dayItems.length === 0 ? <li className="text-[10.5px] text-ink-300">—</li> : null}
                    {dayItems.map((item) => (
                      <li key={item.id}>
                        <Link href={`/app/content/${item.id}`} className={`block rounded-lg px-1.5 py-1 text-[10.5px] ${statusTint(item.status)}`}>
                          <span className="block font-medium">
                            {new Date(item.scheduled_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <span className="line-clamp-2">{item.title}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        ) : null}

        {view === "day" ? (
          <div className="p-3">
            {items.length === 0 ? (
              <EmptyState
                icon="calendar"
                title="Aucun contenu programmé ce jour"
                description="Programmez un contenu depuis le studio : il apparaîtra ici avec son responsable et son statut."
                action={user.permissions.includes("content.create") ? <Link href="/app/content?new=1" className="btn btn-sm btn-primary">Créer un contenu</Link> : undefined}
              />
            ) : (
              <ul className="divide-y divide-ink-100">
                {items.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/app/content/${item.id}`} className="text-[13px] font-medium text-ink-900 hover:text-brand-700">
                        {item.title}
                      </Link>
                      <p className="text-[11px] text-ink-500">
                        {formatDateTime(item.scheduled_at)} · {labelOf(CONTENT_TYPES, item.type)}
                        {item.platform ? ` · ${labelOf(PLATFORMS, item.platform)}` : ""}
                        {item.account ? ` (${item.account})` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-ink-500">{item.assignee ?? "Non affecté"}</span>
                      <Badge status={item.status}>{labelOf(CONTENT_STATUSES, item.status)}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </Card>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title="Légende des statuts" subtitle="Couleurs utilisées dans le calendrier" icon="layers" />
          <div className="flex flex-wrap gap-2">
            {Object.entries(CONTENT_STATUSES).map(([key, label]) => (
              <span key={key} className={`rounded-lg px-2 py-1 text-[11px] ${statusTint(key)}`}>{label}</span>
            ))}
          </div>
          <div className="mt-3">
            <Alert tone="info" title="Publication automatique">
              Le calendrier organise et rappelle la publication. L'envoi automatique vers les réseaux sociaux
              nécessite une intégration API officielle validée pour chaque plateforme ; à défaut, une procédure
              manuelle est affichée sur chaque contenu.
            </Alert>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Campagnes en cours"
            subtitle="Périodes de diffusion planifiées"
            icon="megaphone"
            action={<Link href="/app/campaigns" className="btn btn-sm">Gérer</Link>}
          />
          {campaigns.length === 0 ? (
            <p className="text-[12px] text-ink-500">Aucune campagne planifiée ou active.</p>
          ) : (
            <ul className="space-y-2">
              {campaigns.map((campaign) => (
                <li key={campaign.id} className="rounded-xl border border-ink-100 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[12.5px] font-medium text-ink-800">{campaign.name}</p>
                    <Badge status={campaign.status}>{campaign.status === "active" ? "En cours" : "Planifiée"}</Badge>
                  </div>
                  <p className="text-[10.5px] text-ink-400">
                    {campaign.start_date ? formatDate(campaign.start_date) : "—"} → {campaign.end_date ? formatDate(campaign.end_date) : "—"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function statusTint(status: string): string {
  const map: Record<string, string> = {
    draft: "bg-slate-100 text-slate-700",
    in_progress: "bg-amber-100 text-amber-800",
    in_review: "bg-violet-100 text-violet-800",
    approved: "bg-emerald-100 text-emerald-800",
    scheduled: "bg-sky-100 text-sky-800",
    published: "bg-brand-100 text-brand-800",
    cancelled: "bg-rose-100 text-rose-800",
  };
  return map[status] ?? "bg-ink-100 text-ink-700";
}
