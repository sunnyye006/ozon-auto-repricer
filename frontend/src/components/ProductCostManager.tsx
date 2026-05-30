import { useEffect, useMemo, useState } from "react";

import { api } from "../api/client";
import type { Product, Store } from "../types";

type Props = {
  products: Product[];
  stores: Store[];
  onProductsChanged: () => Promise<void>;
};

function ToggleSwitch({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        position: "relative",
        width: 40,
        height: 22,
        borderRadius: 999,
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        background: checked ? "linear-gradient(135deg, #4f8cff, #6d5efc)" : "#cdd6e5",
        transition: "background 0.2s ease",
        padding: 0,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: checked ? 21 : 3,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 2px rgba(0,0,0,0.18)",
          transition: "left 0.2s ease",
        }}
      />
    </button>
  );
}

const ALL_STORES = "__all__";
const PAGE_SIZE_OPTIONS = [10, 20, 50];

export function ProductCostManager({ products, stores, onProductsChanged }: Props) {
  const storeNameById = useMemo(() => new Map(stores.map((s) => [s.id, s.name])), [stores]);
  const [selectedStore, setSelectedStore] = useState<string>(ALL_STORES);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftCost, setDraftCost] = useState<string>("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [autoOverride, setAutoOverride] = useState<Record<number, boolean>>({});
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);

  useEffect(() => {
    if (selectedStore !== ALL_STORES && !stores.some((s) => String(s.id) === selectedStore)) {
      setSelectedStore(ALL_STORES);
    }
  }, [selectedStore, stores]);

  useEffect(() => {
    setPage(1);
  }, [selectedStore, search, pageSize]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return products.filter((p) => {
      if (selectedStore !== ALL_STORES && String(p.store_id) !== selectedStore) return false;
      if (!keyword) return true;
      return (
        p.name.toLowerCase().includes(keyword) ||
        (p.sku ?? "").toLowerCase().includes(keyword) ||
        p.ozon_product_id.includes(keyword)
      );
    });
  }, [products, selectedStore, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage, pageSize]
  );
  const startIndex = filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endIndex = Math.min(safePage * pageSize, filtered.length);

  function startEdit(product: Product) {
    setEditingId(product.id);
    setDraftCost(String(product.cost_price));
  }

  function cancelEdit() {
    setEditingId(null);
    setDraftCost("");
  }

  async function saveCost(product: Product) {
    const cost = Number(draftCost);
    if (!Number.isFinite(cost) || cost <= 0) {
      alert("成本价必须大于 0");
      return;
    }
    setSavingId(product.id);
    try {
      await api.updateProductCosts([{ product_id: product.id, cost_price: cost }]);
      await onProductsChanged();
      cancelEdit();
    } catch (err) {
      alert(err instanceof Error ? err.message : "保存成本价失败");
    } finally {
      setSavingId(null);
    }
  }

  function toggleAutoReprice(product: Product, next: boolean) {
    setAutoOverride((prev) => ({ ...prev, [product.id]: next }));
    void (async () => {
      try {
        await api.toggleAutoReprice(product.id, next);
        await onProductsChanged();
      } catch (err) {
        alert(err instanceof Error ? err.message : "切换自动调价失败");
      } finally {
        setAutoOverride((prev) => {
          const nextState = { ...prev };
          delete nextState[product.id];
          return nextState;
        });
      }
    })();
  }

  const storeCounts = useMemo(() => {
    const map = new Map<number, number>();
    for (const p of products) map.set(p.store_id, (map.get(p.store_id) ?? 0) + 1);
    return map;
  }, [products]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <header>
        <h1 style={{ margin: 0, color: "#12263f", fontSize: 26 }}>商品成本管理</h1>
        <p style={{ margin: "6px 0 0", color: "#666", fontSize: 13 }}>
          支持多店铺切换。逐条编辑成本价（触及成本价后停止跟价）并控制商品级自动调价开关。
        </p>
      </header>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => setSelectedStore(ALL_STORES)}
          style={{
            border: selectedStore === ALL_STORES ? "1px solid #4f8cff" : "1px solid #d6e2ff",
            background: selectedStore === ALL_STORES ? "#eef4ff" : "#fff",
            color: selectedStore === ALL_STORES ? "#2b5fcc" : "#415472",
            borderRadius: 7,
            padding: "6px 12px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          全部店铺 ({products.length})
        </button>
        {stores.map((store) => {
          const active = String(store.id) === selectedStore;
          return (
            <button
              key={store.id}
              type="button"
              onClick={() => setSelectedStore(String(store.id))}
              style={{
                border: active ? "1px solid #4f8cff" : "1px solid #d6e2ff",
                background: active ? "#eef4ff" : "#fff",
                color: active ? "#2b5fcc" : "#415472",
                borderRadius: 7,
                padding: "6px 12px",
                cursor: "pointer",
              }}
            >
              {store.name} ({storeCounts.get(store.id) ?? 0})
            </button>
          );
        })}
        <input
          placeholder="搜索商品名 / SKU / Ozon ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            marginLeft: "auto",
            border: "1px solid #c5d7ff",
            borderRadius: 7,
            padding: "8px 10px",
            minWidth: 260,
          }}
        />
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: "#888", fontSize: 13 }}>暂无商品，请在「设置 → 已绑定店铺管理」中同步商品。</p>
      ) : (
        <div
          style={{
            border: "1px solid #e6eefb",
            borderRadius: 10,
            background: "#fff",
            overflow: "hidden",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f1f6ff", color: "#1d4f91" }}>
                  <th align="left" style={{ padding: "10px 8px", width: 72 }}>图片</th>
                  <th align="left" style={{ padding: "10px 8px" }}>商品名称</th>
                  <th align="left" style={{ padding: "10px 8px", width: 80 }}>平台</th>
                  <th align="left" style={{ padding: "10px 8px", width: 140 }}>店铺名称</th>
                  <th align="left" style={{ padding: "10px 8px", width: 110 }}>当前售价</th>
                  <th align="left" style={{ padding: "10px 8px", width: 160 }}>成本价</th>
                  <th align="left" style={{ padding: "10px 8px", width: 130 }}>自动调价</th>
                  <th align="left" style={{ padding: "10px 8px", width: 160 }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((product) => {
                  const isEditing = editingId === product.id;
                  return (
                    <tr key={product.id} style={{ borderTop: "1px solid #eef3ff" }}>
                      <td style={{ padding: "8px" }}>
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6, border: "1px solid #eef3ff" }}
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                            }}
                          />
                        ) : (
                          <div style={{ width: 56, height: 56, borderRadius: 6, background: "#f1f6ff", color: "#9aaccb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>无图</div>
                        )}
                      </td>
                      <td style={{ padding: "8px", maxWidth: 320 }}>
                        <div style={{ fontWeight: 600, color: "#12263f", lineHeight: 1.35 }}>{product.name}</div>
                        <div style={{ fontSize: 11, color: "#8092ad", marginTop: 4 }}>
                          {product.sku ? `SKU: ${product.sku} · ` : ""}ID: {product.ozon_product_id}
                        </div>
                      </td>
                      <td style={{ padding: "8px", color: "#415472" }}>{product.platform ?? "Ozon"}</td>
                      <td style={{ padding: "8px", color: "#415472" }}>{storeNameById.get(product.store_id) ?? `#${product.store_id}`}</td>
                      <td style={{ padding: "8px", color: "#12263f", fontVariantNumeric: "tabular-nums" }}>{product.current_price} ₽</td>
                      <td style={{ padding: "8px" }}>
                        {isEditing ? (
                          <input
                            type="number"
                            min={0.01}
                            step={0.01}
                            value={draftCost}
                            onChange={(e) => setDraftCost(e.target.value)}
                            autoFocus
                            style={{ border: "1px solid #4f8cff", borderRadius: 6, padding: "6px 8px", width: 120 }}
                          />
                        ) : (
                          <span style={{ color: "#12263f", fontVariantNumeric: "tabular-nums" }}>{product.cost_price} ₽</span>
                        )}
                      </td>
                      <td style={{ padding: "8px" }}>
                        <ToggleSwitch
                          checked={autoOverride[product.id] ?? product.auto_reprice_enabled}
                          onChange={(v) => toggleAutoReprice(product, v)}
                        />
                      </td>
                      <td style={{ padding: "8px" }}>
                        {isEditing ? (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              type="button"
                              disabled={savingId === product.id}
                              onClick={() => saveCost(product)}
                              style={{ border: "1px solid #4f8cff", borderRadius: 6, padding: "4px 10px", color: "#fff", background: "linear-gradient(135deg, #4f8cff, #6d5efc)", cursor: "pointer" }}
                            >
                              保存
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              style={{ border: "1px solid #c5d7ff", borderRadius: 6, padding: "4px 10px", background: "#fff", color: "#666", cursor: "pointer" }}
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEdit(product)}
                            style={{ border: "1px solid #c5d7ff", borderRadius: 6, padding: "4px 12px", background: "#fff", color: "#2b5fcc", cursor: "pointer" }}
                          >
                            编辑
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              padding: "10px 14px",
              borderTop: "1px solid #eef3ff",
              background: "#fafcff",
              flexWrap: "wrap",
            }}
          >
            <div style={{ color: "#415472", fontSize: 13 }}>
              共 {filtered.length} 条 · 显示 {startIndex}–{endIndex}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <label style={{ fontSize: 13, color: "#415472" }}>每页</label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                style={{ border: "1px solid #c5d7ff", borderRadius: 6, padding: "4px 8px" }}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage(1)}
                style={{ border: "1px solid #c5d7ff", borderRadius: 6, padding: "4px 8px", background: "#fff", color: safePage <= 1 ? "#aab8d4" : "#2b5fcc", cursor: safePage <= 1 ? "not-allowed" : "pointer" }}
              >
                «
              </button>
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{ border: "1px solid #c5d7ff", borderRadius: 6, padding: "4px 10px", background: "#fff", color: safePage <= 1 ? "#aab8d4" : "#2b5fcc", cursor: safePage <= 1 ? "not-allowed" : "pointer" }}
              >
                上一页
              </button>
              <span style={{ fontSize: 13, color: "#415472", minWidth: 60, textAlign: "center" }}>
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                style={{ border: "1px solid #c5d7ff", borderRadius: 6, padding: "4px 10px", background: "#fff", color: safePage >= totalPages ? "#aab8d4" : "#2b5fcc", cursor: safePage >= totalPages ? "not-allowed" : "pointer" }}
              >
                下一页
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage(totalPages)}
                style={{ border: "1px solid #c5d7ff", borderRadius: 6, padding: "4px 8px", background: "#fff", color: safePage >= totalPages ? "#aab8d4" : "#2b5fcc", cursor: safePage >= totalPages ? "not-allowed" : "pointer" }}
              >
                »
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
