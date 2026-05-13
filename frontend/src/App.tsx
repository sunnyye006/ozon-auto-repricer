import { useEffect, useMemo, useState } from "react";

import { api, createEventSource } from "./api/client";
import { DataDimensions } from "./components/DataDimensions";
import { EventAnalyticsPanel } from "./components/EventAnalyticsPanel";
import { EventStream } from "./components/EventStream";
import { ProductTable } from "./components/ProductTable";
import { SettingsPanel } from "./components/SettingsPanel";
import { StatsCards } from "./components/StatsCards";
import type { DashboardStats, PriceEvent, Product, Store, ToolSettings } from "./types";

const MOCK_STATS: DashboardStats = {
  total_products: 128,
  top_price_capture_ratio: 0.672,
  repricing_product_count: 94,
  competitor_count: 236,
};

const MOCK_STORES: Store[] = [
  { id: 1, name: "Ozon RU 主店", client_id: "oz-main-001", api_base_url: "https://api-seller.ozon.ru", is_active: true },
  { id: 2, name: "Ozon RU 备店", client_id: "oz-backup-002", api_base_url: "https://api-seller.ozon.ru", is_active: true },
];

const MOCK_PRODUCTS: Product[] = [
  { id: 1001, store_id: 1, ozon_product_id: "oz-1001", name: "蓝牙耳机 Pro", current_price: "1299.00", cost_price: "980.00", auto_reprice_enabled: true },
  { id: 1002, store_id: 1, ozon_product_id: "oz-1002", name: "智能手环 S4", current_price: "899.00", cost_price: "620.00", auto_reprice_enabled: true },
  { id: 1003, store_id: 2, ozon_product_id: "oz-1003", name: "车载充电器 65W", current_price: "459.00", cost_price: "300.00", auto_reprice_enabled: false },
  { id: 1004, store_id: 2, ozon_product_id: "oz-1004", name: "Type-C 数据线 2m", current_price: "129.00", cost_price: "78.00", auto_reprice_enabled: true },
];

const MOCK_EVENTS: PriceEvent[] = [
  { platform: "Ozon", store_name: "Ozon RU 主店", product_name: "蓝牙耳机 Pro", direction: "↓", timestamp: "2026-05-13T20:50:15+08:00", old_price: "1299.00", new_price: "1298.90" },
  { platform: "Ozon", store_name: "Ozon RU 备店", product_name: "Type-C 数据线 2m", direction: "↓", timestamp: "2026-05-13T20:49:02+08:00", old_price: "129.00", new_price: "128.90" },
  { platform: "Ozon", store_name: "Ozon RU 主店", product_name: "智能手环 S4", direction: "↑", timestamp: "2026-05-13T20:47:36+08:00", old_price: "898.50", new_price: "899.00" },
  { platform: "Ozon", store_name: "Ozon RU 主店", product_name: "蓝牙耳机 Pro", direction: "↓", timestamp: "2026-05-13T20:44:21+08:00", old_price: "1299.10", new_price: "1299.00" },
];

const MOCK_SETTINGS: ToolSettings = { scan_interval_minutes: 10, preset_options: [5, 10, 20] };

export default function App() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [events, setEvents] = useState<PriceEvent[]>([]);
  const [toolSettings, setToolSettings] = useState<ToolSettings | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [usingMockData, setUsingMockData] = useState(false);

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => String(b.timestamp ?? b.created_at).localeCompare(String(a.timestamp ?? a.created_at))),
    [events]
  );

  async function reloadAll() {
    try {
      const [statsData, storesData, productsData, eventData, settingsData] = await Promise.all([
        api.getStats(),
        api.getStores(),
        api.getProducts(),
        api.getEvents(),
        api.getSettings(),
      ]);
      setStats(statsData);
      setStores(storesData);
      setProducts(productsData);
      setEvents(eventData);
      setToolSettings(settingsData);
      setUsingMockData(false);
    } catch {
      setStats(MOCK_STATS);
      setStores(MOCK_STORES);
      setProducts(MOCK_PRODUCTS);
      setEvents(MOCK_EVENTS);
      setToolSettings(MOCK_SETTINGS);
      setUsingMockData(true);
    }
  }

  useEffect(() => {
    void reloadAll();
    const source = createEventSource();
    source.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data) as PriceEvent;
        setEvents((prev) => [payload, ...prev].slice(0, 300));
      } catch {
        // 忽略非 JSON 消息
      }
    };
    source.onerror = () => {
      source.close();
    };
    return () => source.close();
  }, []);

  return (
    <>
      <main
        style={{
          maxWidth: 1360,
          margin: "0 auto",
          padding: 20,
          display: "grid",
          gap: 16,
          background: "linear-gradient(180deg, #f0f8ff 0%, #f8fbff 35%, #f9f5ff 100%)",
          minHeight: "100vh",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1 style={{ marginBottom: 0, color: "#12263f" }}>Ozon 自动跟卖调价工具</h1>
          {usingMockData && (
            <span
              style={{
                border: "1px solid #ffd699",
                background: "#fff7e8",
                color: "#a15d00",
                borderRadius: 8,
                padding: "4px 10px",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              演示数据模式
            </span>
          )}
        </div>
        <StatsCards stats={stats} />

        <section style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
          <DataDimensions stats={stats} events={sortedEvents.slice(0, 100)} products={products} stores={stores} />
        </section>

        <ProductTable products={products} />

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(420px, 620px) minmax(480px, 1fr)",
            gap: 16,
            alignItems: "start",
          }}
        >
          <EventStream events={sortedEvents.slice(0, 100)} />
          <EventAnalyticsPanel events={sortedEvents.slice(0, 100)} topRatio={stats?.top_price_capture_ratio ?? 0} />
        </section>
      </main>

      <button
        onClick={() => setSettingsOpen((prev) => !prev)}
        aria-label={settingsOpen ? "关闭设置" : "打开设置"}
        title={settingsOpen ? "关闭设置" : "打开设置"}
        style={{
          position: "fixed",
          top: 14,
          right: 14,
          zIndex: 999,
          width: 42,
          height: 42,
          border: "1px solid #8bb8ff",
          borderRadius: 10,
          background: "linear-gradient(135deg, #4f8cff, #6d5efc)",
          color: "#fff",
          cursor: "pointer",
          fontSize: 22,
          lineHeight: "22px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        ⚙
      </button>

      {settingsOpen && (
        <div
          style={{
            position: "fixed",
            top: 62,
            right: 14,
            zIndex: 998,
            width: 410,
            maxWidth: "calc(100vw - 28px)",
            maxHeight: "calc(100vh - 76px)",
            overflow: "auto",
            background: "linear-gradient(180deg, #f4f9ff 0%, #f7f3ff 100%)",
            border: "1px solid #d7e7ff",
            borderRadius: 10,
            boxShadow: "0 12px 32px rgba(2, 6, 23, 0.18)",
            padding: 10,
            boxSizing: "border-box",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <b>设置</b>
            <button
              onClick={() => setSettingsOpen(false)}
              style={{ border: "1px solid #d9d9d9", borderRadius: 6, background: "#fff", padding: "4px 8px" }}
            >
              关闭
            </button>
          </div>
          <SettingsPanel
            stores={stores}
            toolSettings={toolSettings}
            onStoreChanged={reloadAll}
            onSettingsChanged={setToolSettings}
            hideTitle
          />
        </div>
      )}
    </>
  );
}
