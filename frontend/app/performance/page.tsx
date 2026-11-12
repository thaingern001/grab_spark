import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { dashboard, sales, menuPerformance } from "@/lib/api";
import { baht } from "@/lib/format";
import { DataState } from "@/components/data-state";
import { SalesBars } from "@/components/sales-bars";

export const dynamic = "force-dynamic";
function before(iso: string, days: number) { const day = new Date(`${iso}T00:00:00Z`); day.setUTCDate(day.getUTCDate() - days); return day.toISOString().slice(0, 10); }

export default async function Insights({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  try {
    const params = await searchParams;
    const period = params.period === "7" || params.period === "180" ? Number(params.period) : 30;
    const home = await dashboard();
    const end = home.today.to;
    const start = before(end, period - 1);
    const granularity = period === 180 ? "month" : "day";
    const [result, ranking] = await Promise.all([sales(start, end, granularity), menuPerformance(start, end, 5)]);
    return <div className="page-content native-page insights-page">
      <div className="native-page-header"><p className="eyebrow">Store performance</p><h1>Insights</h1><p>Sales and menu data from the synthetic demo</p></div>
      <nav className="native-tabs" aria-label="Insights period">{[7,30,180].map(days => <Link key={days} href={`/performance?period=${days}`} aria-current={period === days ? "page" : undefined}>{days} days</Link>)}</nav>
      <section className="insights-summary" aria-label="Sales overview"><span>Total sales · GMV</span><strong>{baht(result.summary.gmv)}</strong><small>{result.summary.from} – {result.summary.to}</small><div><span><b>{result.summary.orders}</b> completed orders</span><span><b>{baht(result.summary.aov)}</b> per order</span></div></section>
      <section className="insights-block"><div className="compact-heading"><div><span>Sales trend</span><h2>Selected period</h2></div></div><SalesBars series={result.series} granularity={granularity} /><p className="section-description">Previous equal-length period: GMV {baht(result.summary.prior_gmv)}</p></section>
      <section className="insights-block"><div className="compact-heading"><div><span>After modeled variable costs</span><h2>Estimated contribution</h2></div></div><strong className="insights-contribution">{baht(result.summary.estimated_contribution)}</strong><p className="section-description">Excludes fixed costs and tax; this is not net profit.</p></section>
      <section className="insights-block"><div className="compact-heading"><div><span>Menu performance</span><h2>Top sellers</h2></div><Link href="/menu" aria-label="Open menu"><ChevronRight size={18} /></Link></div>{ranking.length ? <ol className="compact-ranking">{ranking.map((item,index) => <li key={item.menu_item_id}><span className="rank">{index + 1}</span><span><strong>{item.name}</strong><small>{item.units} sold</small></span><b>{baht(item.gmv)}</b></li>)}</ol> : <p className="empty-copy">No orders in this period</p>}</section>
      <Link className="text-action" href="/ai">View One Click opportunities <ArrowRight size={16} /></Link>
    </div>;
  } catch (error) { return <div className="page-content"><DataState error={error} /></div>; }
}
