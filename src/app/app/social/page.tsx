import Link from "next/link";
import { ConfirmSubmit, Disclosure } from "@/components/controls";
import { Icon } from "@/components/icons";
import { Alert, Badge, Card, CardHeader, EmptyState, Flash, PageHeader, StatCard } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { all, get } from "@/lib/db";
import { formatDateTime, labelOf, SOCIAL_STATUSES } from "@/lib/format";
import { SOCIAL_PLATFORMS, isPlatformConfigured, missingEnv, type SocialPlatformId } from "@/lib/social";
import { deleteSocialAccountAction, saveSocialAccountAction, setSocialAccountStatusAction } from "@/server/actions/social";

export const metadata = { title: "Réseaux sociaux" };

const PLATFORM_ICONS: Record<string, string> = {
  facebook: "share",
  instagram: "image",
  whatsapp: "message",
  linkedin: "briefcase",
  tiktok: "play",
  youtube: "play",
};

export default async function SocialPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const user = await requireUser("social.view");
  const companyId = user.companyId!;
  const query = await searchParams;
  const canManage = user.permissions.includes("social.manage");

  const accounts = all<{
    id: string;
    platform: string;
    account_name: string;
    account_ref: string | null;
    page_url: string | null;
    status: string;
    scopes: string | null;
    connected_at: string | null;
    last_sync_at: string | null;
    notes: string | null;
  }>(
    `SELECT id, platform, account_name, account_ref, page_url, status, scopes, connected_at, last_sync_at, notes
     FROM social_accounts WHERE company_id = ? ORDER BY platform, account_name`,
    [companyId]
  );

  const pendingPublications = all<{
    id: string;
    platform: string;
    method: string;
    status: string;
    scheduled_at: string | null;
    published_at: string | null;
    external_url: string | null;
    content_id: string;
    content_title: string;
    account_name: string | null;
  }>(
    `SELECT p.id, p.platform, p.method, p.status, p.scheduled_at, p.published_at, p.external_url,
            p.content_id, c.title AS content_title, s.account_name
     FROM publications p
     JOIN contents c ON c.id = p.content_id
     LEFT JOIN social_accounts s ON s.id = p.social_account_id
     WHERE p.company_id = ? AND p.status <> 'published'
     ORDER BY COALESCE(p.scheduled_at, p.created_at) ASC LIMIT 25`,
    [companyId]
  );

  const publishedCount = get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM publications WHERE company_id = ? AND status = 'published'",
    [companyId]
  )?.n ?? 0;
  const manualCount = get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM publications WHERE company_id = ? AND method = 'manual' AND status = 'published'",
    [companyId]
  )?.n ?? 0;

  const platformIds = Object.keys(SOCIAL_PLATFORMS) as SocialPlatformId[];
  const ready = platformIds.filter((platform) => isPlatformConfigured(platform));

  return (
    <>
      <PageHeader
        title="Réseaux sociaux"
        subtitle="Comptes officiels de l'entreprise, état des autorisations et publications en attente. Aucune publication n'est simulée."
        icon="share"
        actions={
          <Link href="/app/calendar" className="btn">
            <Icon name="calendar" className="h-4 w-4" /> Calendrier éditorial
          </Link>
        }
      />

      <Flash saved={query.saved} error={query.error} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Comptes déclarés" value={accounts.length} icon="share" tone="brand" />
        <StatCard label="Intégrations actives" value={`${ready.length}/${platformIds.length}`} icon="key" tone="emerald" hint="Applications officielles configurées" />
        <StatCard label="Publications en attente" value={pendingPublications.length} icon="clock" tone="accent" />
        <StatCard label="Publications déclarées" value={Number(publishedCount)} icon="check-circle" tone="violet" hint={`dont ${manualCount} en procédure manuelle`} />
      </div>

      <div className="mt-4">
        {ready.length === 0 ? (
          <Alert tone="warning" title="Publication automatique désactivée">
            Aucune application officielle n&apos;est configurée sur ce serveur. Les contenus peuvent être préparés, programmés et suivis, mais leur envoi se fait
            manuellement sur chaque réseau. BATIANA TECH doit enregistrer les applications développeur et fournir les identifiants (voir la liste ci-dessous)
            pour activer la publication automatique.
          </Alert>
        ) : (
          <Alert tone="success" title="Publication automatique disponible">
            {ready.length} plateforme(s) disposent d&apos;identifiants officiels configurés : {ready.map((platform) => SOCIAL_PLATFORMS[platform].label).join(", ")}.
            Les autres restent en procédure manuelle.
          </Alert>
        )}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {platformIds.map((platform) => {
          const meta = SOCIAL_PLATFORMS[platform];
          const configured = isPlatformConfigured(platform);
          const missing = missingEnv(platform);
          return (
            <Card key={platform} className="animate-rise">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-700">
                    <Icon name={PLATFORM_ICONS[platform] ?? "share"} className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[13.5px] font-semibold text-ink-900">{meta.label}</p>
                    <p className="text-[11px] text-ink-400">{meta.api}</p>
                  </div>
                </div>
                <Badge status={configured ? "connected" : "not_configured"}>
                  {configured ? "Intégration active" : "Configuration requise"}
                </Badge>
              </div>

              <div className="mt-3 rounded-xl border border-ink-100 bg-ink-50/70 p-2.5">
                <p className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-500">Variables d&apos;environnement</p>
                <ul className="mt-1 space-y-0.5">
                  {meta.env.map((key) => (
                    <li key={key} className="flex items-center justify-between gap-2 text-[11px]">
                      <code className="truncate text-ink-700">{key}</code>
                      {missing.includes(key) ? (
                        <span className="text-rose-600">manquant</span>
                      ) : (
                        <span className="text-emerald-600">défini</span>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-[10.5px] text-ink-400">Autorisations : {meta.scopes.join(", ")}</p>
              </div>

              <details className="mt-2">
                <summary className="cursor-pointer text-[11.5px] font-medium text-brand-700">Procédure manuelle de secours</summary>
                <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-[11.5px] leading-relaxed text-ink-600">
                  {meta.manualSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </details>

              <a href={meta.docs} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-medium text-brand-700 hover:underline">
                <Icon name="external" className="h-3 w-3" /> Documentation officielle
              </a>
            </Card>
          );
        })}
      </div>

      {canManage ? (
        <div className="mt-4">
          <Disclosure title="Déclarer un compte social">
            <form action={saveSocialAccountAction} className="card card-pad grid gap-3 md:grid-cols-2">
              <div>
                <label className="label" htmlFor="platform">Plateforme *</label>
                <select id="platform" name="platform" className="input" defaultValue="facebook" required>
                  {platformIds.map((platform) => (
                    <option key={platform} value={platform}>{SOCIAL_PLATFORMS[platform].label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="accountName">Nom du compte / de la page *</label>
                <input id="accountName" name="accountName" required className="input" placeholder="Ex. SHALO COM SPACE Officiel" />
              </div>
              <div>
                <label className="label" htmlFor="accountRef">Identifiant technique</label>
                <input id="accountRef" name="accountRef" className="input" placeholder="ID de page, de compte professionnel…" />
              </div>
              <div>
                <label className="label" htmlFor="pageUrl">Adresse publique</label>
                <input id="pageUrl" name="pageUrl" type="url" className="input" placeholder="https://facebook.com/…" />
              </div>
              <div className="md:col-span-2">
                <label className="label" htmlFor="token">Jeton d&apos;accès (facultatif)</label>
                <input id="token" name="token" type="password" autoComplete="off" className="input" placeholder="Chiffré en base, jamais renvoyé au navigateur" />
                <p className="hint">Le jeton n&apos;est utile que si l&apos;application officielle est déjà configurée. Sinon, le compte reste « en attente ».</p>
              </div>
              <div className="md:col-span-2">
                <label className="label" htmlFor="notes">Notes</label>
                <textarea id="notes" name="notes" rows={2} className="input" placeholder="Responsable du compte, conditions d'accès…" />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <button type="submit" className="btn btn-primary">
                  <Icon name="check" className="h-4 w-4" /> Enregistrer le compte
                </button>
              </div>
            </form>
          </Disclosure>
        </div>
      ) : null}

      <Card className="mt-4">
        <CardHeader title="Comptes de l'entreprise" subtitle={`${accounts.length} compte(s) déclaré(s)`} icon="share" />
        {accounts.length === 0 ? (
          <EmptyState
            icon="share"
            title="Aucun compte social déclaré"
            description="Déclarez les pages officielles de l'entreprise pour rattacher les contenus et suivre les publications."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Plateforme</th>
                  <th>Compte</th>
                  <th>Statut</th>
                  <th>Dernière action</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id}>
                    <td className="text-[12.5px] font-medium text-ink-800">
                      {SOCIAL_PLATFORMS[account.platform as SocialPlatformId]?.label ?? account.platform}
                    </td>
                    <td>
                      <p className="text-[12.5px] text-ink-800">{account.account_name}</p>
                      {account.page_url ? (
                        <a href={account.page_url} target="_blank" rel="noreferrer" className="text-[11px] text-brand-700 hover:underline">
                          {account.page_url.replace(/^https?:\/\//, "")}
                        </a>
                      ) : (
                        <p className="text-[11px] text-ink-400">{account.account_ref ?? "identifiant non renseigné"}</p>
                      )}
                    </td>
                    <td><Badge status={account.status}>{labelOf(SOCIAL_STATUSES, account.status)}</Badge></td>
                    <td className="text-[11.5px] text-ink-500">
                      {account.connected_at ? `Connecté le ${formatDateTime(account.connected_at)}` : "Jamais connecté"}
                    </td>
                    <td>
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        {canManage && account.status !== "connected" ? (
                          <form action={setSocialAccountStatusAction}>
                            <input type="hidden" name="id" value={account.id} />
                            <input type="hidden" name="status" value="connected" />
                            <button type="submit" className="btn btn-sm">Marquer connecté</button>
                          </form>
                        ) : null}
                        {canManage && account.status !== "pending" ? (
                          <form action={setSocialAccountStatusAction}>
                            <input type="hidden" name="id" value={account.id} />
                            <input type="hidden" name="status" value="pending" />
                            <button type="submit" className="btn btn-sm">Remettre en attente</button>
                          </form>
                        ) : null}
                        {canManage && account.status !== "disconnected" ? (
                          <form action={setSocialAccountStatusAction}>
                            <input type="hidden" name="id" value={account.id} />
                            <input type="hidden" name="status" value="disconnected" />
                            <button type="submit" className="btn btn-sm">Déconnecter</button>
                          </form>
                        ) : null}
                        {canManage ? (
                          <form action={deleteSocialAccountAction}>
                            <input type="hidden" name="id" value={account.id} />
                            <ConfirmSubmit message="Supprimer ce compte ?">Supprimer</ConfirmSubmit>
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

      <Card className="mt-3">
        <CardHeader title="Publications en attente" subtitle="Contenus programmés ou à publier manuellement" icon="clock" />
        {pendingPublications.length === 0 ? (
          <p className="text-[12px] text-ink-500">
            Aucune publication en attente. Programmez un contenu depuis le studio pour le voir apparaître ici.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Contenu</th>
                  <th>Plateforme</th>
                  <th>Méthode</th>
                  <th>Programmé pour</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {pendingPublications.map((publication) => (
                  <tr key={publication.id}>
                    <td>
                      <Link href={`/app/content/${publication.content_id}`} className="font-medium text-ink-900 hover:text-brand-700">
                        {publication.content_title}
                      </Link>
                      <p className="text-[11px] text-ink-400">{publication.account_name ?? "compte non rattaché"}</p>
                    </td>
                    <td className="text-[12px] text-ink-600">{publication.platform}</td>
                    <td>
                      <Badge status={publication.method === "api" ? "connected" : "planned"}>
                        {publication.method === "api" ? "API officielle" : "Manuelle"}
                      </Badge>
                    </td>
                    <td className="text-[11.5px] text-ink-500">{publication.scheduled_at ? formatDateTime(publication.scheduled_at) : "—"}</td>
                    <td className="text-[11.5px] text-ink-500">{publication.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint">
          Une publication n&apos;est jamais marquée « publiée » automatiquement. L&apos;équipe confirme l&apos;envoi réel depuis la fiche du contenu.
        </p>
      </Card>
    </>
  );
}
