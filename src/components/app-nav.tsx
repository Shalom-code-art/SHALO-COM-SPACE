"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { cn, initials } from "@/lib/format";
import type { NavGroup } from "@/lib/nav";

type Props = {
  groups: NavGroup[];
  user: { name: string; roleLabel: string };
  company: { name: string; logoUrl: string | null; plan: string; slug: string };
};

function NavList({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 overflow-y-auto px-2 pb-4">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="nav-group">{group.label}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn("nav-link", active && "nav-link-active")}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon name={item.icon} className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Brand({ company }: { company: Props["company"] }) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/10">
        {company.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={company.logoUrl} alt={company.name} className="h-full w-full object-cover" />
        ) : (
          <Icon name="megaphone" className="h-4 w-4 text-white" />
        )}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-white">{company.name}</p>
        <p className="text-[10px] uppercase tracking-[0.14em] text-brand-300">Espace communication</p>
      </div>
    </div>
  );
}

export function AppSidebar({ groups, user, company }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const footer = (
    <div className="border-t border-white/10 p-3">
      <div className="flex items-center gap-2.5 rounded-xl bg-white/5 px-2.5 py-2">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-accent-500 text-[11px] font-bold text-white">
          {initials(user.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-medium text-white">{user.name}</p>
          <p className="truncate text-[10px] text-brand-300">{user.roleLabel}</p>
        </div>
        <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand-100">
          {company.plan}
        </span>
      </div>
      <p className="mt-2 px-1 text-[9.5px] leading-relaxed text-brand-300/70">
        SHALO COM SPACE · BATIANA TECH
      </p>
    </div>
  );

  return (
    <>
      {/* Barre mobile */}
      <div className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-ink-200 bg-white px-4 py-2.5 lg:hidden">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark.png" alt="SHALO COM SPACE" className="h-7 w-7 rounded-md object-cover" />
          <span className="text-[13px] font-semibold text-brand-900">SHALO COM SPACE</span>
        </div>
        <button type="button" className="btn btn-icon" aria-label="Ouvrir le menu" onClick={() => setOpen(true)}>
          <Icon name="menu" className="h-5 w-5" />
        </button>
      </div>

      {/* Drawer mobile */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="animate-fade absolute inset-y-0 left-0 flex w-[86%] max-w-[300px] flex-col bg-brand-950">
            <div className="flex items-center justify-between">
              <Brand company={company} />
              <button type="button" className="mr-3 rounded-lg p-1.5 text-brand-200 hover:bg-white/10" onClick={() => setOpen(false)} aria-label="Fermer">
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>
            <NavList groups={groups} onNavigate={() => setOpen(false)} />
            {footer}
          </div>
        </div>
      ) : null}

      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[272px] flex-col bg-brand-950 bg-gradient-to-b from-brand-950 via-brand-950 to-[#0a1626] lg:flex">
        <div className="grid-lines border-b border-white/10">
          <Brand company={company} />
        </div>
        <NavList groups={groups} />
        {footer}
      </aside>
    </>
  );
}
