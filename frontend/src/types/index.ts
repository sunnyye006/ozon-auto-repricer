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
};

export type Product = {
  id: number;
  store_id: number;
  ozon_product_id: string;
  sku?: string;
  name: string;
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

export type ToolSettings = {
  scan_interval_minutes: number;
  preset_options: number[];
  repricing_rules: {
    price_step: string;
    price_step_presets: string[];
  };
};
