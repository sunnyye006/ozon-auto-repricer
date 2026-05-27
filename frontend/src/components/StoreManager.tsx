import { useState } from "react";

import { api } from "../api/client";
import type { Store } from "../types";

type Props = {
  stores: Store[];
  onStoreChanged: () => Promise<void>;
};

const sectionStyle = {
  border: "1px solid #dbe7ff",
  borderRadius: 10,
  padding: 14,
  background: "linear-gradient(180deg, #ffffff 0%, #f7fbff 100%)",
} as const;

export function StoreManager({ stores, onStoreChanged }: Props) {
  const [form, setForm] = useState({ name: "", client_id: "", api_key: "", api_base_url: "" });
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!form.name.trim() || !form.client_id.trim() || !form.api_key.trim()) {
      alert("请填写店铺名称、Client ID 和 API Key");
      return;
    }
    setLoading(true);
    try {
      await api.createStore(form);
      setForm({ name: "", client_id: "", api_key: "", api_base_url: "" });
      await onStoreChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : "绑定店铺失败");
    } finally {
      setLoading(false);
    }
  }

  async function syncProducts(storeId: number) {
    setLoading(true);
    try {
      const result = await api.syncStoreProducts(storeId);
      alert(`同步完成，共 ${result.synced} 个商品`);
      await onStoreChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : "同步商品失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={sectionStyle}>
        <h3 style={{ marginTop: 0, color: "#1d4f91" }}>新增店铺</h3>
        <p style={{ marginTop: 0, color: "#666", fontSize: 13 }}>填写 Ozon Seller API 凭据后绑定新店铺。</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            placeholder="店铺名称"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            style={{ border: "1px solid #c5d7ff", borderRadius: 6, padding: "8px 10px", minWidth: 140 }}
          />
          <input
            placeholder="Client ID"
            value={form.client_id}
            onChange={(e) => setForm({ ...form, client_id: e.target.value })}
            style={{ border: "1px solid #c5d7ff", borderRadius: 6, padding: "8px 10px", minWidth: 140 }}
          />
          <input
            placeholder="API Key"
            value={form.api_key}
            onChange={(e) => setForm({ ...form, api_key: e.target.value })}
            style={{ border: "1px solid #c5d7ff", borderRadius: 6, padding: "8px 10px", minWidth: 180 }}
          />
          <input
            placeholder="API Base URL (可选)"
            value={form.api_base_url}
            onChange={(e) => setForm({ ...form, api_base_url: e.target.value })}
            style={{ border: "1px solid #c5d7ff", borderRadius: 6, padding: "8px 10px", minWidth: 220 }}
          />
          <button
            disabled={loading}
            onClick={submit}
            style={{
              border: "1px solid #4f8cff",
              borderRadius: 7,
              padding: "8px 16px",
              color: "#fff",
              background: "linear-gradient(135deg, #4f8cff, #6d5efc)",
              cursor: "pointer",
            }}
          >
            绑定店铺
          </button>
        </div>
      </div>

      <div style={sectionStyle}>
        <h3 style={{ marginTop: 0, color: "#1d4f91" }}>已绑定店铺管理</h3>
        {stores.length === 0 ? (
          <p style={{ color: "#888", fontSize: 13, margin: 0 }}>暂无已绑定店铺。</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {stores.map((store) => (
              <div
                key={store.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                  padding: "10px 12px",
                  border: "1px solid #ecf2ff",
                  borderRadius: 8,
                  background: "#fff",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: "#12263f" }}>{store.name}</div>
                  <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>Client ID: {store.client_id}</div>
                </div>
                <button
                  disabled={loading}
                  onClick={() => syncProducts(store.id)}
                  style={{
                    border: "1px solid #7c5cff",
                    borderRadius: 7,
                    padding: "6px 14px",
                    color: "#513ad9",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  同步商品
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
