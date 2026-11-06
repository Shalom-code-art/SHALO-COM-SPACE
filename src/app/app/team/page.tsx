import Link from "next/link";
import { ConfirmSubmit, CopyButton, Disclosure } from "@/components/controls";
import { Icon } from "@/components/icons";
import { Alert, Avatar, Badge, Card, CardHeader, EmptyState, Flash, PageHeader, StatCard, Tabs } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { all, count } from "@/lib/db";
import { TASK_STATUSES, formatDate, formatDateTime, labelOf } from "@/lib/format";
import { ALL_PERMISSIONS, COMPANY_ROLES, ROLE_LABELS, effectivePermissions, permissionGroups, type CompanyRole } from "@/lib/permissions";
import { resetMemberPasswordAction } from "@/server/actions/auth";
import {
  createTaskAction,
  deleteTaskAction,
  inviteMemberAction,
  revokeInvitationAction,
  saveRolePermissionsAction,
  setMemberStatusAction,
  setTaskStatusAction,
  updateMemberRoleAction,
} from "@/server/actions/team";

export const metadata = { title: "Équipe & tâches" };

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; role?: string; invited?: string; saved?: string; error?: string }>;
}) {
  const user = await requireUser("team.view");
  const companyId = user.companyId!;
  const query = await searchParams;
  const canManage = user.permissions.includes("team.manage");
  const tab = query.tab ?? "members";

  const members = all<{
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    job_title: string | null;
    last_login_at: string | null;
    created_at: string;
  }>(
    `SELECT id, name, email, role, status, job_title, last_login_at, created_at
     FROM users WHERE company_id = ? AND role <> 'platform_admin' ORDER BY
       CASE role WHEN 'owner' THEN 0 WHEN 'communication_manager' THEN 1 ELSE 2 END, name`,
    [companyId]
  );

  const invitations = all<{ id: string; email: string; role: string; expires_at: string; created_at: string }>(
    `SELECT id, email, role, expires_at, created_at FROM invitations
     WHERE company_id = ? AND accepted_at IS NULL ORDER BY created_at DESC`,
    [companyId]
  );

  const tasks = all<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    due_date: string | null;
    assignee: string | null;
    assignee_id: string | null;
    content_title: string | null;
    content_id: string | null;
    campaign_title: string | null;
  }>(
    `SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date, u.name AS assignee, t.assignee_id,
            c.title AS content_title, t.content_id, cp.name AS campaign_title
     FROM tasks t
     LEFT JOIN users u ON u.id = t.assignee_id
     LEFT JOIN contents c ON c.id = t.content_id
     LEFT JOIN campaigns cp ON cp.id = t.campaign_id
     WHERE t.company_id = ? ORDER BY
       CASE t.status WHEN 'blocked' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'todo' THEN 2 ELSE 3 END,
       COALESCE(t.due_date, '9999') ASC`,
    [companyId]
  );

  const roleParam = (query.role && COMPANY_ROLES.includes(query.role as CompanyRole) ? query.role : "editor") as CompanyRole;
  const overrides = all<{ permission: string; allowed: number }>(
    "SELECT permission, allowed FROM role_permissions WHERE company_id = ? AND role = ?",
    [companyId, roleParam]
  );
  const rolePermissions = new Set(effectivePermissions(roleParam, overrides));
  const activeMembers = members.filter((member) => member.status === "active").length;
  const openTasks = tasks.filter((task) => task.status !== "done").length;
  const overdue = tasks.filter((task) => task.status !== "done" && task.due_date && task.due_date < new Date().toISOString().slice(0, 10)).length;
  const contents = all<{ id: string; title: string }>(
    "SELECT id, title FROM contents WHERE company_id = ? AND archived_at IS NULL ORDER BY updated_at DESC LIMIT 100",
    [companyId]
  );
  const campaigns = all<{ id: string; name: string }>("SELECT id, name FROM campaigns WHERE company_id = ? ORDER BY name", [companyId]);
  const doneThisMonth = count(
    "SELECT COUNT(*) AS n FROM tasks WHERE company_id = ? AND status = 'done' AND updated_at >= ?",
    [companyId, new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()]
  );

  return (
    <>
      <PageHeader
        title="Équipe & tâches"
        subtitle="Collaborateurs, invitations, rôles configurables et suivi des tâches internes."
        icon="user-plus"
        actions={
          <Link href="/app/team-contacts" className="btn">
            <Icon name="briefcase" className="h-4 w-4" /> Répertoire collaborateurs
          </Link>
        }
      />

      <Flash saved={query.saved} error={query.error} />

      {query.invited && canManage ? (
        <div className="mb-4">
          <Alert tone="success" title="Invitation prête à être transmise">
            <p className="mb-2">Transmettez ce lien au collaborateur invité (valable 7 jours). Il ne sera plus affiché ensuite.</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="max-w-full truncate rounded-lg bg-white/70 px-2 py-1 text-[11.5px] text-ink-800">
                /invitation/{query.invited}
              </code>
              <CopyButton text={`/invitation/${query.invited}`} label="Copier le lien" />
            </div>
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Collaborateurs actifs" value={activeMembers} icon="users" tone="brand" />
        <StatCard label="Invitations en attente" value={invitations.length} icon="mail" tone="accent" />
        <StatCard label="Tâches ouvertes" value={openTasks} icon="clock" tone="sky" hint={overdue ? `${overdue} en retard` : undefined} />
        <StatCard label="Tâches terminées ce mois" value={doneThisMonth} icon="check-circle" tone="emerald" />
      </div>

      <div className="mt-4">
        <Tabs
          items={[
            { label: "Équipe", href: "/app/team", active: tab === "members", count: members.length },
            { label: "Tâches", href: "/app/team?tab=tasks", active: tab === "tasks", count: openTasks },
            { label: "Rôles & permissions", href: "/app/team?tab=permissions", active: tab === "permissions" },
          ]}
        />
      </div>

      {tab === "members" ? (
        <div className="space-y-4">
          {canManage ? (
            <Disclosure title="Inviter un collaborateur">
              <form action={inviteMemberAction} className="card card-pad grid gap-3 md:grid-cols-3">
                <div className="md:col-span-2">
                  <label className="label" htmlFor="email">Adresse email *</label>
                  <input id="email" name="email" type="email" required className="input" placeholder="prenom.nom@entreprise.com" />
                </div>
                <div>
                  <label className="label" htmlFor="role">Rôle</label>
                  <select id="role" name="role" className="input" defaultValue="editor">
                    {COMPANY_ROLES.map((role) => (
                      <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-3 flex items-center justify-between gap-2">
                  <p className="hint">Le collaborateur crée son mot de passe via le lien d&apos;invitation.</p>
                  <button type="submit" className="btn btn-primary">
                    <Icon name="plus" className="h-4 w-4" /> Créer l&apos;invitation
                  </button>
                </div>
              </form>
            </Disclosure>
          ) : null}

          <Card>
            <CardHeader title="Collaborateurs" subtitle={`${members.length} personne(s) dans l'entreprise`} icon="users" />
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Personne</th>
                    <th>Rôle</th>
                    <th>Statut</th>
                    <th>Dernière connexion</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={member.name} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-[12.5px] font-medium text-ink-900">{member.name}</p>
                            <p className="truncate text-[11px] text-ink-400">{member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        {canManage && member.role !== "owner" ? (
                          <form action={updateMemberRoleAction} className="flex items-center gap-1">
                            <input type="hidden" name="memberId" value={member.id} />
                            <select name="role" defaultValue={member.role} className="input h-8 py-0 text-[11.5px]" aria-label="Rôle">
                              {COMPANY_ROLES.map((role) => (
                                <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                              ))}
                            </select>
                            <button type="submit" className="btn btn-sm">OK</button>
                          </form>
                        ) : (
                          <Badge status={member.role === "owner" ? "admin" : "planned"}>{ROLE_LABELS[member.role as CompanyRole] ?? member.role}</Badge>
                        )}
                      </td>
                      <td>
                        <Badge status={member.status === "active" ? "active" : "cancelled"}>
                          {member.status === "active" ? "Actif" : "Accès suspendu"}
                        </Badge>
                      </td>
                      <td className="text-[11.5px] text-ink-500">
                        {member.last_login_at ? formatDateTime(member.last_login_at) : "jamais"}
                      </td>
                      <td>
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {canManage && member.id !== user.id ? (
                            <form action={setMemberStatusAction}>
                              <input type="hidden" name="memberId" value={member.id} />
                              <input type="hidden" name="status" value={member.status === "active" ? "suspended" : "active"} />
                              <button type="submit" className="btn btn-sm">
                                {member.status === "active" ? "Suspendre" : "Réactiver"}
                              </button>
                            </form>
                          ) : null}
                          {canManage ? (
                            <details className="relative">
                              <summary className="btn btn-sm cursor-pointer list-none">Mot de passe</summary>
                              <form action={resetMemberPasswordAction} className="card card-pad mt-2 space-y-2">
                                <input type="hidden" name="memberId" value={member.id} />
                                <label className="label" htmlFor={`pwd-${member.id}`}>Nouveau mot de passe temporaire</label>
                                <input id={`pwd-${member.id}`} name="password" type="password" minLength={8} required className="input" />
                                <p className="hint">Le collaborateur devra le changer à la prochaine connexion.</p>
                                <button type="submit" className="btn btn-primary btn-sm w-full justify-center">Réinitialiser</button>
                              </form>
                            </details>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader title="Invitations en attente" subtitle="Liens valables 7 jours" icon="mail" />
            {invitations.length === 0 ? (
              <p className="text-[12px] text-ink-500">Aucune invitation en attente.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Rôle</th>
                      <th>Créée le</th>
                      <th>Expire le</th>
                      {canManage ? <th className="text-right">Actions</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {invitations.map((invitation) => (
                      <tr key={invitation.id}>
                        <td className="text-[12px] text-ink-800">{invitation.email}</td>
                        <td className="text-[11.5px] text-ink-600">{ROLE_LABELS[invitation.role as CompanyRole] ?? invitation.role}</td>
                        <td className="text-[11px] text-ink-500">{formatDate(invitation.created_at)}</td>
                        <td className="text-[11px] text-ink-500">{formatDate(invitation.expires_at)}</td>
                        {canManage ? (
                          <td>
                            <form action={revokeInvitationAction} className="flex justify-end">
                              <input type="hidden" name="id" value={invitation.id} />
                              <ConfirmSubmit message="Annuler cette invitation ?">Annuler</ConfirmSubmit>
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
        </div>
      ) : null}

      {tab === "tasks" ? (
        <div className="space-y-4">
          <Disclosure title="Nouvelle tâche">
            <form action={createTaskAction} className="card card-pad grid gap-3 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="label" htmlFor="title">Intitulé *</label>
                <input id="title" name="title" required className="input" placeholder="Ex. Valider l'affiche de la campagne" />
              </div>
              <div>
                <label className="label" htmlFor="assigneeId">Assignée à</label>
                <select id="assigneeId" name="assigneeId" className="input" defaultValue={user.id}>
                  <option value="">Non assignée</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="dueDate">Échéance</label>
                <input id="dueDate" name="dueDate" type="date" className="input" />
              </div>
              <div>
                <label className="label" htmlFor="priority">Priorité</label>
                <select id="priority" name="priority" className="input" defaultValue="normal">
                  <option value="low">Basse</option>
                  <option value="normal">Normale</option>
                  <option value="high">Haute</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="statusHint">Statut initial</label>
                <input id="statusHint" value={labelOf(TASK_STATUSES, "todo")} readOnly className="input bg-ink-50" />
              </div>
              <div>
                <label className="label" htmlFor="contentId">Contenu lié</label>
                <select id="contentId" name="contentId" className="input">
                  <option value="">Aucun</option>
                  {contents.map((content) => (
                    <option key={content.id} value={content.id}>{content.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="campaignId">Campagne liée</label>
                <select id="campaignId" name="campaignId" className="input">
                  <option value="">Aucune</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-3">
                <label className="label" htmlFor="description">Description</label>
                <textarea id="description" name="description" rows={2} className="input" />
              </div>
              <div className="md:col-span-3 flex justify-end">
                <button type="submit" className="btn btn-primary">
                  <Icon name="plus" className="h-4 w-4" /> Créer la tâche
                </button>
              </div>
            </form>
          </Disclosure>

          <Card>
            <CardHeader title="Tâches de l'équipe" subtitle={`${tasks.length} tâche(s)`} icon="check-circle" />
            {tasks.length === 0 ? (
              <EmptyState icon="check-circle" title="Aucune tâche" description="Créez une tâche pour répartir le travail et suivre l'avancement." />
            ) : (
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Tâche</th>
                      <th>Assignée à</th>
                      <th>Échéance</th>
                      <th>Priorité</th>
                      <th>Statut</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((task) => {
                      const late = task.status !== "done" && task.due_date && task.due_date < new Date().toISOString().slice(0, 10);
                      return (
                        <tr key={task.id}>
                          <td>
                            <p className="text-[12.5px] font-medium text-ink-900">{task.title}</p>
                            {task.content_title ? (
                              <Link href={`/app/content/${task.content_id}`} className="text-[10.5px] text-brand-700 hover:underline">
                                Contenu : {task.content_title}
                              </Link>
                            ) : null}
                            {task.campaign_title ? <p className="text-[10.5px] text-ink-400">Campagne : {task.campaign_title}</p> : null}
                          </td>
                          <td className="text-[11.5px] text-ink-600">{task.assignee ?? "—"}</td>
                          <td className={late ? "text-[11.5px] font-medium text-rose-600" : "text-[11.5px] text-ink-500"}>
                            {task.due_date ? formatDate(task.due_date) : "—"}
                          </td>
                          <td className="text-[11.5px] text-ink-600">{task.priority}</td>
                          <td><Badge status={task.status}>{labelOf(TASK_STATUSES, task.status)}</Badge></td>
                          <td>
                            <div className="flex flex-wrap items-center justify-end gap-1">
                              {Object.entries(TASK_STATUSES)
                                .filter(([key]) => key !== task.status)
                                .map(([key, label]) => (
                                  <form key={key} action={setTaskStatusAction}>
                                    <input type="hidden" name="id" value={task.id} />
                                    <input type="hidden" name="status" value={key} />
                                    <button type="submit" className="btn btn-sm">{label}</button>
                                  </form>
                                ))}
                              {canManage ? (
                                <form action={deleteTaskAction}>
                                  <input type="hidden" name="id" value={task.id} />
                                  <ConfirmSubmit message="Supprimer ?">Supprimer</ConfirmSubmit>
                                </form>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {tab === "permissions" ? (
        <div className="space-y-3">
          <Tabs
            items={COMPANY_ROLES.map((role) => ({
              label: ROLE_LABELS[role],
              href: `/app/team?tab=permissions&role=${role}`,
              active: roleParam === role,
            }))}
          />
          {roleParam === "owner" ? (
            <Alert tone="info" title="Le rôle Propriétaire conserve tous les droits">
              Les permissions du propriétaire ne peuvent pas être retirées afin de garantir l&apos;administration de l&apos;entreprise.
            </Alert>
          ) : (
            <Card>
              <CardHeader
                title={`Permissions — ${ROLE_LABELS[roleParam]}`}
                subtitle="Les modifications s'appliquent immédiatement aux membres de ce rôle"
                icon="shield"
              />
              <form action={saveRolePermissionsAction} className="space-y-4">
                <input type="hidden" name="role" value={roleParam} />
                {permissionGroups().map((group) => (
                  <div key={group.group}>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-500">{group.group}</p>
                    <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                      {group.permissions.map((permission) => (
                        <label
                          key={permission}
                          className={
                            permission === "platform.manage"
                              ? "flex items-center gap-2 rounded-lg border border-ink-100 bg-ink-50 px-2.5 py-1.5 text-[11.5px] text-ink-400"
                              : "flex items-center gap-2 rounded-lg border border-ink-100 px-2.5 py-1.5 text-[11.5px] text-ink-700"
                          }
                        >
                          <input
                            type="checkbox"
                            name="permissions"
                            value={permission}
                            defaultChecked={rolePermissions.has(permission)}
                            disabled={permission === "platform.manage"}
                            className="h-3.5 w-3.5"
                          />
                          {permission}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-2">
                  <p className="hint">
                    {ALL_PERMISSIONS.length} permissions disponibles. La permission platform.manage reste réservée à BATIANA TECH.
                  </p>
                  <button type="submit" className="btn btn-primary" disabled={!canManage}>
                    <Icon name="check" className="h-4 w-4" /> Enregistrer
                  </button>
                </div>
              </form>
            </Card>
          )}
          <Alert tone="info" title="Portée des permissions">
            Chaque action est vérifiée côté serveur : masquer un bouton ne suffit pas. Une permission retirée bloque immédiatement l&apos;action correspondante, y compris via l&apos;API.
          </Alert>
        </div>
      ) : null}
    </>
  );
}
