import type { Metadata } from "next";
import { connection } from "next/server";
import { AppShell } from "@/components/app-shell";
import "./globals.css";
import "./checkpoint-a1.css";
import "./fidelity.css";
import "./strategy.css";
import "./judge-demo.css";
import "./simulated-ai-workspace.css";

export const metadata: Metadata = {
  title: "GrabMerchant Concept | Westrong Kitchen",
  description: "Unofficial GrabMerchant concept with One Click merchant intelligence and synthetic data.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection();
  if (process.env.NEXT_PUBLIC_GRABSPARK_JUDGE_DEMO === "1" || process.env.VERCEL === "1") return <html lang="en"><body><a className="skip-link" href="#main-content">Skip to content</a>{children}</body></html>;
  return <html lang="en"><body><a className="skip-link" href="#main-content">Skip to content</a><AppShell allowDemoReset={process.env.GRABSPARK_DEMO_RESET_ENABLED === "1"}>{children}</AppShell></body></html>;
}
