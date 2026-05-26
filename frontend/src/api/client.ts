import type { DashboardStats, PriceEvent, Product, Store, ToolSettings } from "../types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    const text = await res.text();
    try {
      const body = JSON.parse(text) as { detail?: string | { msg?: string }[] };
      if (typeof body.detail === "string") {
        throw new Error(body.detail);
      }
      if (Array.isArray(body.detail) && body.detail[0]?.msg) {
        throw new Error(body.detail.map((item) => item.msg).join("; "));
      }
    } catch (err) {
      if (err instanceof Error && err.message !== text) {
        throw err;
      }
    }
    throw new Error(text || `请求失败 (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getStats: () => request<DashboardStats>("/dashboard/stats"),
  getStores: () => request<Store[]>("/stores"),
  createStore: (payload: { name: string; client_id: string; api_key: string; api_base_url?: string }) =>
    request<Store>("/stores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  syncStoreProducts: (storeId: number) =>
    request<{ store_id: number; synced: number }>(`/stores/${storeId}/sync-products`, {
      method: "POST",
    }),
  getProducts: () => request<Product[]>("/products"),
  getEvents: () => request<PriceEvent[]>("/dashboard/events?limit=50"),
  scanNow: () => request<{ ok: boolean }>("/dashboard/scan-now", { method: "POST" }),
  getSettings: () => request<ToolSettings>("/settings"),
  updateScanInterval: (minutes: number) =>
    request<ToolSettings>("/settings/scan-interval", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minutes }),
    }),
  updateRepricingRules: (payload: {
    price_step: number;
    cost_buffer: number;
    max_round_drop_percent: number;
    restore_when_no_competitors: boolean;
  }) =>
    request<ToolSettings>("/settings/repricing-rules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
};

export function createEventSource() {
  const streamBase = API_BASE.replace(/\/api$/, "");
  return new EventSource(`${streamBase}/api/events/stream`);
}
