import { redirect } from "next/navigation";
import { dashboard, mission } from "@/lib/api";
import { DataState } from "@/components/data-state";

export const dynamic = "force-dynamic";

export default async function Opportunity({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  let target: string;
  try {
    const [data, params] = await Promise.all([dashboard(), searchParams]);
    const id = params.id ?? data.opportunity?.id;
    if (!id) return <div className="page-content"><div className="state-panel"><h1>No new opportunities</h1><p>Review missions and simulated results in One Click.</p></div></div>;
    const current = await mission(id);
    target = current.status === "proposed" ? "/?oneclick=1" : `/missions/${id}`;
  } catch (error) { return <div className="page-content"><DataState error={error} /></div>; }
  redirect(target);
}
