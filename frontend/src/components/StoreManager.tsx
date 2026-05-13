import { useState } from "react";

import { api } from "../api/client";
import type { Store } from "../types";

type Props = {
  stores: Store[];
  onStoreChanged: () => Promise<void>;
};

export function StoreManager({ stores, onStoreChanged }: Props) {
  const [form, setForm] = useState({ name: "", client_id: "", api_key: "", api_base_url: "" });
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      await api.createStore(form);
      setForm({ name: "", client_id: "", api_key: "", api_base_url: "" });
      await onStoreChanged();
    } finally {
      setLoading(false);
    }
  }

  async function syncProducts(storeId: number) {
    setLoading(true);
    try {
      await api.syncStoreProducts(storeId);
      await onStoreChanged();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        border: "1px solid #dbe7ff",
        borderRadius: 10,
        padding: 12,
        background: "linear-gradient(180deg, #ffffff 0%, #f7fbff 100%)",
      }}
    >
      <h3 style={{ marginTop: 0, color: "#1d4f91" }}>店铺绑定与集中管理</h3>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          placeholder="店铺名称"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          style={{ border: "1px solid #c5d7ff", borderRadius: 6, padding: "6px 8px" }}
        />
        <input
          placeholder="Client ID"
          value={form.client_id}
          onChange={(e) => setForm({ ...form, client_id: e.target.value })}
          style={{ border: "1px solid #c5d7ff", borderRadius: 6, padding: "6px 8px" }}
        />
        <input
          placeholder="API Key"
          value={form.api_key}
          onChange={(e) => setForm({ ...form, api_key: e.target.value })}
          style={{ border: "1px solid #c5d7ff", borderRadius: 6, padding: "6px 8px" }}
        />
        <input
          placeholder="API Base URL (可选)"
          value={form.api_base_url}
          onChange={(e) => setForm({ ...form, api_base_url: e.target.value })}
          style={{ border: "1px solid #c5d7ff", borderRadius: 6, padding: "6px 8px" }}
        />
        <button
          disabled={loading}
          onClick={submit}
          style={{
            border: "1px solid #4f8cff",
            borderRadius: 7,
            padding: "6px 12px",
            color: "#fff",
            background: "linear-gradient(135deg, #4f8cff, #6d5efc)",
          }}
        >
          绑定店铺
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        {stores.map((store) => (
          <div
            key={store.id}
            style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #ecf2ff" }}
          >
            <span>
              {store.name} / {store.client_id}
            </span>
            <button
              disabled={loading}
              onClick={() => syncProducts(store.id)}
              style={{ border: "1px solid #7c5cff", borderRadius: 7, padding: "4px 10px", color: "#513ad9", background: "#fff" }}
            >
              同步商品
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
