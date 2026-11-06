import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/icons";

/** Mise en page commune des ecrans d'authentification. */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-brand-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="grid-lines absolute inset-0 opacity-50" />
        <div className="absolute -right-24 top-10 h-72 w-72 rounded-full bg-brand-600/30 blur-3xl" />
        <div className="absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-accent-500/20 blur-3xl" />
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.png" alt="SHALO COM SPACE" className="h-11 w-auto" />
        </div>
        <div className="relative max-w-md">
          <h2 className="text-2xl font-semibold leading-snug tracking-tight">
            Votre communication digitale, centralisée et pilotée par l'IA.
          </h2>
          <p className="mt-3 text-[13.5px] leading-relaxed text-brand-100/80">
            Contenus, calendrier éditorial, réseaux sociaux, campagnes, contacts, catalogue et analytics :
            un seul espace sécurisé pour toute votre équipe.
          </p>
          <ul className="mt-7 space-y-3 text-[12.5px] text-brand-100/85">
            {[
              ["sparkles", "Centre IA multi-fournisseurs, configurable par entreprise"],
              ["shield", "Isolation stricte des données entre entreprises"],
              ["chart", "Rapports PDF et CSV à partir de vos données réelles"],
            ].map(([icon, text]) => (
              <li key={text} className="flex items-center gap-2.5">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/10">
                  <Icon name={icon} className="h-3.5 w-3.5" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-[11px] text-brand-200/60">
          © {new Date().getFullYear()} BATIANA TECH — Communiquer · Créer · Partager · Développer
        </p>
      </aside>

      <main className="flex flex-col justify-center bg-white px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-[420px]">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo.png" alt="SHALO COM SPACE" className="h-10 w-auto" />
          </div>
          <h1 className="text-[22px] font-semibold tracking-tight text-ink-900">{title}</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-500">{subtitle}</p>
          <div className="mt-6">{children}</div>
          {footer ? <div className="mt-6 text-[12.5px] text-ink-500">{footer}</div> : null}
          <p className="mt-10 text-[11px] text-ink-400">
            <Link href="/" className="hover:text-brand-700">
              ← Retour au site
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
