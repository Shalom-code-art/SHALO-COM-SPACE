import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/icons";
import { cn, initials, statusBadgeClass } from "@/lib/format";

export function PageHeader({
  title,
  subtitle,
  icon,
  actions,
}: {
  title: string;
  subtitle?: string;
  icon?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        {icon ? (
          <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-900 text-white shadow-[var(--shadow-card)]">
            <Icon name={icon} className="h-5 w-5" />
          </span>
        ) : null}
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink-900 sm:text-[22px]">{title}</h1>
          {subtitle ? <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-ink-500">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return <section className={cn("card", padded && "card-pad", className)}>{children}</section>;
}

export function CardHeader({
  title,
  subtitle,
  icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        {icon ? (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
            <Icon name={icon} className="h-4 w-4" />
          </span>
        ) : null}
        <div>
          <h2 className="card-title">{title}</h2>
          {subtitle ? <p className="card-sub mt-0.5">{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

const TONES: Record<string, string> = {
  brand: "bg-brand-50 text-brand-700",
  accent: "bg-accent-50 text-accent-600",
  emerald: "bg-emerald-50 text-emerald-600",
  violet: "bg-violet-50 text-violet-600",
  sky: "bg-sky-50 text-sky-600",
  rose: "bg-rose-50 text-rose-600",
};

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "brand",
  trend,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: string;
  tone?: keyof typeof TONES;
  trend?: { value: number; label?: string };
}) {
  return (
    <div className="card card-pad animate-rise">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">{label}</p>
        {icon ? (
          <span className={cn("grid h-8 w-8 place-items-center rounded-lg", TONES[tone] ?? TONES.brand)}>
            <Icon name={icon} className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <p className="kpi-value mt-2">{value}</p>
      <div className="mt-1 flex items-center gap-2">
        {trend ? (
          <span
            className={cn(
              "badge",
              trend.value > 0
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : trend.value < 0
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-ink-200 bg-ink-50 text-ink-600"
            )}
          >
            <Icon name={trend.value >= 0 ? "arrow-up" : "arrow-down"} className="h-3 w-3" />
            {trend.value > 0 ? "+" : ""}
            {trend.value}%
          </span>
        ) : null}
        {hint ? <p className="text-[11px] text-ink-400">{hint}</p> : null}
      </div>
    </div>
  );
}

export function Badge({ children, status }: { children: ReactNode; status?: string }) {
  return <span className={cn("badge", status ? statusBadgeClass(status) : "border-ink-200 bg-ink-50 text-ink-600")}>{children}</span>;
}

export function EmptyState({
  icon = "layers",
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-200 bg-ink-50/60 px-6 py-10 text-center">
      <span className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-white text-brand-600 shadow-sm">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <p className="text-sm font-medium text-ink-800">{title}</p>
      {description ? <p className="mt-1 max-w-md text-[12.5px] leading-relaxed text-ink-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

const ALERT_TONES: Record<string, string> = {
  info: "border-brand-200 bg-brand-50 text-brand-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  error: "border-rose-200 bg-rose-50 text-rose-900",
};

export function Alert({
  tone = "info",
  title,
  children,
  icon,
}: {
  tone?: "info" | "success" | "warning" | "error";
  title?: string;
  children?: ReactNode;
  icon?: string;
}) {
  const iconName = icon ?? (tone === "success" ? "check-circle" : tone === "error" || tone === "warning" ? "alert" : "sparkles");
  return (
    <div className={cn("flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[12.5px] leading-relaxed", ALERT_TONES[tone])}>
      <Icon name={iconName} className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={title ? "mt-0.5 opacity-90" : ""}>{children}</div> : null}
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
  className,
  htmlFor,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={className}>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export function Progress({ value, tone = "brand" }: { value: number; tone?: "brand" | "accent" | "rose" }) {
  const colors = { brand: "bg-brand-600", accent: "bg-accent-500", rose: "bg-rose-500" };
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
      <div className={cn("h-full rounded-full transition-all", colors[tone])} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function Tabs({ items }: { items: { label: string; href: string; active: boolean; count?: number }[] }) {
  return (
    <nav className="mb-4 flex flex-wrap gap-1 rounded-xl border border-ink-200 bg-white p-1">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition",
            item.active ? "bg-brand-700 text-white shadow-sm" : "text-ink-600 hover:bg-ink-100"
          )}
        >
          {item.label}
          {typeof item.count === "number" ? (
            <span className={cn("ml-1.5 text-[11px]", item.active ? "text-brand-200" : "text-ink-400")}>{item.count}</span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-brand-100 font-semibold uppercase text-brand-700",
        size === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs"
      )}
    >
      {initials(name)}
    </span>
  );
}

export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-ink-100 py-2 last:border-0">
      <span className="text-[12px] text-ink-500">{label}</span>
      <span className="text-right text-[12.5px] font-medium text-ink-800">{value}</span>
    </div>
  );
}

export function Flash({ saved, error, info }: { saved?: string; error?: string; info?: string }) {
  if (!saved && !error && !info) return null;
  return (
    <div className="mb-4 space-y-2">
      {saved ? (
        <Alert tone="success" title="Enregistré">
          {saved}
        </Alert>
      ) : null}
      {error ? (
        <Alert tone="error" title="Action impossible">
          {error}
        </Alert>
      ) : null}
      {info ? <Alert tone="info">{info}</Alert> : null}
    </div>
  );
}

export function Divider() {
  return <hr className="my-4 border-ink-100" />;
}
