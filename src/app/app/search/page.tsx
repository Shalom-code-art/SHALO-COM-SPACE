import Link from "next/link";
import { SearchForm } from "@/components/controls";
import { Icon } from "@/components/icons";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import {
  CAMPAIGN_STATUSES,
  CONTENT_STATUSES,
  CONTENT_TYPES,
  PRODUCT_AVAILABILITY,
  TASK_STATUSES,
  formatDate,
  formatMoney,
  labelOf,
} from "@/lib/format";
import { hasPermission, type Permission } from "@/lib/permissions";

export const metadata = { title: "Recherche" };
export const dynamic = "force-dynamic";

type Result = { id: string; title: string; subtitle: string; href: string; badge?: string; meta?: string };
type Group = { key: string; label: string; icon: string; items: Result[] };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const companyId = user.companyId!;
  const query = await searchParams;
  const q = (query.q ?? "").trim();
  const like = `%${q}%`;
  const can = (permission: Permission) => hasPermission(user.permissions, permission);

  const groups: Group[] = [];

  if (q.length >= 2) {
    if (can("content.view")) {
      const rows = all<{ id: string; title: string; type: string; status: string; updated_at: string }>(
        `SELECT id, title, type, status, updated_at FROM contents
         WHERE company_id = ? AND archived_at IS NULL AND (title LIKE ? OR body LIKE ? OR tags LIKE ?)
         ORDER BY updated_at DESC LIMIT 10`,
        [companyId, like, like, like]
      );
      groups.push({
        key: "contents",
        label: "Contenus",
        icon: "pen",
        items: rows.map((row) => ({
          id: row.id,
          title: row.title,
          subtitle: `${labelOf(CONTENT_TYPES, row.type)} · ${labelOf(CONTENT_STATUSES, row.status)}`,
          href: `/app/content/${row.id}`,
          badge: row.status,
          meta: formatDate(row.updated_at, true),
        })),
      });
    }

    if (can("campaign.view")) {
      const rows = all<{ id: string; name: string; type: string; status: string; start_date: string | null }>(
        `SELECT id, name, type, status, start_date FROM campaigns
         WHERE company_id = ? AND (name LIKE ? OR objective LIKE ? OR description LIKE ? OR audience LIKE ?)
         ORDER BY updated_at DESC LIMIT 10`,
        [companyId, like, like, like, like]
      );
      groups.push({
        key: "campaigns",
        label: "Campagnes",
        icon: "megaphone",
        items: rows.map((row) => ({
          id: row.id,
          title: row.name,
          subtitle: labelOf(CAMPAIGN_STATUSES, row.status),
          href: `/app/campaigns/${row.id}`,
          badge: row.status,
          meta: row.start_date ? formatDate(row.start_date) : "",
        })),
      });
    }

    if (can("contacts.clients.view")) {
      const rows = all<{ id: string; name: string; company_name: string | null; email: string | null; phone: string | null }>(
        `SELECT id, name, company_name, email, phone FROM contacts
         WHERE company_id = ? AND kind = 'client'
           AND (name LIKE ? OR company_name LIKE ? OR email LIKE ? OR phone LIKE ? OR whatsapp LIKE ? OR tags LIKE ?)
         ORDER BY name LIMIT 10`,
        [companyId, like, like, like, like, like, like]
      );
      groups.push({
        key: "clients",
        label: "Contacts clients",
        icon: "users",
        items: rows.map((row) => ({
          id: row.id,
          title: row.name,
          subtitle: [row.company_name, row.email, row.phone].filter(Boolean).join(" · ") || "Fiche client",
          href: `/app/contacts?edit=${row.id}`,
        })),
      });
    }

    if (can("contacts.employees.view")) {
      const rows = all<{ id: string; name: string; job_title: string | null; department: string | null }>(
        `SELECT id, name, job_title, department FROM contacts
         WHERE company_id = ? AND kind = 'employee' AND (name LIKE ? OR job_title LIKE ? OR department LIKE ? OR email LIKE ?)
         ORDER BY name LIMIT 10`,
        [companyId, like, like, like, like]
      );
      groups.push({
        key: "employees",
        label: "Collaborateurs",
        icon: "briefcase",
        items: rows.map((row) => ({
          id: row.id,
          title: row.name,
          subtitle: [row.job_title, row.department].filter(Boolean).join(" · ") || "Fiche collaborateur",
          href: `/app/team-contacts?edit=${row.id}`,
        })),
      });
    }

    if (can("catalog.view")) {
      const rows = all<{ id: string; name: string; kind: string; price_cents: number; currency: string; availability: string }>(
        `SELECT id, name, kind, price_cents, currency, availability FROM products
         WHERE company_id = ? AND (name LIKE ? OR sku LIKE ? OR description LIKE ?)
         ORDER BY name LIMIT 10`,
        [companyId, like, like, like]
      );
      groups.push({
        key: "products",
        label: "Catalogue",
        icon: "store",
        items: rows.map((row) => ({
          id: row.id,
          title: row.name,
          subtitle: `${row.kind === "service" ? "Service" : "Produit"} · ${formatMoney(row.price_cents, row.currency)}`,
          href: `/app/catalog?edit=${row.id}`,
          badge: row.availability,
          meta: labelOf(PRODUCT_AVAILABILITY, row.availability),
        })),
      });
    }

    if (can("media.view")) {
      const rows = all<{ id: string; name: string; mime: string; folder: string }>(
        `SELECT id, name, mime, folder FROM media
         WHERE company_id = ? AND (name LIKE ? OR tags LIKE ? OR folder LIKE ?)
         ORDER BY created_at DESC LIMIT 10`,
        [companyId, like, like, like]
      );
      groups.push({
        key: "media",
        label: "Médiathèque",
        icon: "folder",
        items: rows.map((row) => ({
          id: row.id,
          title: row.name,
          subtitle: `${row.mime} · ${row.folder}`,
          href: `/app/media?q=${encodeURIComponent(row.name)}`,
        })),
      });
    }

    if (can("team.view")) {
      const rows = all<{ id: string; title: string; status: string; due_date: string | null }>(
        `SELECT id, title, status, due_date FROM tasks
         WHERE company_id = ? AND (title LIKE ? OR description LIKE ?)
         ORDER BY updated_at DESC LIMIT 10`,
        [companyId, like, like]
      );
      groups.push({
        key: "tasks",
        label: "Tâches",
        icon: "check-circle",
        items: rows.map((row) => ({
          id: row.id,
          title: row.title,
          subtitle: labelOf(TASK_STATUSES, row.status),
          href: "/app/team?tab=tasks",
          badge: row.status,
          meta: row.due_date ? `Échéance ${formatDate(row.due_date)}` : "",
        })),
      });
    }
  }

  const visible = groups.filter((group) => group.items.length > 0);
  const total = visible.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <>
      <PageHeader
        title="Recherche globale"
        subtitle="Retrouvez un contenu, une campagne, un contact, un produit, un fichier ou une tâche dans votre espace."
        icon="search"
        actions={<SearchForm action="/app/search" defaultValue={q} placeholder="Nom, texte, email, tag…" />}
      />

      {q.length < 2 ? (
        <Card>
          <EmptyState
            icon="search"
            title="Saisissez au moins deux caractères"
            description="La recherche couvre uniquement les modules auxquels votre rôle donne accès."
          />
        </Card>
      ) : total === 0 ? (
        <Card>
          <EmptyState
            icon="search"
            title={`Aucun résultat pour « ${q} »`}
            description="Vérifiez l'orthographe ou essayez un terme plus général."
          />
        </Card>
      ) : (
        <>
          <p className="mb-3 text-[12px] text-ink-500">
            {total} résultat(s) pour « <span className="font-medium text-ink-800">{q}</span> » dans{" "}
            {visible.length} module(s).
          </p>
          <div className="grid gap-3 xl:grid-cols-2">
            {visible.map((group) => (
              <Card key={group.key}>
                <CardHeader title={group.label} subtitle={`${group.items.length} résultat(s)`} icon={group.icon} />
                <ul className="divide-y divide-ink-100">
                  {group.items.map((item) => (
                    <li key={`${group.key}-${item.id}`}>
                      <Link href={item.href} className="flex items-start justify-between gap-3 py-2.5 transition hover:bg-ink-50">
                        <span className="min-w-0">
                          <span className="block truncate text-[12.5px] font-medium text-ink-800">{item.title}</span>
                          <span className="block truncate text-[11px] text-ink-500">{item.subtitle}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          {item.badge ? <Badge status={item.badge}>{item.badge}</Badge> : null}
                          {item.meta ? <span className="text-[10.5px] text-ink-400">{item.meta}</span> : null}
                          <Icon name="arrow-right" className="h-3.5 w-3.5 text-ink-300" />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}
