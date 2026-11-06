import Link from "next/link";
import { ConfirmSubmit, CopyButton } from "@/components/controls";
import { Icon } from "@/components/icons";
import { Alert, Badge, Card, CardHeader, Flash, InfoRow, PageHeader, Progress, StatCard, Tabs } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { all, count, get } from "@/lib/db";
import { formatBytes, formatDateTime } from "@/lib/format";
import { storageUsage } from "@/lib/media";
import { getSettings, resolveAiConfig } from "@/lib/settings";
import { AI_PROVIDERS, type AiProviderId } from "@/lib/ai-providers";
import { SOCIAL_PLATFORMS, isPlatformConfigured, missingEnv, type SocialPlatformId } from "@/lib/social";
import {
  changePasswordAction,
  createApiKeyAction,
  requestDataDeletionAction,
  revokeApiKeyAction,
  revokeOtherSessionsAction,
  saveAiSettingsAction,
  saveCompanyProfileAction,
  saveNotificationPreferencesAction,
} from "@/server/actions/settings";

export const metadata = { title: "Paramètres" };

const SECTIONS = [
  { id: "company", label: "Entreprise" },
  { id: "ai", label: "Intelligence artificielle" },
  { id: "notifications", label: "Notifications" },
  { id: "security", label: "Sécurité" },
  { id: "api", label: "Clés API" },
  { id: "data", label: "Données" },
  { id: "audit", label: "Journal d'audit" },
];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; saved?: string; error?: string; created?: string }>;
}) {
  const user = await requireUser("settings.view");
  const companyId = user.companyId!;
  const query = await searchParams;
  const section = SECTIONS.some((item) => item.id === query.section) ? query.section! : "company";
  const canManage = user.permissions.includes("settings.manage");
  const canAudit = user.permissions.includes("audit.view");
  const canApi = user.permissions.includes("apikeys.manage");

  const company = get<Record<string, unknown>>("SELECT * FROM companies WHERE id = ?", [companyId]);
  const settings = getSettings(companyId);
  const ai = resolveAiConfig(companyId);
  const usage = storageUsage(companyId);

  const logoImages = all<{ id: string; name: string }>(
    "SELECT id, name FROM media WHERE company_id = ? AND kind = 'image' ORDER BY created_at DESC LIMIT 60",
    [companyId]
  );
  const apiKeys = all<{ id: string; name: string; prefix: string; last_used_at: string | null; revoked_at: string | null; created_at: string }>(
    "SELECT id, name, prefix, last_used_at, revoked_at, created_at FROM api_keys WHERE company_id = ? ORDER BY created_at DESC",
    [companyId]
  );
  const sessions = count(
    "SELECT COUNT(*) AS n FROM sessions WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ?",
    [user.id, new Date().toISOString()]
  );
  const auditLogs = canAudit
    ? all<{ id: string; actor_name: string | null; action: string; entity: string; details: string | null; ip: string | null; created_at: string }>(
        "SELECT id, actor_name, action, entity, details, ip, created_at FROM audit_logs WHERE company_id = ? ORDER BY created_at DESC LIMIT 60",
        [companyId]
      )
    : [];

  const activeNotifications = (key: string) => (settings[`notifications.${key}`] ?? "on") !== "off";
  const companyValue = (key: string) => String(company?.[key] ?? "");

  return (
    <>
      <PageHeader
        title="Paramètres"
        subtitle="Identité de l'entreprise, intelligence artificielle, sécurité, clés API, données et traçabilité."
        icon="settings"
        actions={
          <Link href="/app/team" className="btn">
            <Icon name="user-plus" className="h-4 w-4" /> Équipe & rôles
          </Link>
        }
      />

      <Flash saved={query.saved} error={query.error} />

      <Tabs items={SECTIONS.map((item) => ({ label: item.label, href: `/app/settings?section=${item.id}`, active: section === item.id }))} />

      {section === "company" ? (
        <div className="grid gap-3 xl:grid-cols-[1.5fr_1fr]">
          <Card>
            <CardHeader title="Informations de l'entreprise" subtitle="Ces informations apparaissent sur vos documents et la vitrine publique" icon="building" />
            {canManage ? (
              <form action={saveCompanyProfileAction} className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="label" htmlFor="name">Nom commercial *</label>
                  <input id="name" name="name" required defaultValue={companyValue("name")} className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="legalName">Raison sociale</label>
                  <input id="legalName" name="legalName" defaultValue={companyValue("legal_name")} className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="email">Email public</label>
                  <input id="email" name="email" type="email" defaultValue={companyValue("email")} className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="phone">Téléphone / WhatsApp</label>
                  <input id="phone" name="phone" defaultValue={companyValue("phone")} className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="address">Adresse</label>
                  <input id="address" name="address" defaultValue={companyValue("address")} className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="city">Ville</label>
                  <input id="city" name="city" defaultValue={companyValue("city")} className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="country">Pays</label>
                  <input id="country" name="country" defaultValue={companyValue("country")} className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="website">Site web</label>
                  <input id="website" name="website" defaultValue={companyValue("website")} className="input" placeholder="https://" />
                </div>
                <div>
                  <label className="label" htmlFor="primaryColor">Couleur principale</label>
                  <input id="primaryColor" name="primaryColor" type="color" defaultValue={companyValue("primary_color") || "#0f2c52"} className="input h-10 p-1" />
                </div>
                <div>
                  <label className="label" htmlFor="secondaryColor">Couleur secondaire</label>
                  <input id="secondaryColor" name="secondaryColor" type="color" defaultValue={companyValue("secondary_color") || "#f97316"} className="input h-10 p-1" />
                </div>
                <div className="md:col-span-2">
                  <label className="label" htmlFor="logoMediaId">Logo (médiathèque)</label>
                  <select id="logoMediaId" name="logoMediaId" className="input" defaultValue={settings["brand.logo_media_id"] ?? ""}>
                    <option value="">Conserver le logo actuel</option>
                    {logoImages.map((image) => (
                      <option key={image.id} value={image.id}>{image.name}</option>
                    ))}
                  </select>
                  <label className="mt-2 flex items-center gap-2 text-[11.5px] text-ink-500">
                    <input type="checkbox" name="removeLogo" value="1" className="h-3.5 w-3.5" /> Supprimer le logo actuel
                  </label>
                </div>
                <div className="md:col-span-2 rounded-xl border border-ink-200 bg-ink-50/70 p-3">
                  <p className="mb-2 text-[12px] font-semibold text-ink-800">Vitrine publique</p>
                  <label className="flex items-center gap-2 text-[12px] text-ink-700">
                    <input type="checkbox" name="shopEnabled" defaultChecked={Boolean(Number(companyValue("shop_enabled"))) } className="h-3.5 w-3.5" />
                    Activer la vitrine publique du catalogue
                  </label>
                  <div className="mt-2">
                    <label className="label" htmlFor="shopTagline">Accroche de la vitrine</label>
                    <input id="shopTagline" name="shopTagline" defaultValue={companyValue("shop_tagline")} className="input" maxLength={200} />
                  </div>
                  <div className="mt-2">
                    <label className="label" htmlFor="shopAbout">Présentation</label>
                    <textarea id="shopAbout" name="shopAbout" rows={3} defaultValue={companyValue("shop_about")} className="input" />
                  </div>
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <button type="submit" className="btn btn-primary">
                    <Icon name="check" className="h-4 w-4" /> Enregistrer
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <InfoRow label="Nom" value={companyValue("name")} />
                <InfoRow label="Email" value={companyValue("email") || "—"} />
                <InfoRow label="Téléphone" value={companyValue("phone") || "—"} />
                <InfoRow label="Adresse" value={[companyValue("address"), companyValue("city"), companyValue("country")].filter(Boolean).join(", ") || "—"} />
              </div>
            )}
          </Card>

          <div className="space-y-3">
            <Card>
              <CardHeader title="Abonnement & stockage" icon="database" />
              <InfoRow label="Formule" value={<Badge status="planned">{String(company?.plan ?? "standard")}</Badge>} />
              <InfoRow label="Statut" value={String(company?.subscription_status ?? "—")} />
              <InfoRow label="Quota de stockage" value={`${usage.quotaMb} Mo`} />
              <InfoRow label="Fichiers" value={usage.fileCount} />
              <div className="mt-2">
                <Progress value={usage.percent} tone={usage.percent > 85 ? "rose" : "brand"} />
                <p className="hint">{formatBytes(usage.usedBytes)} utilisés · {formatBytes(usage.remainingBytes)} restants</p>
              </div>
              <p className="hint">Pour augmenter le quota ou changer de formule, contactez BATIANA TECH.</p>
            </Card>
            <Card>
              <CardHeader title="Vitrine publique" subtitle="Lien à partager" icon="globe" />
              <div className="flex flex-wrap items-center gap-2">
                <code className="truncate rounded-lg bg-ink-100 px-2 py-1 text-[11.5px]">/boutique/{companyValue("slug")}</code>
                <CopyButton text={`/boutique/${companyValue("slug")}`} label="Copier" />
                <Link href={`/boutique/${companyValue("slug")}`} target="_blank" className="btn btn-sm">
                  <Icon name="external" className="h-3.5 w-3.5" /> Ouvrir
                </Link>
              </div>
              <p className="hint">La vitrine affiche uniquement les produits marqués « publics » et les informations de contact de l&apos;entreprise.</p>
            </Card>
          </div>
        </div>
      ) : null}

      {section === "ai" ? (
        <div className="grid gap-3 xl:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHeader title="Fournisseur d'intelligence artificielle" subtitle="La clé est chiffrée en base et n'est jamais renvoyée au navigateur" icon="sparkles" />
            {canManage ? (
              <form action={saveAiSettingsAction} className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="label" htmlFor="provider">Fournisseur</label>
                  <select id="provider" name="provider" defaultValue={ai.provider} className="input">
                    {(Object.keys(AI_PROVIDERS) as AiProviderId[]).map((id) => (
                      <option key={id} value={id} disabled={AI_PROVIDERS[id].status === "planned"}>
                        {AI_PROVIDERS[id].label}
                        {AI_PROVIDERS[id].status === "planned" ? " (bientôt disponible)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="model">Modèle</label>
                  <input id="model" name="model" defaultValue={ai.model} className="input" />
                </div>
                <div className="md:col-span-2">
                  <label className="label" htmlFor="baseUrl">Adresse de l&apos;API</label>
                  <input id="baseUrl" name="baseUrl" defaultValue={ai.baseUrl} className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="temperature">Créativité (0 → 1,5)</label>
                  <input id="temperature" name="temperature" type="number" min="0" max="1.5" step="0.1" defaultValue={ai.temperature} className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="apiKey">Clé API</label>
                  <input id="apiKey" name="apiKey" type="password" autoComplete="off" className="input" placeholder={ai.configured ? "Clé déjà configurée — laisser vide pour conserver" : "Saisir la clé du fournisseur"} />
                </div>
                <label className="md:col-span-2 flex items-center gap-2 text-[11.5px] text-ink-500">
                  <input type="checkbox" name="clearKey" value="1" className="h-3.5 w-3.5" /> Supprimer la clé enregistrée pour cette entreprise
                </label>
                <div className="md:col-span-2 flex justify-end">
                  <button type="submit" className="btn btn-primary">
                    <Icon name="check" className="h-4 w-4" /> Enregistrer
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <InfoRow label="Fournisseur" value={AI_PROVIDERS[ai.provider].label} />
                <InfoRow label="Modèle" value={ai.model} />
                <InfoRow label="Clé" value={ai.configured ? `configurée (${ai.keySource})` : "non configurée"} />
              </div>
            )}
          </Card>
          <div className="space-y-3">
            <Card>
              <CardHeader title="État de l'intégration" icon="key" />
              <InfoRow label="Statut" value={ai.configured ? <Badge status="connected">Opérationnel</Badge> : <Badge status="not_configured">Configuration requise</Badge>} />
              <InfoRow label="Origine de la clé" value={ai.keySource === "company" ? "Entreprise" : ai.keySource === "environment" ? "Serveur (éditeur)" : "Aucune"} />
              <InfoRow label="Fournisseur" value={AI_PROVIDERS[ai.provider].label} />
              <p className="hint">{AI_PROVIDERS[ai.provider].note}</p>
              <a href={AI_PROVIDERS[ai.provider].docsUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-medium text-brand-700 hover:underline">
                <Icon name="external" className="h-3 w-3" /> Documentation du fournisseur
              </a>
            </Card>
            {!ai.configured ? (
              <Alert tone="warning" title="Centre IA inactif">
                Sans clé API valide, le Centre IA affiche un message explicite et ne génère aucun texte. Aucune réponse n&apos;est simulée.
              </Alert>
            ) : null}
          </div>
        </div>
      ) : null}

      {section === "notifications" ? (
        <Card className="max-w-2xl">
          <CardHeader title="Notifications internes" subtitle="Choisissez les événements qui alimentent la cloche et le fil d'activité" icon="bell" />
          {canManage ? (
            <form action={saveNotificationPreferencesAction} className="space-y-3">
              {[
                { key: "content", label: "Contenus", hint: "Soumission pour validation, publication, commentaires" },
                { key: "campaign", label: "Campagnes", hint: "Changements de statut et échéances" },
                { key: "team", label: "Équipe", hint: "Invitations, nouvelles tâches assignées" },
                { key: "social", label: "Réseaux sociaux", hint: "Comptes déclarés, publications en attente" },
                { key: "alert", label: "Alertes sensibles", hint: "Demandes de suppression, incidents de sécurité" },
              ].map((item) => (
                <label key={item.key} className="flex items-start gap-2.5 rounded-xl border border-ink-200 p-3">
                  <input type="checkbox" name={`notify_${item.key}`} defaultChecked={activeNotifications(item.key)} className="mt-0.5 h-3.5 w-3.5" />
                  <span>
                    <span className="block text-[12.5px] font-medium text-ink-800">{item.label}</span>
                    <span className="block text-[11px] text-ink-500">{item.hint}</span>
                  </span>
                </label>
              ))}
              <div className="flex justify-end">
                <button type="submit" className="btn btn-primary">
                  <Icon name="check" className="h-4 w-4" /> Enregistrer
                </button>
              </div>
            </form>
          ) : (
            <p className="text-[12px] text-ink-500">Vous n&apos;avez pas la permission de modifier ces préférences.</p>
          )}
        </Card>
      ) : null}

      {section === "security" ? (
        <div className="grid gap-3 xl:grid-cols-2">
          <Card>
            <CardHeader title="Mot de passe" subtitle={`Connecté en tant que ${user.email}`} icon="lock" />
            <form action={changePasswordAction} className="space-y-3">
              <div>
                <label className="label" htmlFor="currentPassword">Mot de passe actuel</label>
                <input id="currentPassword" name="currentPassword" type="password" required autoComplete="current-password" className="input" />
              </div>
              <div>
                <label className="label" htmlFor="newPassword">Nouveau mot de passe</label>
                <input id="newPassword" name="newPassword" type="password" minLength={8} required autoComplete="new-password" className="input" />
              </div>
              <div>
                <label className="label" htmlFor="confirmPassword">Confirmation</label>
                <input id="confirmPassword" name="confirmPassword" type="password" minLength={8} required autoComplete="new-password" className="input" />
              </div>
              <div className="flex justify-end">
                <button type="submit" className="btn btn-primary">
                  <Icon name="check" className="h-4 w-4" /> Mettre à jour
                </button>
              </div>
            </form>
          </Card>
          <div className="space-y-3">
            <Card>
              <CardHeader title="Sessions actives" icon="shield" />
              <InfoRow label="Sessions ouvertes" value={sessions} />
              <InfoRow label="Expiration" value="7 jours" />
              <form action={revokeOtherSessionsAction} className="mt-3 flex justify-end">
                <ConfirmSubmit message="Fermer toutes les sessions, y compris celle-ci ?">Révoquer toutes les sessions</ConfirmSubmit>
              </form>
            </Card>
            <Alert tone="info" title="Bonnes pratiques">
              <ul className="ml-1 list-disc space-y-1 pl-4">
                <li>Les mots de passe sont hachés avec scrypt et ne sont jamais stockés en clair.</li>
                <li>Les tentatives de connexion échouées sont limitées par compte et par adresse IP.</li>
                <li>Chaque action sensible est enregistrée dans le journal d&apos;audit.</li>
              </ul>
            </Alert>
          </div>
        </div>
      ) : null}

      {section === "api" ? (
        <div className="space-y-3">
          {query.created ? (
            <Alert tone="success" title="Clé API créée">
              <p className="mb-2">Copiez cette clé maintenant : elle ne sera plus affichée.</p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="max-w-full truncate rounded-lg bg-white/70 px-2 py-1 text-[11.5px] text-ink-800">{query.created}</code>
                <CopyButton text={query.created} label="Copier la clé" />
              </div>
            </Alert>
          ) : null}
          <Card>
            <CardHeader title="Clés API" subtitle="Accès programmatique en lecture aux données de l'entreprise" icon="key" />
            {canApi ? (
              <form action={createApiKeyAction} className="mb-4 flex flex-wrap items-end gap-2">
                <div className="flex-1">
                  <label className="label" htmlFor="key-name">Nom de la clé</label>
                  <input id="key-name" name="name" required className="input" placeholder="Ex. Intégration site web" />
                </div>
                <button type="submit" className="btn btn-primary">
                  <Icon name="plus" className="h-4 w-4" /> Générer
                </button>
              </form>
            ) : null}
            {apiKeys.length === 0 ? (
              <p className="text-[12px] text-ink-500">Aucune clé API. Les clés permettent uniquement la lecture des données autorisées.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Nom</th>
                      <th>Préfixe</th>
                      <th>Créée le</th>
                      <th>Dernière utilisation</th>
                      <th>État</th>
                      {canApi ? <th className="text-right">Actions</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {apiKeys.map((key) => (
                      <tr key={key.id}>
                        <td className="text-[12.5px] text-ink-800">{key.name}</td>
                        <td><code className="text-[11px] text-ink-600">{key.prefix}…</code></td>
                        <td className="text-[11px] text-ink-500">{formatDateTime(key.created_at)}</td>
                        <td className="text-[11px] text-ink-500">{key.last_used_at ? formatDateTime(key.last_used_at) : "jamais"}</td>
                        <td>{key.revoked_at ? <Badge status="cancelled">Révoquée</Badge> : <Badge status="active">Active</Badge>}</td>
                        {canApi ? (
                          <td>
                            {key.revoked_at ? null : (
                              <form action={revokeApiKeyAction} className="flex justify-end">
                                <input type="hidden" name="id" value={key.id} />
                                <ConfirmSubmit message="Révoquer cette clé ?">Révoquer</ConfirmSubmit>
                              </form>
                            )}
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="hint">
              Utilisez l&apos;en-tête <code>Authorization: Bearer &lt;clé&gt;</code> sur les routes <code>/api/v1/*</code>. Les clés n&apos;ont jamais accès aux autres entreprises.
            </p>
          </Card>
        </div>
      ) : null}

      {section === "data" ? (
        <div className="grid gap-3 xl:grid-cols-2">
          <Card>
            <CardHeader title="Exporter vos données" subtitle="Sauvegarde complète au format JSON" icon="download" />
            <p className="text-[12.5px] leading-relaxed text-ink-600">
              L&apos;export contient les contenus, campagnes, contacts, produits, médias (métadonnées), comptes sociaux et paramètres de l&apos;entreprise.
              Il n&apos;inclut jamais les mots de passe ni les clés chiffrées.
            </p>
            <div className="mt-3">
              <Link href="/api/v1/export/data" className="btn btn-primary" prefetch={false}>
                <Icon name="download" className="h-4 w-4" /> Télécharger l&apos;export JSON
              </Link>
            </div>
          </Card>
          <Card>
            <CardHeader title="Suppression de compte" subtitle="Action irréversible" icon="alert" />
            <p className="text-[12.5px] leading-relaxed text-ink-600">
              La suppression de l&apos;entreprise et de toutes ses données est traitée par BATIANA TECH après vérification d&apos;identité,
              conformément aux engagements de confidentialité. Saisissez <strong>SUPPRIMER</strong> pour enregistrer la demande.
            </p>
            {canManage ? (
              <form action={requestDataDeletionAction} className="mt-3 flex flex-wrap items-end gap-2">
                <div>
                  <label className="label" htmlFor="confirm">Confirmation</label>
                  <input id="confirm" name="confirm" required className="input" placeholder="SUPPRIMER" />
                </div>
                <button type="submit" className="btn btn-danger">
                  <Icon name="trash" className="h-4 w-4" /> Demander la suppression
                </button>
              </form>
            ) : null}
          </Card>
        </div>
      ) : null}

      {section === "audit" ? (
        <Card>
          <CardHeader title="Journal d'audit" subtitle="60 dernières opérations sensibles" icon="clock" />
          {!canAudit ? (
            <p className="text-[12px] text-ink-500">Votre rôle ne permet pas de consulter le journal d&apos;audit.</p>
          ) : auditLogs.length === 0 ? (
            <p className="text-[12px] text-ink-500">Aucune opération enregistrée.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Acteur</th>
                    <th>Action</th>
                    <th>Objet</th>
                    <th>Détails</th>
                    <th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="text-[11px] text-ink-500">{formatDateTime(log.created_at)}</td>
                      <td className="text-[11.5px] text-ink-700">{log.actor_name ?? "Système"}</td>
                      <td><code className="text-[11px] text-brand-700">{log.action}</code></td>
                      <td className="text-[11px] text-ink-600">{log.entity}</td>
                      <td className="max-w-[260px] truncate text-[11px] text-ink-500" title={log.details ?? ""}>{log.details ?? "—"}</td>
                      <td className="text-[11px] text-ink-400">{log.ip ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <StatCard label="Intégrations réseaux actives" value={`${(Object.keys(SOCIAL_PLATFORMS) as SocialPlatformId[]).filter((platform) => isPlatformConfigured(platform)).length}/6`} icon="share" tone="brand" hint="Applications officielles" />
        <StatCard label="Clés API actives" value={apiKeys.filter((key) => !key.revoked_at).length} icon="key" tone="violet" />
        <StatCard label="Stockage utilisé" value={formatBytes(usage.usedBytes)} icon="database" tone="accent" hint={`sur ${usage.quotaMb} Mo`} />
      </div>

      <Card className="mt-3">
        <CardHeader title="Prérequis techniques" subtitle="À configurer côté serveur par BATIANA TECH" icon="settings" />
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Variables d&apos;environnement</p>
            <ul className="mt-1 space-y-0.5 text-[11.5px] text-ink-600">
              <li><code>APP_SECRET</code> — chiffrement des secrets</li>
              <li><code>DATABASE_PATH</code> — emplacement de la base SQLite</li>
              {Object.entries(SOCIAL_PLATFORMS).map(([platform, meta]) => (
                <li key={platform}>
                  <code>{meta.env[0]}</code> — {meta.label}
                  {missingEnv(platform).length === 0 ? <span className="ml-1 text-emerald-600">défini</span> : <span className="ml-1 text-ink-400">manquant</span>}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Rappels de conformité</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11.5px] text-ink-600">
              <li>Consentement requis avant toute campagne email ou WhatsApp.</li>
              <li>Les données de chaque entreprise sont isolées par <code>company_id</code>.</li>
              <li>Les interventions BATIANA TECH sur un compte client sont journalisées.</li>
            </ul>
          </div>
        </div>
      </Card>
    </>
  );
}
