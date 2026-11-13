import Link from "next/link";
import { ArrowRight, ClipboardList, ChartNoAxesCombined, ChevronRight, Sparkles, UtensilsCrossed, ListChecks, Store } from "lucide-react";
import { dashboard, merchant, scenario, strategies, missions } from "@/lib/api";
import { baht, thaiDate } from "@/lib/format";
import { DataState } from "@/components/data-state";
import { TrendBars } from "@/components/trend-bars";
import { HomeOpportunityPopup } from "@/components/home-opportunity-popup";
import { StrategyVisual } from "@/components/strategy-visual";
import type { Dashboard, Merchant, ScenarioComparison, Mission, StrategyEvaluation } from "@/types/api";
import { JudgeDemo } from "@/components/judge-demo";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ oneclick?: string }> }) {
  if (process.env.NEXT_PUBLIC_GRABSPARK_JUDGE_DEMO === "1" || process.env.VERCEL === "1") return <JudgeDemo />;
  let shop: Merchant;
  let data: Dashboard;
  let comparison: ScenarioComparison | null = null;
  let evaluation: StrategyEvaluation | null = null;
  let missionList: Mission[];
  try {
    [shop, data, missionList] = await Promise.all([merchant(), dashboard(), missions()]);
    if (data.opportunity) [comparison, evaluation] = await Promise.all([scenario(data.opportunity.id), strategies(data.opportunity.id)]);
  } catch (error) { return <div className="page-content"><DataState error={error} /></div>; }
  const latest = [...missionList].filter(item => item.status !== "proposed").sort((a, b) => (b.events.at(-1)?.occurred_at ?? "").localeCompare(a.events.at(-1)?.occurred_at ?? ""))[0];
  const recommendedCase = evaluation?.strategies.find(item => item.strategy_id === evaluation.recommended_strategy_id);
  const homeVisualStrategy = recommendedCase?.strategy_id ?? latest?.approved_strategy_id;
  const forcePopup = (await searchParams).oneclick === "1";
  return <div className="page-content home-page home-fidelity">
    {data.opportunity && comparison && evaluation && <HomeOpportunityPopup mission={data.opportunity} initialComparison={comparison} initialEvaluation={evaluation} forceOpen={forcePopup} />}
    <div className="home-store-context"><div className="home-store-pick"><span className="home-store-icon"><Store size={17} /></span><span><small>Your store</small><strong>{shop.name}</strong></span></div><span className="home-date">{thaiDate(data.today.from)}</span></div>

    <section className="merchant-highlights" aria-label="Today's overview"><div className="highlight-orders"><span className="highlight-pill">Synthetic data</span><strong>{data.today.orders}</strong><span>Completed orders today</span></div><div className="highlight-sales"><span>Sales today</span><strong>{baht(data.today.gmv)}</strong><small>GMV · {data.today.orders} orders</small></div></section>
    <div className="home-aov">Average order value <strong>{baht(data.today.aov)}</strong></div>

    <section className="home-for-you" aria-labelledby="for-you-heading"><div className="home-feature-heading"><h2 id="for-you-heading">For your store</h2><span>One Click</span></div><article className={`home-recommendation${data.opportunity ? " is-opportunity" : ""}`}><Link href={data.opportunity ? `/opportunity?id=${data.opportunity.id}` : latest ? `/missions/${latest.id}` : "/ai"} className="home-recommendation-hitarea" aria-label={data.opportunity ? "View recommendation" : latest ? "Track mission" : "Open One Click"} /><div className="home-recommendation-top"><span className="native-ai-icon"><Sparkles size={18} /></span><span><strong>One Click · New opportunity</strong><small>Compare 3 strategies · 1 recommendation</small></span></div>{homeVisualStrategy && <div className="home-recommendation-visual"><StrategyVisual strategyId={homeVisualStrategy} variant="hero" /><small>Concept only · Not an actual menu photo or published campaign</small></div>}{data.opportunity ? <><h3>{recommendedCase?.strategy_id === "bundle" && /chicken rice.*drink/i.test(comparison?.proposed.label ?? "") ? "Try a chicken rice + drink bundle" : recommendedCase ? `Try ${recommendedCase.description.toLowerCase()}` : data.opportunity.title}</h3><p>{recommendedCase ? `Lowest illustrative modeled risk: ${recommendedCase.risk_score}/100` : data.opportunity.rationale}</p>{recommendedCase && <div className="home-recommendation-impact"><span>Estimated 7-day contribution difference</span><strong>{baht(recommendedCase.estimated_difference, true)}</strong></div>}<span className="home-recommendation-link">View recommendation <ArrowRight size={17} /></span></> : latest ? <><h3>Track your mission</h3><p>{latest.title}</p><div className="home-recommendation-impact"><span>Status</span><strong className="status-copy">{latest.status === "completed" ? "Simulated result ready" : latest.status === "reviewed" ? "Simulated result reviewed" : latest.status === "approved" ? "Simulation approved" : latest.status}</strong></div><span className="home-recommendation-link">Track mission <ArrowRight size={17} /></span></> : <><h3>No new opportunities</h3><p>Review previous simulated missions in One Click</p><span className="home-recommendation-link">Open One Click <ArrowRight size={17} /></span></>}<small className="home-recommendation-disclaimer">Simulation only · No real promotion is published</small></article></section>

    <section className="merchant-shortcuts" aria-labelledby="shortcuts-heading"><h2 id="shortcuts-heading">Manage your store</h2><nav className="merchant-shortcut-grid" aria-label="Store shortcuts"><Link href="/orders"><span><ClipboardList size={21} /></span>Orders</Link><Link href="/menu"><span><UtensilsCrossed size={21} /></span>Menu</Link><Link href="/performance"><span><ChartNoAxesCombined size={21} /></span>Insights</Link><Link href="/ai"><span><Sparkles size={21} /></span>One Click</Link><Link href="/missions"><span><ListChecks size={21} /></span>Missions</Link></nav></section>

    <section className="home-compact-section" aria-labelledby="trend-heading"><div className="compact-heading"><div><span>Insights</span><h2 id="trend-heading">Sales over the past 6 months</h2></div><Link href="/performance" aria-label="Open insights"><ChevronRight size={18} /></Link></div><TrendBars months={data.monthly_trend} /></section>
    <section className="home-compact-section" aria-labelledby="top-heading"><div className="compact-heading"><div><span>Top menu items</span><h2 id="top-heading">Popular items</h2></div><Link href="/menu" aria-label="Open menu"><ChevronRight size={18} /></Link></div>{data.top_items.length ? <ol className="compact-ranking">{data.top_items.slice(0,3).map((item,index) => <li key={item.menu_item_id}><span className="rank">{index + 1}</span><span><strong>{item.name}</strong><small>{item.units} sold</small></span><b>{baht(item.gmv)}</b></li>)}</ol> : <p className="empty-copy">No orders in this period</p>}</section>
    <p className="footnote">All figures are synthetic. Estimated contribution is not net profit.</p>
  </div>;
}
