import Link from "next/link";
import { Icon } from "@/components/icons";
import { Avatar } from "@/components/ui";
import { requirePlatformAdmin } from "@/lib/auth";
import { logoutAction } from "@/server/actions/auth";

export const dynamic = "force-dynamic";

const LINKS = [
  { href: "/admin", label: "Vue d'ensemble", icon: "dashboard" },
  { href: "/admin/companies", label: "Entreprises", icon: "building" },
  { href: "/admin/audit", label: "Journal d'audit", icon: "shield" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requirePlatformAdmin();

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="border-b border-brand-900/10 bg-brand-950 text-white">
        <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/admin" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <Icon name="shield" className="h-5 w-5 text-accent-300" />
            </span>
            <span>
              <span className="block text-[13px] font-semibold tracking-tight">Console plateforme</span>
              <span className="block text-[10.5px] uppercase tracking-[0.16em] text-brand-200">BATIANA TECH</span>
            </span>
          </Link>

          <nav className="order-3 flex w-full flex-wrap gap-1 sm:order-none sm:ml-6 sm:w-auto">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-brand-100 transition hover:bg-white/10 hover:text-white"
              >
                <Icon name={link.icon} className="h-3.5 w-3.5" />
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-2 sm:flex">
              <Avatar name={admin.name} size="sm" />
              <span className="text-[11.5px] leading-tight">
                <span className="block font-medium">{admin.name}</span>
                <span className="block text-[10px] text-brand-200">Administrateur plateforme</span>
              </span>
            </div>
            <form action={logoutAction}>
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-2.5 py-1.5 text-[11.5px] font-medium text-white transition hover:bg-white/10">
                <Icon name="logout" className="h-3.5 w-3.5" /> Quitter
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">{children}</main>

      <footer className="mx-auto w-full max-w-[1400px] px-4 pb-8 text-[11px] text-ink-400 sm:px-6">
        Console réservée aux administrateurs BATIANA TECH. Toute consultation et toute intervention sont journalisées.
        L&apos;administrateur plateforme n&apos;a pas d&apos;accès autonome aux contenus privés des entreprises.
      </footer>
    </div>
  );
}
