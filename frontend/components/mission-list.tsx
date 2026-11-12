import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleDashed, Sparkles } from "lucide-react";
import type { Mission } from "@/types/api";

const labels: Record<Mission["status"], string> = {
  proposed: "Ready for review", approved: "Simulation approved", running: "Generating simulation",
  completed: "Simulated result ready", reviewed: "Simulated result reviewed", rejected: "Declined", cancelled: "Cancelled",
};

export function MissionList({ items }: { items: Mission[] }) {
  if (!items.length) return <p className="empty-copy">No simulated missions yet</p>;
  return <div className="mission-list">{items.map((item) => <Link href={item.status === "proposed" ? `/opportunity?id=${item.id}` : `/missions/${item.id}`} className="mission-row" key={item.id}>
    <span className="mission-icon">{item.status === "completed" || item.status === "reviewed" ? <CheckCircle2 size={20} /> : item.status === "proposed" ? <Sparkles size={20} /> : <CircleDashed size={20} />}</span>
    <span><strong>{item.title}</strong><small>{labels[item.status]}</small></span><ArrowRight size={17} aria-hidden="true" />
  </Link>)}</div>;
}
