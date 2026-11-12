import type { SalesSummary } from "@/types/api";
import { monthLabel } from "@/lib/format";

export function SalesBars({ series, granularity }: { series: SalesSummary[]; granularity: "day" | "month" }) {
  const values = series.map((point) => Number(point.gmv));
  const max = Math.max(...values, 1);
  return <div className={`sales-bars ${series.length > 12 ? "is-dense" : ""}`} role="img" aria-label={`Sales trend over ${series.length} ${granularity === "month" ? "months" : "days"}`}>
    {series.map((point, index) => <div className="sales-bar-column" key={point.from}>
      <span className="sales-bar-track"><span className="sales-bar-fill" style={{ height: values[index] === 0 ? "0%" : `${Math.max(values[index] / max * 100, 3)}%`, minHeight: values[index] === 0 ? 0 : 3 }} /></span>
      <span className="sales-bar-label">{granularity === "month" ? monthLabel(point.from) : series.length > 12 && index % 5 !== 0 ? "" : point.from.slice(-2)}</span>
    </div>)}
  </div>;
}
