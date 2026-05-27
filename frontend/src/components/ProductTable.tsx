import type { Product, Store } from "../types";

type Props = {
  products: Product[];
  stores?: Store[];
};

export function ProductTable({ products, stores = [] }: Props) {
  const storeNameById = new Map(stores.map((s) => [s.id, s.name]));

  return (
    <div
      style={{
        border: "1px solid #d8e4ff",
        borderRadius: 12,
        padding: 14,
        background: "linear-gradient(180deg, #ffffff 0%, #f2f9ff 100%)",
      }}
    >
      <h3 style={{ marginTop: 0, color: "#145f9e" }}>商品概览</h3>
      <p style={{ marginTop: 0, color: "#666", fontSize: 13 }}>成本价编辑请前往右上角设置 → 商品成本管理。</p>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#eaf4ff" }}>
            <th align="left">商品</th>
            <th align="left">店铺</th>
            <th align="left">当前价</th>
            <th align="left">成本价</th>
            <th align="left">自动调价</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} style={{ borderBottom: "1px solid #edf3ff" }}>
              <td>{p.name}</td>
              <td>{storeNameById.get(p.store_id) ?? `#${p.store_id}`}</td>
              <td>{p.current_price}</td>
              <td>{p.cost_price}</td>
              <td>{p.auto_reprice_enabled ? "开启" : "关闭"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
