import Link from "next/link";
import { AlertCircle, LockKeyhole, RefreshCw } from "lucide-react";
import { ApiError } from "@/lib/api";

export function DataState({ error }: { error: unknown }) {
  const known = error instanceof ApiError ? error : null;
  const auth = known?.status === 401 || known?.status === 403;
  const missing = known?.status === 404;
  return (
    <section className="state-panel" role="alert">
      <span className="state-icon">{auth ? <LockKeyhole size={26} /> : <AlertCircle size={26} />}</span>
      <h1>{auth ? "Connect the demo merchant account" : missing ? "Opportunity not found" : "Could not load store data"}</h1>
      <p>{auth ? "Set up a demo session to view Westrong Kitchen's synthetic data." : missing ? "This mission may have changed. Return Home to see the latest opportunity." : "The local merchant service is unavailable. Check the backend and try again."}</p>
      {known?.code === "session_missing" && <p className="state-detail">The web server needs <code>GRABSPARK_DEMO_SESSION</code></p>}
      <div className="state-actions"><Link href="/" className="secondary-button">Home</Link><a href="" className="primary-button"><RefreshCw size={16} /> Try again</a></div>
    </section>
  );
}
