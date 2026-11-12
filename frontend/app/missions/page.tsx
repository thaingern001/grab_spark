import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { missions } from "@/lib/api";
import { MissionList } from "@/components/mission-list";
import { DataState } from "@/components/data-state";

export const dynamic = "force-dynamic";

export default async function Missions() {
  try {
    const items = await missions();
    return <div className="page-content section-page"><Link href="/ai" className="back-link"><ArrowLeft size={17} /> Back to One Click</Link><p className="eyebrow">ONE CLICK</p><h1>Missions</h1><p className="subtle">All missions use synthetic data or simulated outcomes.</p><MissionList items={items} /></div>;
  } catch (error) { return <div className="page-content"><DataState error={error} /></div>; }
}
