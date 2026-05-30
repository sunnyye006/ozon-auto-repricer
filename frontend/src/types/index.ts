export type DashboardStats = {
  total_products: number;
  top_price_capture_ratio: number;
  repricing_product_count: number;
  competitor_count: number;
};

export type Store = {
  id: number;
  name: string;
  client_id: string;
  api_base_url: string;
  is_active: boolean;
  auto_reprice_enabled: boolean;
  auto_sync_interval_minutes: number;
  scan_interval_minutes: number;
  last_synced_at?: string | null;
  last_scanned_at?: string | null;
};

export type SyncProgress = {
  phase: "fetch" | "sync" | "done" | "error";
  current?: number;
  total?: number;
  synced?: number;
  message: string;
};

export type Product = {
  id: number;
  store_id: number;
  ozon_product_id: string;
  sku?: string;
  name: string;
  image_url?: string | null;
  platform?: string;
  current_price: string;
  cost_price: string;
  auto_reprice_enabled: boolean;
};

export type PriceEvent = {
  platform: "Ozon";
  store_name: string;
  product_name: string;
  direction: "↑" | "↓";
  timestamp?: string;
  created_at?: string;
  old_price?: string;
  new_price?: string;
};

export type AuthUser = {
  id: number;
  email: string;
  username?: string | null;
  role: "admin" | "user";
  is_active: boolean;
  created_at: string;
};

export type AuthMe = {
  authenticated: boolean;
  auth_enabled: boolean;
  id?: number | null;
  email?: string | null;
  username?: string | null;
  role?: "admin" | "user" | null;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
  user: AuthUser;
};

export type AdminStore = {
  id: number;
  name: string;
  owner_id: number | null;
  owner_email: string | null;
  is_active: boolean;
  auto_reprice_enabled: boolean;
};

export type ToolSettings = {
  scan_interval_minutes: number;
  auto_sync_interval_minutes: number;
  preset_options: number[];
  auto_sync_preset_options: number[];
  repricing_rules: {
    price_step: string;
    price_step_presets: string[];
  };
};
