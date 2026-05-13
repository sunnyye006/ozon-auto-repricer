import { useMemo, useState } from "react";

import { api } from "../api/client";
import type { PriceEvent, Product, Store } from "../types";

type Props = {
  stores: Store[];
  products: Product[];
  events: PriceEvent[];
  usingMockData: boolean;
  onRefresh: () => Promise<void>;
};

export function LiveOpsPanel({ stores, products, events, usingMockData, onRefresh }: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("待命中");

  const autoEnabledCount = useMemo(() => products.filter((p) => p.auto_reprice_enabled).length, [products]);
  const downCount = useMemo(() => events.filter((e) => e.direction === "↓").length, [events]);
  const upCount = useMemo(() => events.filter((e) => e.direction === "↑").length, [events]);

  async function triggerScan() {
    setLoading(true);
    setMessage("正在触发扫描...");
    try {
      await api.scanNow();
      await onRefresh();
      setMessage("已完成一轮扫描");
    } catch {
      setMessage("扫描触发失败");
    } finally {
      setLoading(false);
    }
  }

  async function syncStore(storeId: number) {
    setLoading(true);
    setMessage(`正在同步店铺 #${storeId} ...`);
    try {
      await api.syncStoreProducts(storeId);
      await onRefresh();
      setMessage(`店铺 #${storeId} 同步完成`);
    } catch {
      setMessage(`店铺 #${storeId} 同步失败`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <aside
      style={{
        border: "1px solid #d8e4ff",
        borderRadius: 12,
        padding: 14,
        background: "linear-gradient(180deg, #ffffff 0%, #f7f3ff 100%)",
        display: "grid",
        gap: 12,
      }}
    >
      <h3 style={{ margin: 0, color: "#5a43d1" }}>可用操作区</h3>
      <div style={{ fontSize: 13, color: "#4a5572" }}>
        状态：
        <b style={{ color: "#1f2f44" }}> {message}</b>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <button
          onClick={triggerScan}
          disabled={loading || usingMockData}
          style={{
            border: "1px solid #4f8cff",
            borderRadius: 8,
            padding: "8px 12px",
            color: "#fff",
            background: usingMockData ? "#b8c6e6" : "linear-gradient(135deg, #4f8cff, #6d5efc)",
            cursor: usingMockData ? "not-allowed" : "pointer",
          }}
        >
          立即执行一轮扫描
        </button>
        <button
          onClick={onRefresh}
          disabled={loading}
          style={{
            border: "1px solid #92a8d8",
            borderRadius: 8,
            padding: "8px 12px",
            color: "#29406e",
            background: "#fff",
          }}
        >
          刷新当前数据
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
        <div style={{ border: "1px solid #e9e2ff", borderRadius: 8, padding: 8, background: "#fff" }}>
          <div style={{ fontSize: 12, color: "#666" }}>店铺数</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#6d5efc" }}>{stores.length}</div>
        </div>
        <div style={{ border: "1px solid #dff5ea", borderRadius: 8, padding: 8, background: "#fff" }}>
          <div style={{ fontSize: 12, color: "#666" }}>可调价商品</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#09b57f" }}>{autoEnabledCount}</div>
        </div>
        <div style={{ border: "1px solid #ffe8de", borderRadius: 8, padding: 8, background: "#fff" }}>
          <div style={{ fontSize: 12, color: "#666" }}>↓ / ↑</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#f08a24" }}>
            {downCount}/{upCount}
          </div>
        </div>
      </div>

      <div style={{ borderTop: "1px solid #e8eefe", paddingTop: 10, display: "grid", gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#263b67" }}>店铺快速同步</div>
        {stores.slice(0, 4).map((store) => (
          <div key={store.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#435273" }}>{store.name}</span>
            <button
              onClick={() => syncStore(store.id)}
              disabled={loading || usingMockData}
              style={{
                border: "1px solid #a4b7e5",
                borderRadius: 7,
                padding: "4px 10px",
                color: "#425b95",
                background: "#fff",
                cursor: usingMockData ? "not-allowed" : "pointer",
              }}
            >
              同步
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
