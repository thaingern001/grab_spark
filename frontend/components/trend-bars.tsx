import type { SalesSummary } from "@/types/api";
import { monthLabel } from "@/lib/format";

export function TrendBars({ months }: { months: SalesSummary[] }) {
  const totals = months.map((month) => Number(month.gmv));
  const max = Math.max(...totals, 1);
  return (
    <div className="trend-bars" role="img" aria-label={`Sales trend from ${monthLabel(months[0]?.from ?? "2026-05-01")} to ${monthLabel(months[months.length - 1]?.from ?? "2026-10-01")}`}>
      {months.map((month, index) => (
        <div className="trend-column" key={month.from}>
          <span className="trend-track"><span className={`trend-bar ${index === months.length - 1 ? "is-current" : ""}`} style={{ height: `${Math.max((totals[index] / max) * 100, 8)}%` }} /></span>
          <span className="trend-label">{monthLabel(month.from)}</span>
        </div>
      ))}
    </div>
  );
}
