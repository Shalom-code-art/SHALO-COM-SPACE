import Link from "next/link";
import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-nav";
import { Icon } from "@/components/icons";
import { Avatar } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/permissions";
import { navFor } from "@/lib/nav";
import { formatRelative } from "@/lib/format";
import type { SessionUser } from "@/lib/auth";
import { logoutAction } from "@/server/actions/auth";
import { markNotificationsReadAction } from "@/server/actions/notifications";

export type ShellNotification = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
  read_at: string | null;
  type: string;
};

export function AppShell({
  user,
  notifications,
  children,
}: {
  user: SessionUser;
  notifications: ShellNotification[];
  children: ReactNode;
}) {
  const groups = navFor(user.permissions);
  const company = user.company!;
  const unread = notifications.filter((item) => !item.read_at).length;

  return (
    <div className="min-h-screen bg-ink-50">
      <AppSidebar
        groups={groups}
        user={{ name: user.name, roleLabel: ROLE_LABELS[user.role] ?? user.role }}
        company={{ name: company.name, logoUrl: company.logo_url, plan: company.plan, slug: company.slug }}
      />

      <div className="lg:pl-[272px]">
        <header className="sticky top-0 z-30 border-b border-ink-200/80 bg-white/85 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-[1480px] items-center gap-2 px-3 py-2.5 sm:px-5 lg:px-7">
            <form action="/app/search" method="get" className="relative hidden max-w-sm flex-1 sm:block">
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                type="search"
                name="q"
                placeholder="Recherche globale : contenu, contact, campagne…"
                className="input h-9 pl-9 text-[12.5px]"
                aria-label="Recherche globale"
              />
            </form>
            <Link href="/app/search" className="btn btn-icon sm:hidden" aria-label="Recherche">
              <Icon name="search" className="h-4 w-4" />
            </Link>

            <div className="ml-auto flex items-center gap-1">
              <details className="group relative">
                <summary className="btn btn-icon relative list-none">
                  <Icon name="bell" className="h-4 w-4" />
                  {unread > 0 ? (
                    <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent-500 px-1 text-[9px] font-bold text-white">
                      {unread}
                    </span>
                  ) : null}
                </summary>
                <div className="shadow-[var(--shadow-pop)] absolute right-0 z-50 mt-2 w-[320px] overflow-hidden rounded-xl border border-ink-200 bg-white">
                  <div className="flex items-center justify-between border-b border-ink-100 px-3 py-2">
                    <p className="text-[12px] font-semibold text-ink-900">Notifications</p>
                    {unread > 0 ? (
                      <form action={markNotificationsReadAction}>
                        <button type="submit" className="text-[11px] text-brand-700 hover:underline">
                          Tout marquer lu
                        </button>
                      </form>
                    ) : null}
                  </div>
                  <ul className="max-h-[320px] divide-y divide-ink-100 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <li className="px-3 py-6 text-center text-[12px] text-ink-500">Aucune notification.</li>
                    ) : (
                      notifications.map((item) => (
                        <li key={item.id} className={item.read_at ? "" : "bg-brand-50/50"}>
                          <Link href={item.link || "/app"} className="block px-3 py-2.5 hover:bg-ink-50">
                            <p className="text-[12px] font-medium text-ink-900">{item.title}</p>
                            {item.body ? <p className="mt-0.5 line-clamp-2 text-[11px] text-ink-500">{item.body}</p> : null}
                            <p className="mt-1 text-[10px] text-ink-400">{formatRelative(item.created_at)}</p>
                          </Link>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </details>

              <details className="group relative">
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-ink-100">
                  <Avatar name={user.name} size="sm" />
                  <span className="hidden text-left md:block">
                    <span className="block text-[12px] font-medium leading-tight text-ink-900">{user.name}</span>
                    <span className="block text-[10px] leading-tight text-ink-500">{ROLE_LABELS[user.role]}</span>
                  </span>
                  <Icon name="chevron" className="h-3.5 w-3.5 text-ink-400" />
                </summary>
                <div className="shadow-[var(--shadow-pop)] absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-ink-200 bg-white">
                  <div className="border-b border-ink-100 px-3 py-2.5">
                    <p className="text-[12px] font-semibold text-ink-900">{user.name}</p>
                    <p className="text-[11px] text-ink-500">{user.email}</p>
                    <p className="mt-1 inline-flex rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">
                      {company.name}
                    </p>
                  </div>
                  <div className="p-1.5">
                    <Link href="/app/settings" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] text-ink-700 hover:bg-ink-50">
                      <Icon name="settings" className="h-3.5 w-3.5" /> Paramètres de l'espace
                    </Link>
                    <Link href={`/s/${company.slug}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] text-ink-700 hover:bg-ink-50">
                      <Icon name="external" className="h-3.5 w-3.5" /> Voir la vitrine publique
                    </Link>
                    <form action={logoutAction}>
                      <button type="submit" className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] text-rose-600 hover:bg-rose-50">
                        <Icon name="logout" className="h-3.5 w-3.5" /> Se déconnecter
                      </button>
                    </form>
                  </div>
                </div>
              </details>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1480px] px-3 py-5 sm:px-5 lg:px-7">{children}</main>

        <footer className="mx-auto w-full max-w-[1480px] px-4 pb-6 pt-2 text-[11px] text-ink-400">
          SHALO COM SPACE — plateforme de communication digitale et de marketing intelligent · Édité par BATIANA TECH
        </footer>
      </div>
    </div>
  );
}
