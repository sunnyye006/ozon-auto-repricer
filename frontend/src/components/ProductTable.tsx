import type { Product } from "../types";

type Props = {
  products: Product[];
};

export function ProductTable({ products }: Props) {
  return (
    <div
      style={{
        border: "1px solid #d8e4ff",
        borderRadius: 12,
        padding: 14,
        background: "linear-gradient(180deg, #ffffff 0%, #f2f9ff 100%)",
      }}
    >
      <h3 style={{ marginTop: 0, color: "#145f9e" }}>商品与成本管理</h3>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#eaf4ff" }}>
            <th align="left">商品</th>
            <th align="left">店铺 ID</th>
            <th align="left">当前价</th>
            <th align="left">成本价</th>
            <th align="left">自动调价</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} style={{ borderBottom: "1px solid #edf3ff" }}>
              <td>{p.name}</td>
              <td>{p.store_id}</td>
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
