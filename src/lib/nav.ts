import type { Permission } from "@/lib/permissions";

export type NavItem = { href: string; label: string; icon: string; permission: Permission; exact?: boolean };
export type NavGroup = { label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Pilotage",
    items: [
      { href: "/app", label: "Tableau de bord", icon: "dashboard", permission: "dashboard.view", exact: true },
      { href: "/app/ai", label: "Centre IA", icon: "sparkles", permission: "ai.use" },
    ],
  },
  {
    label: "Production",
    items: [
      { href: "/app/content", label: "Studio de contenus", icon: "pen", permission: "content.view" },
      { href: "/app/calendar", label: "Calendrier éditorial", icon: "calendar", permission: "calendar.view" },
    ],
  },
  {
    label: "Diffusion",
    items: [
      { href: "/app/social", label: "Réseaux sociaux", icon: "share", permission: "social.view" },
      { href: "/app/campaigns", label: "Campagnes", icon: "megaphone", permission: "campaign.view" },
    ],
  },
  {
    label: "Relations",
    items: [
      { href: "/app/contacts", label: "Contacts clients", icon: "users", permission: "contacts.clients.view" },
      { href: "/app/team-contacts", label: "Collaborateurs", icon: "briefcase", permission: "contacts.employees.view" },
    ],
  },
  {
    label: "Commerce",
    items: [
      { href: "/app/catalog", label: "Catalogue & boutique", icon: "store", permission: "catalog.view" },
      { href: "/app/media", label: "Médiathèque", icon: "folder", permission: "media.view" },
    ],
  },
  {
    label: "Analyse",
    items: [{ href: "/app/analytics", label: "Analytics & rapports", icon: "chart", permission: "analytics.view" }],
  },
  {
    label: "Organisation",
    items: [
      { href: "/app/team", label: "Équipe & tâches", icon: "user-plus", permission: "team.view" },
      { href: "/app/settings", label: "Paramètres", icon: "settings", permission: "settings.view" },
    ],
  },
];

export function navFor(permissions: string[]): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    label: group.label,
    items: group.items.filter((item) => permissions.includes(item.permission)),
  })).filter((group) => group.items.length > 0);
}
