import { ArrowUpRight, Info } from "lucide-react";
import type { ScenarioComparison } from "@/types/api";
import { baht } from "@/lib/format";

export function FinancialHero({ comparison, compact = false }: { comparison: ScenarioComparison; compact?: boolean }) {
  return (
    <div className={`financial-hero ${compact ? "is-compact" : ""}`}>
      <div className="comparison-pair">
        <div><span className="comparison-label">Current item</span><strong>{baht(comparison.baseline.estimated_contribution)}</strong><small>per item</small></div>
        <span className="comparison-arrow" aria-hidden="true"><ArrowUpRight size={19} /></span>
        <div><span className="comparison-label">Proposed bundle</span><strong>{baht(comparison.proposed.estimated_contribution)}</strong><small>per bundle</small></div>
      </div>
      <div className="difference-strip">
        <span><Info size={15} aria-hidden="true" /> Estimated difference</span>
        <strong>{baht(comparison.contribution_difference, true)} <small>per bundle sold</small></strong>
      </div>
    </div>
  );
}
