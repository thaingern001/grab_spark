import { NextRequest } from "next/server";

type Context = { params: Promise<{ parts: string[] }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function permitted(parts: string[], method: string): boolean {
  if (method === "POST" && parts.length === 2 && parts[0] === "demo" && parts[1] === "reset") return process.env.GRABSPARK_DEMO_RESET_ENABLED === "1";
  if (parts.length < 2 || parts[0] !== "missions" || !uuid.test(parts[1])) return false;
  if (method === "GET") return parts.length === 2 || (parts.length === 3 && ["scenarios", "strategies", "outcome"].includes(parts[2]));
  if (method === "PUT") return (parts.length === 3 && parts[2] === "scenarios") || (parts.length === 4 && parts[2] === "strategies" && parts[3] === "assumptions");
  if (method === "POST") return parts.length === 3 && ["approve", "simulate", "transitions"].includes(parts[2]);
  return false;
}

async function forward(request: NextRequest, context: Context, method: "GET" | "PUT" | "POST") {
  if (process.env.NEXT_PUBLIC_GRABSPARK_JUDGE_DEMO === "1" || process.env.VERCEL === "1") {
    return Response.json({ error: { code: "not_found", message: "No backend is available in the interactive concept demo" } }, { status: 404 });
  }
  const { parts } = await context.params;
  if (!permitted(parts, method)) return Response.json({ error: { code: "not_found", message: "Resource not found" } }, { status: 404 });

  const session = process.env.GRABSPARK_DEMO_SESSION;
  const csrf = process.env.GRABSPARK_DEMO_CSRF;
  if (!session || (method !== "GET" && !csrf)) {
    return Response.json({ error: { code: "session_missing", message: "Local merchant session is not configured" } }, { status: 503 });
  }

  if (method !== "GET") {
    const url = new URL(request.url);
    const host = request.headers.get("host") ?? "";
    const localHost = /^(127\.0\.0\.1|localhost):\d+$/.test(host);
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");
    const expectedOrigin = `http://${host}`;
    let refererOrigin: string | null = null;
    try { if (referer) refererOrigin = new URL(referer).origin; } catch { /* Invalid referer is rejected. */ }
    const sameOrigin = origin === expectedOrigin || (!origin && refererOrigin === expectedOrigin);
    if (!localHost || !sameOrigin) {
      return Response.json({ error: { code: "forbidden", message: "Local same-origin write required" } }, { status: 403 });
    }
  }

  const base = process.env.GRABSPARK_API_BASE_URL ?? "http://127.0.0.1:8000";
  const destination = new URL(`/api/v1/${parts.join("/")}`, base);
  const headers: Record<string, string> = { Cookie: `demo_session=${session}`, Accept: "application/json" };
  if (method !== "GET") {
    headers["Content-Type"] = "application/json";
    headers["X-CSRF-Token"] = csrf!;
    const revision = request.headers.get("If-Match");
    const key = request.headers.get("Idempotency-Key");
    if (revision) headers["If-Match"] = revision;
    if (key) headers["Idempotency-Key"] = key;
  }
  try {
    const response = await fetch(destination, {
      method,
      headers,
      body: method === "GET" ? undefined : await request.text(),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    return new Response(await response.text(), {
      status: response.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ error: { code: "backend_unavailable", message: "Merchant service is unavailable" } }, { status: 503 });
  }
}

export async function GET(request: NextRequest, context: Context) { return forward(request, context, "GET"); }
export async function PUT(request: NextRequest, context: Context) { return forward(request, context, "PUT"); }
export async function POST(request: NextRequest, context: Context) { return forward(request, context, "POST"); }
