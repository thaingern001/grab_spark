import Link from "next/link";
import { ArrowRight, ClipboardList } from "lucide-react";
import { dashboard, merchant, sales } from "@/lib/api";
import { baht, thaiDate } from "@/lib/format";
import { DataState } from "@/components/data-state";
import { SalesBars } from "@/components/sales-bars";

export const dynamic = "force-dynamic";
function daysBefore(iso: string, days: number) { const date = new Date(`${iso}T00:00:00Z`); date.setUTCDate(date.getUTCDate() - days); return date.toISOString().slice(0, 10); }

export default async function Orders({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  try {
    const [{ period }, data, shop] = await Promise.all([searchParams, dashboard(), merchant()]);
    const week = await sales(daysBefore(data.today.to, 6), data.today.to, "day");
    const selected = period === "7" ? "7" : "today";
    const summary = selected === "7" ? week.summary : data.today;
    return <div className="page-content native-page orders-page">
      <div className="native-page-header"><p className="eyebrow">{shop.name} · {thaiDate(data.today.from)}</p><h1>Orders</h1><p>Completed orders from the synthetic demo store</p></div>
      <nav className="native-tabs" aria-label="Order period"><Link href="/orders" aria-current={selected === "today" ? "page" : undefined}>Today</Link><Link href="/orders?period=7" aria-current={selected === "7" ? "page" : undefined}>Last 7 days</Link></nav>
      <section className="order-snapshot" aria-label="Order overview"><div><span className="order-snapshot-icon"><ClipboardList size={19} /></span><span>Completed orders</span><strong>{summary.orders}</strong></div><div><span>Total sales · GMV</span><strong>{baht(summary.gmv)}</strong><small>Before modeled costs and discounts</small></div></section>
      <section className="native-list-section"><div className="native-list-row"><span>Average order value</span><strong>{baht(summary.aov)}</strong></div><div className="native-list-row"><span>Estimated contribution</span><strong>{baht(summary.estimated_contribution)}</strong></div></section>
      <section className="orders-trend"><div className="compact-heading"><div><span>Sales history</span><h2>Last 7 days</h2></div></div><SalesBars series={week.series} granularity="day" /></section>
      <p className="inline-limitation">This prototype does not include individual order records or live order management from the backend.</p>
      <Link className="text-action" href="/performance">View insights <ArrowRight size={16} /></Link>
    </div>;
  } catch (error) { return <div className="page-content"><DataState error={error} /></div>; }
}
