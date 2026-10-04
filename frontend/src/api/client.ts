// Typed API client. Base URL comes from VITE_API_URL (set per environment, never a secret).
//
// The free backend sleeps when idle and takes about a minute to wake. While a request is slow
// we flip a shared "waking" flag so the UI can show the 'Waking the server' state, and we retry
// the gateway errors a sleeping host can return.

import type {
  PerformanceResponse,
  PortfolioResponse,
  Transaction,
  ValidateResponse,
} from "./types";

const BASE = (import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");
const SLOW_MS = 2500; // after this, assume a cold start and say so
const TIMEOUT_MS = 100_000; // a cold start can take about a minute
const RETRIES = 6; // with the backoff below, keeps trying for about a minute

export class ApiError extends Error {
  readonly status: number;
  readonly errors: string[];

  constructor(status: number, errors: string[]) {
    super(errors[0] ?? `Request failed (${status})`);
    this.status = status;
    this.errors = errors;
  }
}

// ---- server status (tiny external store for useSyncExternalStore) ------------------
export type ServerStatus = "unknown" | "waking" | "ready";
let status: ServerStatus = "unknown";
let wakingSince: number | null = null;
let pending = 0;
const listeners = new Set<() => void>();

function setStatus(next: ServerStatus) {
  if (next === status) return;
  status = next;
  wakingSince = next === "waking" ? Date.now() : null;
  listeners.forEach((l) => l());
}

export const serverStatus = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  get: () => status,
  wakingSince: () => wakingSince,
};

// ---- core request ----------------------------------------------------------------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  pending += 1;
  const slowTimer = setTimeout(() => {
    if (status !== "ready") setStatus("waking");
  }, SLOW_MS);
  try {
    for (let attempt = 0; ; attempt++) {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(`${BASE}${path}`, {
          ...init,
          signal: ctrl.signal,
          headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
        });
      } catch (e) {
        clearTimeout(timeout);
        if (attempt < RETRIES) {
          setStatus("waking");
          await sleep(Math.min(3000 * (attempt + 1), 15_000));
          continue;
        }
        const aborted = e instanceof DOMException && e.name === "AbortError";
        throw new ApiError(0, [
          aborted
            ? "The server took too long to respond. Please try again in a minute."
            : "Could not reach the server. Check your connection and try again.",
        ]);
      }
      clearTimeout(timeout);
      if ([502, 503, 504].includes(res.status) && attempt < RETRIES) {
        setStatus("waking");
        await sleep(Math.min(3000 * (attempt + 1), 15_000));
        continue;
      }
      setStatus("ready");
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const errors =
          body && Array.isArray(body.errors) && body.errors.length
            ? (body.errors as string[])
            : [`The server returned an error (${res.status}).`];
        throw new ApiError(res.status, errors);
      }
      return body as T;
    }
  } finally {
    clearTimeout(slowTimer);
    pending -= 1;
  }
}

const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });

// ---- endpoints -------------------------------------------------------------------
export const api = {
  baseUrl: BASE,
  health: () => request<{ status: string }>("/health"),
  validateCsv: (csv: string) => post<ValidateResponse>("/api/transactions/validate", { csv }),
  validateRows: (rows: Partial<Transaction>[]) =>
    post<ValidateResponse>("/api/transactions/validate", { rows }),
  portfolio: (transactions: Transaction[]) => post<PortfolioResponse>("/api/portfolio", { transactions }),
  performance: (transactions: Transaction[]) =>
    post<PerformanceResponse>("/api/performance", { transactions }),
};

/** Fire-and-forget ping on page load so a sleeping backend starts waking immediately. */
export function warmUp(): void {
  api.health().catch(() => undefined);
}

