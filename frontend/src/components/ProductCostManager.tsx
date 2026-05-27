import { useEffect, useMemo, useState } from "react";

import { api } from "../api/client";
import type { Product, Store } from "../types";

type Props = {
  products: Product[];
  stores: Store[];
  onProductsChanged: () => Promise<void>;
};

export function ProductCostManager({ products, stores, onProductsChanged }: Props) {
  const storeNameById = useMemo(() => new Map(stores.map((s) => [s.id, s.name])), [stores]);
  const [draftCosts, setDraftCosts] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  useEffect(() => {
    setDraftCosts(Object.fromEntries(products.map((p) => [p.id, String(p.cost_price)])));
  }, [products]);

  async function saveCost(productId: number) {
    const raw = draftCosts[productId] ?? "";
    const cost = Number(raw);
    if (!Number.isFinite(cost) || cost <= 0) {
      alert("成本价必须大于 0");
      return;
    }
    setSavingId(productId);
    try {
      await api.updateProductCosts([{ product_id: productId, cost_price: cost }]);
      await onProductsChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : "保存成本价失败");
    } finally {
      setSavingId(null);
    }
  }

  async function toggleAutoReprice(product: Product) {
    setTogglingId(product.id);
    try {
      await api.toggleAutoReprice(product.id, !product.auto_reprice_enabled);
      await onProductsChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : "切换自动调价失败");
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div
      style={{
        border: "1px solid #dbe7ff",
        borderRadius: 10,
        padding: 14,
        background: "linear-gradient(180deg, #ffffff 0%, #f7fbff 100%)",
      }}
    >
      <h3 style={{ marginTop: 0, color: "#1d4f91" }}>商品成本管理</h3>
      <p style={{ marginTop: 0, color: "#666", fontSize: 13, lineHeight: 1.5 }}>
        店铺同步后的商品会出现在下方。成本价保存后立即写入后端，并作为自动调价的最低底线（触及成本价后停止跟价）。
      </p>

      {products.length === 0 ? (
        <p style={{ color: "#888", fontSize: 13 }}>暂无商品，请先在「已绑定店铺管理」中同步商品。</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#eaf4ff" }}>
                <th align="left" style={{ padding: "8px 6px" }}>
                  商品
                </th>
                <th align="left" style={{ padding: "8px 6px" }}>
                  店铺
                </th>
                <th align="left" style={{ padding: "8px 6px" }}>
                  当前售价
                </th>
                <th align="left" style={{ padding: "8px 6px" }}>
                  成本价
                </th>
                <th align="left" style={{ padding: "8px 6px" }}>
                  自动调价
                </th>
                <th align="left" style={{ padding: "8px 6px" }}>
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} style={{ borderBottom: "1px solid #edf3ff" }}>
                  <td style={{ padding: "8px 6px", minWidth: 160 }}>{product.name}</td>
                  <td style={{ padding: "8px 6px" }}>{storeNameById.get(product.store_id) ?? `#${product.store_id}`}</td>
                  <td style={{ padding: "8px 6px" }}>{product.current_price} ₽</td>
                  <td style={{ padding: "8px 6px" }}>
                    <input
                      type="number"
                      min={0.01}
                      step={0.01}
                      value={draftCosts[product.id] ?? ""}
                      onChange={(e) =>
                        setDraftCosts((prev) => ({
                          ...prev,
                          [product.id]: e.target.value,
                        }))
                      }
                      style={{ border: "1px solid #c5d7ff", borderRadius: 6, padding: "6px 8px", width: 110 }}
                    />
                  </td>
                  <td style={{ padding: "8px 6px" }}>
                    <button
                      type="button"
                      disabled={togglingId === product.id}
                      onClick={() => toggleAutoReprice(product)}
                      style={{
                        border: "1px solid #c5d7ff",
                        borderRadius: 6,
                        padding: "4px 10px",
                        background: product.auto_reprice_enabled ? "#eef8ee" : "#fff",
                        color: product.auto_reprice_enabled ? "#1a7f37" : "#666",
                        cursor: "pointer",
                      }}
                    >
                      {product.auto_reprice_enabled ? "已开启" : "已关闭"}
                    </button>
                  </td>
                  <td style={{ padding: "8px 6px" }}>
                    <button
                      type="button"
                      disabled={savingId === product.id}
                      onClick={() => saveCost(product.id)}
                      style={{
                        border: "1px solid #4f8cff",
                        borderRadius: 6,
                        padding: "4px 10px",
                        color: "#fff",
                        background: "linear-gradient(135deg, #4f8cff, #6d5efc)",
                        cursor: "pointer",
                      }}
                    >
                      保存成本
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
