import type { ErrorEnvelope } from "@/types/api";

export class MerchantApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = "MerchantApiError";
  }
}

export async function merchantRequest<T>(path: string, options: { method?: "GET" | "POST" | "PUT"; body?: unknown; revision?: number; idempotencyKey?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.revision !== undefined) headers["If-Match"] = String(options.revision);
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;
  let response: Response;
  try {
    response = await fetch(`/api/merchant${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch {
    throw new MerchantApiError(503, "network_error", "Connection lost. Please retry the action.");
  }
  if (!response.ok) {
    let message = `Merchant service error (${response.status})`;
    let code = "api_error";
    try {
      const envelope = (await response.json()) as ErrorEnvelope;
      message = envelope.error?.message ?? message;
      code = envelope.error?.code ?? code;
    } catch { /* Keep status if an upstream response is not JSON. */ }
    throw new MerchantApiError(response.status, code, message);
  }
  return response.json() as Promise<T>;
}
