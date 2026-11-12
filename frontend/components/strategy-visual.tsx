"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import type { StrategyId } from "@/types/api";

const visuals: Record<StrategyId, { src: string; alt: string }> = {
  bundle: { src: "/strategy-previews/bundle-concept.png", alt: "AI-generated concept of a chicken rice and drink bundle" },
  discount: { src: "/strategy-previews/discount-concept.png", alt: "AI-generated concept for a meal discount offer" },
  advertising: { src: "/strategy-previews/advertising-concept.png", alt: "AI-generated concept for a food advertisement" },
};

export function StrategyVisual({ strategyId, variant = "thumbnail", source }: { strategyId: StrategyId; variant?: "hero" | "thumbnail" | "detail"; source?: string }) {
  const visual = visuals[strategyId];
  const src = source ?? visual.src;
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const failed = failedSource === src;
  return <span className={`strategy-visual is-${variant}`}>
    <span className="strategy-visual-image">
      {failed ? <span className="strategy-visual-fallback"><ImageOff size={22} aria-hidden="true" /><span>Concept preview unavailable</span></span> : <Image src={src} alt={visual.alt} fill sizes={variant === "thumbnail" ? "64px" : variant === "hero" ? "(max-width: 430px) 90vw, 380px" : "(max-width: 430px) 90vw, 600px"} quality={75} onError={() => setFailedSource(src)} priority={variant === "hero"} />}
    </span>
    {variant !== "thumbnail" && <span className="strategy-visual-caption">AI-generated concept preview</span>}
  </span>;
}
