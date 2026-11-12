import { mission, outcome, scenario, strategies } from "@/lib/api";
import { DataState } from "@/components/data-state";
import { MissionTracking } from "@/components/mission-tracking";
import type { MissionOutcome, StrategyEvaluation } from "@/types/api";

export const dynamic = "force-dynamic";

export default async function MissionDetail({ params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const [current, comparison] = await Promise.all([mission(id), scenario(id)]);
    const evaluation: StrategyEvaluation | null = current.approved_strategy_id ? await strategies(id) : null;
    let result: MissionOutcome | null = null;
    if (["completed", "reviewed"].includes(current.status)) result = await outcome(id);
    return <MissionTracking initialMission={current} comparison={comparison} initialOutcome={result} evaluation={evaluation} />;
  } catch (error) { return <div className="page-content"><DataState error={error} /></div>; }
}
