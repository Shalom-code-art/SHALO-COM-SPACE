import Link from "next/link";
import { ConfirmSubmit, Disclosure, SearchForm } from "@/components/controls";
import { Icon } from "@/components/icons";
import { Avatar, Card, CardHeader, EmptyState, Flash, InfoRow, PageHeader, StatCard } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { all, count, get } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import {
  createEmployeeContactAction,
  deleteContactAction,
  importContactsAction,
  updateEmployeeContactAction,
} from "@/server/actions/contact";

export const metadata = { title: "Répertoire collaborateurs" };

function EmployeeFields({ contact }: { contact?: Record<string, unknown> }) {
  const value = (key: string) => String(contact?.[key] ?? "");
  return (
    <>
      <div className="md:col-span-2">
        <label className="label" htmlFor="name">Nom du collaborateur *</label>
        <input id="name" name="name" required defaultValue={value("name")} className="input" placeholder="Ex. Jean-Marc Obame" />
      </div>
      <div>
        <label className="label" htmlFor="jobTitle">Fonction / poste</label>
        <input id="jobTitle" name="jobTitle" defaultValue={value("job_title")} className="input" placeholder="Ex. Responsable communication" />
      </div>
      <div>
        <label className="label" htmlFor="department">Service / département</label>
        <input id="department" name="department" list="departments" defaultValue={value("department")} className="input" placeholder="Ex. Marketing" />
      </div>
      <div>
        <label className="label" htmlFor="phone">Téléphone interne</label>
        <input id="phone" name="phone" defaultValue={value("phone")} className="input" placeholder="+241 06 00 00 00" />
      </div>
      <div>
        <label className="label" htmlFor="email">Email professionnel</label>
        <input id="email" name="email" type="email" defaultValue={value("email")} className="input" placeholder="prenom.nom@entreprise.com" />
      </div>
      <div className="md:col-span-2">
        <label className="label" htmlFor="managerName">Responsable hiérarchique</label>
        <input id="managerName" name="managerName" defaultValue={value("manager_name")} className="input" placeholder="Ex. Directrice générale" />
      </div>
      <div className="md:col-span-2">
        <label className="label" htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" rows={3} defaultValue={value("notes")} className="input" />
      </div>
    </>
  );
}

export default async function TeamContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; department?: string; edit?: string; saved?: string; error?: string }>;
}) {
  const user = await requireUser("contacts.employees.view");
  const companyId = user.companyId!;
  const query = await searchParams;
  const canManage = user.permissions.includes("contacts.employees.manage");

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const totals = get<{ total: number; this_month: number }>(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END), 0) AS this_month
     FROM contacts WHERE company_id = ? AND kind = 'employee'`,
    [monthStart.toISOString(), companyId]
  ) ?? { total: 0, this_month: 0 };

  const departments = all<{ department: string; total: number }>(
    `SELECT department, COUNT(*) AS total FROM contacts
     WHERE company_id = ? AND kind = 'employee' AND department IS NOT NULL AND TRIM(department) <> ''
     GROUP BY department ORDER BY department`,
    [companyId]
  );

  const where = ["c.company_id = ?", "c.kind = 'employee'"];
  const args: unknown[] = [companyId];
  if (query.q) {
    where.push("(c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR c.job_title LIKE ? OR c.manager_name LIKE ?)");
    const like = `%${query.q.trim()}%`;
    args.push(like, like, like, like, like);
  }
  if (query.department) {
    where.push("c.department = ?");
    args.push(query.department);
  }

  const employees = all<{
    id: string;
    name: string;
    job_title: string | null;
    department: string | null;
    manager_name: string | null;
    phone: string | null;
    email: string | null;
    notes: string | null;
    updated_at: string;
  }>(
    `SELECT c.id, c.name, c.job_title, c.department, c.manager_name, c.phone, c.email, c.notes, c.updated_at
     FROM contacts c
     WHERE ${where.join(" AND ")}
     ORDER BY c.department, c.name
     LIMIT 300`,
    args
  );

  const editing = query.edit
    ? get<Record<string, unknown>>(
        "SELECT * FROM contacts WHERE id = ? AND company_id = ? AND kind = 'employee'",
        [query.edit, companyId]
      )
    : null;

  const teamMembers = count(
    "SELECT COUNT(*) AS n FROM users WHERE company_id = ? AND status = 'active'",
    [companyId]
  );

  return (
    <>
      <PageHeader
        title="Répertoire collaborateurs"
        subtitle="Annuaire interne de l'entreprise, tenu séparément des contacts clients et prospects."
        icon="briefcase"
        actions={
          <>
            <Link href="/api/v1/contacts/export?kind=employee" className="btn" prefetch={false}>
              <Icon name="download" className="h-4 w-4" /> Export CSV
            </Link>
            <Link href="/app/contacts" className="btn">
              <Icon name="users" className="h-4 w-4" /> Contacts clients
            </Link>
          </>
        }
      />

      <Flash saved={query.saved} error={query.error} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Collaborateurs référencés" value={totals.total} icon="briefcase" tone="brand" />
        <StatCard label="Services" value={departments.length} icon="layers" tone="sky" />
        <StatCard label="Ajoutés ce mois" value={totals.this_month} icon="plus" tone="emerald" />
        <StatCard label="Comptes plateforme" value={teamMembers} icon="user" tone="violet" hint="Utilisateurs avec accès" />
      </div>

      <datalist id="departments">
        {departments.map((row) => (
          <option key={row.department} value={row.department} />
        ))}
      </datalist>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <SearchForm action="/app/team-contacts" placeholder="Nom, poste, email, responsable…" defaultValue={query.q ?? ""} hidden={query.department ? { department: query.department } : {}} />
        {departments.map((row) => (
          <Link
            key={row.department}
            href={`/app/team-contacts?department=${encodeURIComponent(row.department)}`}
            className={
              query.department === row.department
                ? "badge border-brand-700 bg-brand-700 text-white"
                : "badge border-ink-200 bg-white text-ink-600 hover:border-brand-200 hover:text-brand-700"
            }
          >
            {row.department} <span className="ml-1 text-[10px] opacity-70">{row.total}</span>
          </Link>
        ))}
        {query.department ? (
          <Link href="/app/team-contacts" className="badge border-rose-200 bg-rose-50 text-rose-700">
            <Icon name="close" className="mr-1 h-3 w-3" /> Réinitialiser
          </Link>
        ) : null}
      </div>

      {canManage ? (
        <div className="mb-4 mt-3 flex flex-wrap items-start gap-2">
          <Disclosure title="Nouveau collaborateur">
            <form action={createEmployeeContactAction} className="card card-pad grid gap-3 md:grid-cols-2">
              <EmployeeFields />
              <div className="md:col-span-2 flex justify-end">
                <button type="submit" className="btn btn-primary">
                  <Icon name="check" className="h-4 w-4" /> Enregistrer le collaborateur
                </button>
              </div>
            </form>
          </Disclosure>
          <Disclosure title="Importer un CSV" variant="ghost">
            <form action={importContactsAction} className="card card-pad space-y-3">
              <input type="hidden" name="kind" value="employee" />
              <p className="text-[12px] text-ink-600">
                Colonnes reconnues : <code className="rounded bg-ink-100 px-1">nom;telephone;email;fonction;service;notes</code>.
                Une colonne <code className="rounded bg-ink-100 px-1">poste</code> ou <code className="rounded bg-ink-100 px-1">departement</code> est également acceptée.
                Les doublons (téléphone ou email identiques) sont ignorés.
              </p>
              <input type="file" name="file" accept=".csv,text/csv" required className="input" />
              <div className="flex justify-end">
                <button type="submit" className="btn btn-primary">
                  <Icon name="upload" className="h-4 w-4" /> Lancer l'import
                </button>
              </div>
            </form>
          </Disclosure>
        </div>
      ) : null}

      {editing ? (
        <Card className="mb-4">
          <CardHeader
            title={`Fiche : ${String(editing.name)}`}
            subtitle="Informations professionnelles internes"
            icon="briefcase"
            action={
              <Link href="/app/team-contacts" className="btn btn-sm">
                <Icon name="close" className="h-3.5 w-3.5" /> Fermer
              </Link>
            }
          />
          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <form action={updateEmployeeContactAction} className="grid gap-3 md:grid-cols-2">
              <input type="hidden" name="id" value={String(editing.id)} />
              <EmployeeFields contact={editing} />
              <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-ink-400">Mis à jour le {formatDateTime(String(editing.updated_at))}</p>
                <button type="submit" className="btn btn-primary">
                  <Icon name="check" className="h-4 w-4" /> Enregistrer
                </button>
              </div>
            </form>
            <div>
              <div className="rounded-xl border border-ink-100 bg-ink-50/60 p-3">
                <InfoRow label="Poste" value={String(editing.job_title ?? "—")} />
                <InfoRow label="Service" value={String(editing.department ?? "—")} />
                <InfoRow label="Responsable" value={String(editing.manager_name ?? "—")} />
                <InfoRow label="Créé le" value={formatDateTime(String(editing.created_at))} />
              </div>
              {canManage ? (
                <form action={deleteContactAction} className="mt-3 flex justify-end">
                  <input type="hidden" name="id" value={String(editing.id)} />
                  <input type="hidden" name="kind" value="employee" />
                  <ConfirmSubmit message="Retirer ce collaborateur du répertoire ?">Supprimer la fiche</ConfirmSubmit>
                </form>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Annuaire interne" subtitle={`${employees.length} collaborateur(s) affiché(s)`} icon="briefcase" />
        {employees.length === 0 ? (
          <EmptyState
            icon="briefcase"
            title="Aucun collaborateur dans ce répertoire"
            description="Ce répertoire est distinct des contacts clients : il recense les personnes internes de l'entreprise et leurs fonctions."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Collaborateur</th>
                  <th>Service</th>
                  <th>Coordonnées</th>
                  <th>Responsable</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={employee.name} size="sm" />
                        <div className="min-w-0">
                          <Link href={`/app/team-contacts?edit=${employee.id}`} className="block truncate font-medium text-ink-900 hover:text-brand-700">
                            {employee.name}
                          </Link>
                          <p className="truncate text-[11px] text-ink-400">{employee.job_title ?? "Fonction non renseignée"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-[12px] text-ink-600">{employee.department ?? "—"}</td>
                    <td>
                      <div className="space-y-0.5 text-[11.5px]">
                        {employee.phone ? <p className="text-ink-600">{employee.phone}</p> : null}
                        {employee.email ? (
                          <a href={`mailto:${employee.email}`} className="block truncate text-brand-700 hover:underline">{employee.email}</a>
                        ) : null}
                        {!employee.phone && !employee.email ? <span className="text-ink-400">—</span> : null}
                      </div>
                    </td>
                    <td className="text-[12px] text-ink-600">{employee.manager_name ?? "—"}</td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/app/team-contacts?edit=${employee.id}`} className="btn btn-sm">
                          <Icon name="edit" className="h-3.5 w-3.5" /> Ouvrir
                        </Link>
                        {canManage ? (
                          <form action={deleteContactAction}>
                            <input type="hidden" name="id" value={employee.id} />
                            <input type="hidden" name="kind" value="employee" />
                            <ConfirmSubmit message="Supprimer ?">Supprimer</ConfirmSubmit>
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
      </Card>
    </>
  );
}
