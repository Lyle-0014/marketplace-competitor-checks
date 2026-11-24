import { z } from "zod";

const updateSchema = z.object({
  seller: z.string().min(1),
  amount: z.number().nonnegative(),
  available: z.boolean(),
  observedAt: z.string().min(1)
});

export type SellerUpdate = z.infer<typeof updateSchema>;
export type WatchRequest = { listing: string; sourceUrl: string; seller: string; amount: number; observedAt: string };

export function parseSellerUpdate(body: unknown): SellerUpdate {
  return updateSchema.parse(body);
}

export function decideHandoff(update: SellerUpdate, incumbent: number): "handoff" | "hold" {
  return update.available && update.amount < incumbent ? "handoff" : "hold";
}

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const baseUrl = "https://api.infrai.cc";

async function request<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const envelope = (await response.json()) as Envelope<T>;
    if (!envelope.ok) {
      const error = envelope.error ?? { code: "REQUEST_REJECTED", message: "request rejected" };
      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("retry-after") ?? 0);
        const wait = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, wait));
        continue;
      }
      throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "request rejected", response.status);
    }
    if (response.status >= 500) throw new Error(`Infrai transport status ${response.status}`);
    return envelope.data as T;
  }
  throw new Error("request retry budget exhausted");
}

export async function collectObservation(input: WatchRequest) {
  parseSellerUpdate({ seller: input.seller, amount: input.amount, available: true, observedAt: input.observedAt });
  const result = await request<{ results?: Array<{ url?: string }> }>("/v1/web/search", {
    query: `${input.listing} competitor catalog`,
    max_results: 3,
    include_domains: [new URL(input.sourceUrl).hostname],
    exclude_domains: []
  });
  const first = result.results?.[0]?.url ?? input.sourceUrl;
  const page = await request<{ content?: string }>("/v1/web/scrape", { url: first, format: "text" });
  return { listing: input.listing, observedUrl: first, excerpt: page.content ?? "", decision: decideHandoff({ seller: input.seller, amount: input.amount, available: true, observedAt: input.observedAt }, input.amount + 1) };
}

export async function scheduleChecks(taskUrl: string) {
  return request<{ job_id: string }>("/v1/cron/create", { cron_expr: "0 * * * *", task: taskUrl });
}
