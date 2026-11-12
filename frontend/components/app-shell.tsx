"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { House, Sparkles, Store, ClipboardList, UtensilsCrossed, ChartNoAxesCombined, UserRound, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { merchantRequest } from "@/lib/client-api";

export function AppShell({ children, allowDemoReset }: { children: ReactNode; allowDemoReset: boolean }) {
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState("");
  const pathname = usePathname();
  const current = pathname === "/" ? "home" : pathname.startsWith("/orders") ? "orders" : pathname.startsWith("/menu") ? "menu" : pathname.startsWith("/performance") ? "performance" : "ai";
  const tabs = [
    { id: "home", href: "/", label: "Home", icon: House },
    { id: "orders", href: "/orders", label: "Orders", icon: ClipboardList },
    { id: "menu", href: "/menu", label: "Menu", icon: UtensilsCrossed },
    { id: "performance", href: "/performance", label: "Insights", icon: ChartNoAxesCombined },
    { id: "ai", href: "/ai", label: "One Click", icon: Sparkles },
  ] as const;
  async function resetDemoAccount() {
    if (resetting) return;
    setResetting(true);
    setResetError("");
    try {
      await merchantRequest<{ reset: true }>("/demo/reset", { method: "POST" });
      try {
        for (const key of Object.keys(sessionStorage)) if (key.startsWith("grabspark:")) sessionStorage.removeItem(key);
      } catch { /* The fresh recommendation is opened by the URL below. */ }
      window.location.replace("/?oneclick=1");
    } catch (cause) {
      setResetError(cause instanceof Error ? cause.message : "Could not reset the demo account. Please try again.");
      setResetting(false);
    }
  }
  return (
    <div className="desktop-stage">
      <div className="phone-frame">
        <header className="app-header">
          <Link href="/" className="brand" aria-label="GrabMerchant home for Westrong Kitchen">
            <span className="brand-mark" aria-hidden="true"><Store size={18} strokeWidth={2.2} /></span>
            <span className="brand-copy"><strong>GrabMerchant</strong><small>Westrong Kitchen · Demo store</small></span>
          </Link>
          <details className="account-menu"><summary aria-label="Store profile"><UserRound size={19} aria-hidden="true" /></summary><div className="account-popover"><strong>Westrong Kitchen</strong><span>Demo merchant account</span><small>Unofficial prototype · Synthetic data</small>{allowDemoReset && <div className="account-reset"><button type="button" disabled={resetting} onClick={resetDemoAccount}><RotateCcw size={14} aria-hidden="true" /> {resetting ? "Resetting account…" : "Reset demo account"}</button><small>Restore all sample account data to its starting state</small>{resetError && <p role="alert">{resetError}</p>}</div>}</div></details>
        </header>
        <div className="prototype-ribbon"><span className="ribbon-dot" /> Unofficial prototype <span aria-hidden="true">·</span> Synthetic data</div>
        <main id="main-content" className="app-main">{children}</main>
        <nav className="bottom-nav" aria-label="Main navigation">
          {tabs.map((tab) => <Link key={tab.id} className={`nav-item ${current === tab.id ? "is-active" : ""}`} href={tab.href} aria-current={current === tab.id ? "page" : undefined}>
            <tab.icon size={20} strokeWidth={2} aria-hidden="true" /><span>{tab.label}</span>
          </Link>)}
        </nav>
      </div>
      <div className="desktop-caption" aria-hidden="true"><span className="caption-dot" /> GrabSpark 2026 <span>·</span> Concept preview</div>
    </div>
  );
}
