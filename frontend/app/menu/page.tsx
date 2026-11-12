import Link from "next/link";
import { ArrowRight, UtensilsCrossed } from "lucide-react";
import { menus, merchant } from "@/lib/api";
import { baht } from "@/lib/format";
import { DataState } from "@/components/data-state";

export const dynamic = "force-dynamic";
const categoryNames: Record<string,string> = { Rice:"Rice", Noodles:"Noodles", Soup:"Soup", Drink:"Drinks" };
const categoryOrder = ["Rice","Noodles","Soup","Drink"];

export default async function Menu() {
  try {
    const [items, shop] = await Promise.all([menus(), merchant()]);
    const categories = [...new Set(items.map(item => item.category))].sort((a,b) => (categoryOrder.indexOf(a) < 0 ? 99 : categoryOrder.indexOf(a)) - (categoryOrder.indexOf(b) < 0 ? 99 : categoryOrder.indexOf(b)));
    return <div className="page-content native-page menu-page">
      <div className="native-page-header"><p className="eyebrow">{shop.name}</p><h1>Menu</h1><p>{items.length} items · Demo store data</p></div>
      <div className="menu-overview-line"><strong>Food and drinks</strong><span>{items.filter(item => item.available).length} items available</span></div>
      {items.length ? categories.map(category => { const group = items.filter(item => item.category === category); return <section className="native-menu-category" key={category} aria-label={categoryNames[category] ?? category}><div className="menu-category-head"><h2>{categoryNames[category] ?? category}</h2><span>{group.length} items</span></div><div className="menu-items">{group.map(item => <article className="native-menu-item" key={item.id}><span className="item-thumbnail" aria-hidden="true"><UtensilsCrossed size={20} /></span><div className="native-menu-item-copy"><strong>{item.name}</strong><span className={item.available ? "availability available" : "availability"}>{item.available ? "Available" : "Unavailable"}</span><small>{item.estimated_contribution === null ? "Contribution estimate unavailable" : `Est. contribution ${baht(item.estimated_contribution)}`}</small></div><strong className="native-menu-price">{baht(item.current_price)}</strong></article>)}</div></section>; }) : <p className="empty-copy">No menu items yet</p>}
      <p className="inline-limitation">Prices and costs are synthetic. This page does not publish changes to a live menu.</p>
      <Link className="text-action" href="/ai">View One Click opportunities <ArrowRight size={16} /></Link>
    </div>;
  } catch (error) { return <div className="page-content"><DataState error={error} /></div>; }
}
