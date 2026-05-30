import type {
  AdminStore,
  AuthMe,
  AuthUser,
  DashboardStats,
  PriceEvent,
  Product,
  Store,
  SyncProgress,
  TokenResponse,
  ToolSettings,
} from "../types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api";
const TOKEN_KEY = "ozon-auth-token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore storage error
  }
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), ...authHeaders() },
  });
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
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export const api = {
  register: (email: string, username: string, password: string) =>
    request<TokenResponse>("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, username, password }),
    }),
  login: (email: string, password: string) =>
    request<TokenResponse>("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<AuthMe>("/auth/me"),
  updateProfile: (payload: { username?: string; password?: string }) =>
    request<AuthUser>("/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  getAdminUsers: () => request<AuthUser[]>("/admin/users"),
  updateUserName: (userId: number, username: string) =>
    request<AuthUser>(`/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    }),
  setUserActive: (userId: number, isActive: boolean) =>
    request<AuthUser>(`/admin/users/${userId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: isActive }),
    }),
  resetUserPassword: (userId: number, password: string) =>
    request<AuthUser>(`/admin/users/${userId}/password`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }),
  deleteUser: (userId: number) =>
    request<void>(`/admin/users/${userId}`, { method: "DELETE" }),
  getAdminStores: () => request<AdminStore[]>("/admin/stores"),
  assignStore: (storeId: number, userId: number | null) =>
    request<AdminStore>(`/admin/stores/${storeId}/assign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    }),
  getStats: () => request<DashboardStats>("/dashboard/stats"),
  getStores: () => request<Store[]>("/stores"),
  createStore: (payload: { name: string; client_id: string; api_key: string; api_base_url?: string }) =>
    request<Store>("/stores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updateStore: (
    storeId: number,
    payload: {
      name?: string;
      client_id?: string;
      api_key?: string;
      api_base_url?: string;
      auto_reprice_enabled?: boolean;
      auto_sync_interval_minutes?: number;
      scan_interval_minutes?: number;
    }
  ) =>
    request<Store>(`/stores/${storeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  syncStoreProducts: (storeId: number, onProgress?: (progress: SyncProgress) => void) =>
    syncStoreProductsStream(storeId, onProgress),
  getProducts: () => request<Product[]>("/products"),
  updateProductCosts: (items: { product_id: number; cost_price: number }[]) =>
    request<{ updated: number }>("/products/costs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(items),
    }),
  toggleAutoReprice: (productId: number, enabled: boolean) =>
    request<{ product_id: number; enabled: boolean }>(`/products/${productId}/toggle?enabled=${enabled}`, {
      method: "PUT",
    }),
  getEvents: () => request<PriceEvent[]>("/dashboard/events?limit=50"),
  scanNow: () => request<{ ok: boolean }>("/dashboard/scan-now", { method: "POST" }),
  getSettings: () => request<ToolSettings>("/settings"),
  updateScanInterval: (minutes: number) =>
    request<ToolSettings>("/settings/scan-interval", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minutes }),
    }),
  updateAutoSyncInterval: (minutes: number) =>
    request<ToolSettings>("/settings/auto-sync-interval", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minutes }),
    }),
  updateRepricingRules: (payload: { price_step: number }) =>
    request<ToolSettings>("/settings/repricing-rules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
};

async function syncStoreProductsStream(
  storeId: number,
  onProgress?: (progress: SyncProgress) => void
): Promise<{ store_id: number; synced: number }> {
  const res = await fetch(`${API_BASE}/stores/${storeId}/sync-products`, {
    method: "POST",
    headers: { ...authHeaders() },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `同步失败 (${res.status})`);
  }
  if (!res.body) {
    throw new Error("同步响应为空");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let synced = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const line = block.trim();
      if (!line.startsWith("data: ")) continue;
      const payload = JSON.parse(line.slice(6)) as SyncProgress;
      onProgress?.(payload);
      if (payload.phase === "done") {
        synced = payload.synced ?? 0;
      }
      if (payload.phase === "error") {
        throw new Error(payload.message || "同步失败");
      }
    }
  }

  return { store_id: storeId, synced };
}

export function createEventSource() {
  const streamBase = API_BASE.replace(/\/api$/, "");
  const token = getToken();
  const query = token ? `?token=${encodeURIComponent(token)}` : "";
  return new EventSource(`${streamBase}/api/events/stream${query}`);
}
