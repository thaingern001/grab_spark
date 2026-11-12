import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { dashboard, missions, scenario } from "@/lib/api";
import { baht } from "@/lib/format";
import { DataState } from "@/components/data-state";
import { MissionList } from "@/components/mission-list";

export const dynamic = "force-dynamic";

export default async function AIHub() {
  try {
    const [data, items] = await Promise.all([dashboard(), missions()]);
    const comparison = data.opportunity ? await scenario(data.opportunity.id) : null;
    return <div className="page-content native-page ai-page">
      <div className="native-page-header"><p className="eyebrow">Decision support for your store</p><h1>One Click <Sparkles size={21} aria-hidden="true" /></h1><p>Review the numbers before trying a new approach</p></div>
      <section className="ai-native-section"><div className="compact-heading"><div><span>For your store</span><h2>Recommended opportunity</h2></div></div>{data.opportunity ? <article className="ai-native-opportunity"><div className="native-opportunity-head"><span className="native-ai-icon"><Sparkles size={17} /></span><strong>Suggested mission</strong></div><h3>{data.opportunity.title}</h3><p>{data.opportunity.rationale}</p>{comparison && <div className="native-impact"><span>Estimated contribution difference</span><strong>{baht(comparison.contribution_difference, true)} <small>per bundle</small></strong></div>}<Link className="native-cta" href={`/opportunity?id=${data.opportunity.id}`}>Review opportunity <ArrowRight size={17} /></Link></article> : <div className="native-empty"><strong>No new opportunities</strong><p>You can still review earlier simulated missions below</p></div>}</section>
      <section className="ai-native-section"><div className="compact-heading"><div><span>One Click</span><h2>Mission activity</h2></div><Link href="/missions" aria-label="View all missions"><ArrowRight size={18} /></Link></div><MissionList items={items} /></section>
      <p className="inline-limitation">One Click is a simulated prototype feature. It does not publish promotions or change the live menu.</p>
    </div>;
  } catch (error) { return <div className="page-content"><DataState error={error} /></div>; }
}
