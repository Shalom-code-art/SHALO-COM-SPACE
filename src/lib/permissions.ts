/**
 * Matrice des roles et permissions de SHALO COM SPACE.
 * Les valeurs par defaut peuvent etre surchargees par entreprise
 * (table role_permissions, page Parametres > Roles).
 */

export const ROLES = {
  owner: "Administrateur principal",
  communication_manager: "Responsable communication",
  editor: "Editeur",
  designer: "Graphiste",
  community_manager: "Community manager",
  analyst: "Analyste",
  viewer: "Lecteur",
} as const;

export type CompanyRole = keyof typeof ROLES;
export type Role = CompanyRole | "platform_admin";

export const ROLE_LABELS: Record<Role, string> = {
  ...ROLES,
  platform_admin: "Administrateur BATIANA TECH",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: "Acces complet a l'espace de l'entreprise, gestion des abonnements et des acces.",
  communication_manager: "Pilote la strategie, valide les contenus et encadre l'equipe.",
  editor: "Redige et prepare les contenus, sans validation finale.",
  designer: "Produit les visuels et gere la mediatheque.",
  community_manager: "Anime les reseaux sociaux et les contacts clients.",
  analyst: "Consulte et produit les rapports de performance.",
  viewer: "Consultation seule.",
  platform_admin: "Administration de la plateforme BATIANA TECH (sans acces automatique aux contenus clients).",
};

export const PERMISSIONS = {
  "dashboard.view": "Consulter le tableau de bord",
  "ai.use": "Utiliser le Centre IA",
  "content.view": "Consulter les contenus",
  "content.create": "Creer des contenus",
  "content.edit": "Modifier des contenus",
  "content.delete": "Supprimer des contenus",
  "content.publish": "Programmer / publier des contenus",
  "content.approve": "Valider les contenus",
  "calendar.view": "Consulter le calendrier editorial",
  "calendar.manage": "Gerer le calendrier editorial",
  "social.view": "Consulter les comptes sociaux",
  "social.manage": "Connecter et gerer les comptes sociaux",
  "campaign.view": "Consulter les campagnes",
  "campaign.manage": "Gerer les campagnes",
  "contacts.clients.view": "Consulter les contacts clients",
  "contacts.clients.manage": "Gerer les contacts clients",
  "contacts.employees.view": "Consulter les contacts collaborateurs",
  "contacts.employees.manage": "Gerer les contacts collaborateurs",
  "catalog.view": "Consulter le catalogue",
  "catalog.manage": "Gerer le catalogue",
  "media.view": "Consulter la mediatheque",
  "media.manage": "Importer et organiser des fichiers",
  "media.delete": "Supprimer des fichiers",
  "analytics.view": "Consulter les analyses",
  "analytics.manage": "Saisir des releves de performance",
  "analytics.export": "Exporter les rapports",
  "team.view": "Consulter l'equipe",
  "team.manage": "Inviter et gerer les collaborateurs",
  "settings.view": "Consulter les parametres",
  "settings.manage": "Modifier les parametres",
  "audit.view": "Consulter le journal d'audit",
  "apikeys.manage": "Gerer les cles API",
  "platform.manage": "Administrer la plateforme BATIANA TECH",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

const EDITOR_BASE: Permission[] = [
  "dashboard.view",
  "ai.use",
  "content.view",
  "content.create",
  "content.edit",
  "calendar.view",
  "calendar.manage",
  "campaign.view",
  "contacts.clients.view",
  "catalog.view",
  "media.view",
  "media.manage",
  "analytics.view",
  "team.view",
];

export const DEFAULT_ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: ALL_PERMISSIONS.filter((p) => p !== "platform.manage"),
  communication_manager: ALL_PERMISSIONS.filter((p) => !["apikeys.manage", "platform.manage"].includes(p)),
  community_manager: [
    "dashboard.view",
    "ai.use",
    "content.view",
    "content.create",
    "content.edit",
    "content.publish",
    "calendar.view",
    "calendar.manage",
    "social.view",
    "social.manage",
    "campaign.view",
    "campaign.manage",
    "contacts.clients.view",
    "contacts.clients.manage",
    "catalog.view",
    "media.view",
    "media.manage",
    "analytics.view",
    "team.view",
  ],
  editor: EDITOR_BASE,
  designer: [
    "dashboard.view",
    "ai.use",
    "content.view",
    "content.create",
    "content.edit",
    "calendar.view",
    "campaign.view",
    "catalog.view",
    "catalog.manage",
    "media.view",
    "media.manage",
    "media.delete",
    "analytics.view",
    "team.view",
  ],
  analyst: [
    "dashboard.view",
    "analytics.view",
    "analytics.manage",
    "analytics.export",
    "campaign.view",
    "content.view",
    "social.view",
    "contacts.clients.view",
    "catalog.view",
    "media.view",
    "team.view",
  ],
  viewer: [
    "dashboard.view",
    "content.view",
    "calendar.view",
    "campaign.view",
    "catalog.view",
    "media.view",
    "analytics.view",
    "team.view",
  ],
  platform_admin: ["platform.manage"],
};

export const COMPANY_ROLES = Object.keys(ROLES) as CompanyRole[];

export function effectivePermissions(
  role: Role,
  overrides: { permission: string; allowed: number }[] = []
): Permission[] {
  const set = new Set<string>(DEFAULT_ROLE_PERMISSIONS[role] ?? []);
  for (const override of overrides) {
    if (override.allowed) set.add(override.permission);
    else set.delete(override.permission);
  }
  return ALL_PERMISSIONS.filter((p) => set.has(p));
}

export function hasPermission(permissions: string[], permission: Permission | Permission[]): boolean {
  const list = Array.isArray(permission) ? permission : [permission];
  return list.some((p) => permissions.includes(p));
}

export function permissionGroups(): { group: string; permissions: Permission[] }[] {
  const groups: Record<string, Permission[]> = {
    "Pilotage": ["dashboard.view", "ai.use"],
    "Contenus": ["content.view", "content.create", "content.edit", "content.delete", "content.publish", "content.approve"],
    "Calendrier": ["calendar.view", "calendar.manage"],
    "Reseaux sociaux": ["social.view", "social.manage"],
    "Campagnes": ["campaign.view", "campaign.manage"],
    "Contacts": [
      "contacts.clients.view",
      "contacts.clients.manage",
      "contacts.employees.view",
      "contacts.employees.manage",
    ],
    "Catalogue": ["catalog.view", "catalog.manage"],
    "Mediatheque": ["media.view", "media.manage", "media.delete"],
    "Analytics": ["analytics.view", "analytics.manage", "analytics.export"],
    "Equipe": ["team.view", "team.manage"],
    "Administration": ["settings.view", "settings.manage", "audit.view", "apikeys.manage"],
  };
  return Object.entries(groups).map(([group, permissions]) => ({ group, permissions }));
}
