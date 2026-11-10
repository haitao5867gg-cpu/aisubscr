import { formatRmb } from "@/lib/money";

type Column = {
  day: string;
  label: string;
  paidOrders: number;
  revenueCents: number;
};

/**
 * Dependency-free revenue bars. Colors come from the existing theme tokens.
 * No chart library and no remote asset.
 */
export function RevenueChart({
  columns,
  ariaLabel,
  paidLabel,
  revenueLabel,
}: {
  columns: Column[];
  ariaLabel: string;
  paidLabel: string;
  revenueLabel: string;
}) {
  const width = 640;
  const height = 148;
  const gap = 14;
  const count = Math.max(columns.length, 1);
  const barWidth = (width - gap * (count + 1)) / count;
  const maxRevenue = Math.max(1, ...columns.map((column) => column.revenueCents));

  return (
    <figure className="revenue-chart">
      <svg className="revenue-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel}>
        <title>{ariaLabel}</title>
        {columns.map((column, index) => {
          const barHeight = column.revenueCents <= 0 ? 0 : Math.max(4, Math.round((column.revenueCents / maxRevenue) * (height - 8)));
          const x = gap + index * (barWidth + gap);
          const y = height - barHeight;
          const tip = `${column.label} ${paidLabel} ${column.paidOrders} ${revenueLabel} ${formatRmb(column.revenueCents)}`;
          return (
            <g key={column.day}>
              <title>{tip}</title>
              <rect x={x} y={y} width={barWidth} height={barHeight} rx={6} fill="var(--primary)" />
            </g>
          );
        })}
      </svg>
      <div className="chart chart-labels" aria-hidden="true">
        {columns.map((column) => (
          <div key={column.day} className="chart-col">
            <strong>{column.paidOrders}</strong>
            <span>{column.label}</span>
            <span>{formatRmb(column.revenueCents)}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}
