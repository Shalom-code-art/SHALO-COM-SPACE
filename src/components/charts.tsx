/** Graphiques legers en CSS/SVG (aucune dependance externe). */

export function DualBars({
  items,
  height = 148,
  firstLabel = "Créés",
  secondLabel = "Publiés",
}: {
  items: { label: string; a: number; b: number }[];
  height?: number;
  firstLabel?: string;
  secondLabel?: string;
}) {
  const max = Math.max(1, ...items.map((item) => Math.max(item.a, item.b)));
  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-[11px] text-ink-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-brand-600" /> {firstLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-accent-500" /> {secondLabel}
        </span>
      </div>
      <div className="flex items-end gap-2 overflow-x-auto pb-1" style={{ height }}>
        {items.map((item) => (
          <div key={item.label} className="flex min-w-[18px] flex-1 flex-col items-center justify-end gap-1">
            <div className="flex h-full w-full items-end justify-center gap-[2px]">
              <div
                className="w-1/2 max-w-[10px] rounded-t-sm bg-brand-600/90 transition-all hover:bg-brand-700"
                style={{ height: `${Math.max(2, (item.a / max) * 100)}%` }}
                title={`${firstLabel} : ${item.a}`}
              />
              <div
                className="w-1/2 max-w-[10px] rounded-t-sm bg-accent-500/90 transition-all hover:bg-accent-600"
                style={{ height: `${Math.max(2, (item.b / max) * 100)}%` }}
                title={`${secondLabel} : ${item.b}`}
              />
            </div>
            <span className="w-full truncate text-center text-[9px] text-ink-400">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const DONUT_COLORS = [
  "text-brand-600",
  "text-accent-500",
  "text-emerald-500",
  "text-violet-500",
  "text-sky-500",
  "text-rose-500",
  "text-ink-400",
];
const DONUT_FILLS = ["#1e54a1", "#f5821f", "#10b981", "#8b5cf6", "#0ea5e9", "#f43f5e", "#94a3b8"];

export function Donut({ items, size = 132 }: { items: { label: string; value: number }[]; size?: number }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#eef2f7" strokeWidth={14} />
        {total > 0 ? (
          items.map((item, index) => {
            const length = (item.value / total) * circumference;
            const dash = `${length} ${circumference - length}`;
            const element = (
              <circle
                key={item.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={DONUT_FILLS[index % DONUT_FILLS.length]}
                strokeWidth={14}
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                strokeLinecap="butt"
              />
            );
            offset += length;
            return element;
          })
        ) : (
          <text x="50%" y="52%" textAnchor="middle" className="fill-ink-400" fontSize="10">
            Aucune donnée
          </text>
        )}
        <text x="50%" y="48%" textAnchor="middle" className="fill-ink-900" fontSize="18" fontWeight="600">
          {total}
        </text>
        <text x="50%" y="62%" textAnchor="middle" className="fill-ink-400" fontSize="9">
          total
        </text>
      </svg>
      <ul className="flex-1 space-y-1.5">
        {items.length === 0 ? <li className="text-[11.5px] text-ink-400">Aucune donnée enregistrée.</li> : null}
        {items.map((item, index) => (
          <li key={item.label} className="flex items-center justify-between gap-2 text-[11.5px]">
            <span className="flex items-center gap-2 text-ink-600">
              <span className={`h-2 w-2 rounded-full bg-current ${DONUT_COLORS[index % DONUT_COLORS.length]}`} />
              {item.label}
            </span>
            <span className="font-medium text-ink-800">{item.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RankBars({
  items,
  suffix = "",
  tone = "brand",
}: {
  items: { label: string; value: number }[];
  suffix?: string;
  tone?: "brand" | "accent";
}) {
  const max = Math.max(1, ...items.map((item) => item.value));
  if (items.length === 0) return <p className="text-[11.5px] text-ink-400">Aucune donnée enregistrée.</p>;
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.label}>
          <div className="mb-1 flex items-center justify-between text-[11.5px]">
            <span className="truncate text-ink-600">{item.label}</span>
            <span className="font-medium text-ink-800">
              {item.value}
              {suffix}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
            <div
              className={`h-full rounded-full ${tone === "brand" ? "bg-brand-600" : "bg-accent-500"}`}
              style={{ width: `${Math.max(3, (item.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Carte de comparaison de periode (valeur, evolution). */
export function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) {
    return <span className="text-[11px] text-ink-400">{current > 0 ? "nouveau" : "aucune donnée"}</span>;
  }
  const delta = Math.round(((current - previous) / previous) * 100);
  return (
    <span className={`text-[11px] font-medium ${delta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
      {delta >= 0 ? "+" : ""}
      {delta}% vs période précédente
    </span>
  );
}
