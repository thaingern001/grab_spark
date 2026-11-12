import "server-only";
import type { Dashboard, Merchant, Mission, ScenarioComparison, ErrorEnvelope, SalesSeries, MenuPerformance, MenuItem, MissionOutcome, StrategyEvaluation } from "@/types/api";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const baseUrl = process.env.GRABSPARK_API_BASE_URL ?? "http://127.0.0.1:8000";

async function read<T>(path: string): Promise<T> {
  const session = process.env.GRABSPARK_DEMO_SESSION;
  if (!session) {
    throw new ApiError(401, "session_missing", "The local demo session is not configured.");
  }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(new URL(`/api/v1${path}`, baseUrl), {
        method: "GET",
        headers: { Cookie: `demo_session=${session}`, Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(6000),
      });
      if (!response.ok) {
        let message = `Business data request failed (${response.status}).`;
        let code = "api_error";
        try {
          const body = (await response.json()) as ErrorEnvelope;
          message = body.error?.message ?? message;
          code = body.error?.code ?? code;
        } catch {
          // Preserve the HTTP status when an upstream error is not JSON.
        }
        if (response.status >= 500 && attempt === 0) continue;
        throw new ApiError(response.status, code, message);
      }
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (attempt === 0) continue;
    }
  }
  throw new ApiError(503, "backend_unavailable", "The merchant data service is unavailable. Check that the local backend is running.");
}

export const merchant = () => read<Merchant>("/merchants/me");
export const dashboard = () => read<Dashboard>("/dashboard");
export const mission = (id: string) => read<Mission>(`/missions/${encodeURIComponent(id)}`);
export const scenario = (id: string) => read<ScenarioComparison>(`/missions/${encodeURIComponent(id)}/scenarios`);
export const strategies = (id: string) => read<StrategyEvaluation>(`/missions/${encodeURIComponent(id)}/strategies`);
export const missions = () => read<Mission[]>("/missions");
export const menus = () => read<MenuItem[]>("/menus");
export const outcome = (id: string) => read<MissionOutcome>(`/missions/${encodeURIComponent(id)}/outcome`);
export const sales = (from: string, to: string, granularity: "day" | "month") => read<SalesSeries>(`/analytics/sales?from=${from}&to=${to}&granularity=${granularity}`);
export const menuPerformance = (from: string, to: string, limit = 10) => read<MenuPerformance[]>(`/analytics/menus?from=${from}&to=${to}&limit=${limit}`);
