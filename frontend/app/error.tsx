"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <section className="state-panel" role="alert"><span className="state-icon"><AlertCircle size={26} /></span><h1>Something went wrong</h1><p>The merchant view could not load. Please try again.</p><button className="primary-button" onClick={reset}><RefreshCw size={16} /> Retry</button></section>;
}
