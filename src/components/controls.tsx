"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/format";

/** Bouton de suppression avec confirmation (aucune suppression accidentelle). */
export function ConfirmSubmit({
  children,
  message = "Confirmer la suppression ?",
  className = "btn btn-sm btn-danger",
}: {
  children?: React.ReactNode;
  message?: string;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  if (!armed) {
    return (
      <button type="button" className={className} onClick={() => setArmed(true)} title="Supprimer">
        <Icon name="trash" className="h-3.5 w-3.5" />
        {children}
      </button>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className="text-[11px] text-ink-500">{message}</span>
      <button type="submit" className="btn btn-sm btn-danger" onClick={() => setArmed(false)}>
        Oui
      </button>
      <button type="button" className="btn btn-sm btn-ghost" onClick={() => setArmed(false)}>
        Non
      </button>
    </span>
  );
}

/** Copie un texte dans le presse-papiers avec retour visuel. */
export function CopyButton({ text, label = "Copier", className = "btn btn-sm" }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          setCopied(false);
        }
      }}
    >
      <Icon name={copied ? "check" : "copy"} className="h-3.5 w-3.5" />
      {copied ? "Copié" : label}
    </button>
  );
}

/** Panneau dépliable utilisé pour les formulaires de création. */
export function Disclosure({
  title,
  children,
  icon = "plus",
  defaultOpen = false,
  variant = "primary",
}: {
  title: string;
  children: React.ReactNode;
  icon?: string;
  defaultOpen?: boolean;
  variant?: "primary" | "accent" | "ghost";
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn("btn", variant === "primary" && "btn-primary", variant === "accent" && "btn-accent", "no-print")}
      >
        <Icon name={open ? "close" : icon} className="h-4 w-4" />
        {open ? "Fermer" : title}
      </button>
      {open ? <div className="animate-fade mt-4">{children}</div> : null}
    </div>
  );
}

/** Barre de recherche avec soumission GET (aucun JS requis pour filtrer). */
export function SearchForm({
  action,
  placeholder = "Rechercher…",
  defaultValue = "",
  hidden = {},
}: {
  action: string;
  placeholder?: string;
  defaultValue?: string;
  hidden?: Record<string, string>;
}) {
  return (
    <form action={action} method="get" className="flex items-center gap-2">
      {Object.entries(hidden).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <div className="relative">
        <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="input pl-9 sm:w-72"
          aria-label={placeholder}
        />
      </div>
      <button type="submit" className="btn">
        Filtrer
      </button>
    </form>
  );
}

/** Aperçu de fichier (image) avec repli si l'URL n'est pas disponible. */
export function Thumb({ src, alt, className = "h-10 w-10" }: { src: string | null; alt: string; className?: string }) {
  if (!src) {
    return (
      <span className={cn("grid place-items-center rounded-lg bg-ink-100 text-ink-400", className)}>
        <Icon name="image" className="h-4 w-4" />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={cn("rounded-lg border border-ink-200 object-cover", className)} />;
}
