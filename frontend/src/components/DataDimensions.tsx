import type { DashboardStats, PriceEvent, Product, Store } from "../types";

type Props = {
  stats: DashboardStats | null;
  events: PriceEvent[];
  products: Product[];
  stores: Store[];
};

export function DataDimensions({ stats, events, products, stores }: Props) {
  const downCount = events.filter((e) => e.direction === "↓").length;
  const upCount = events.filter((e) => e.direction === "↑").length;
  const uniqueStoreCount = new Set(events.map((e) => e.store_name)).size || stores.length;
  const autoRate = products.length
    ? `${((products.filter((p) => p.auto_reprice_enabled).length / products.length) * 100).toFixed(1)}%`
    : "-";

  const cards = [
    { label: "近 100 条调价事件", value: events.length, color: "#4f8cff" },
    { label: "下调次数", value: downCount, color: "#e23d67" },
    { label: "回调次数", value: upCount, color: "#09b57f" },
    { label: "活跃店铺数", value: uniqueStoreCount, color: "#7c5cff" },
    { label: "自动调价覆盖率", value: autoRate, color: "#1d4f91" },
    {
      label: "单商品平均竞争对手数",
      value: stats && stats.total_products > 0 ? (stats.competitor_count / stats.total_products).toFixed(2) : "-",
      color: "#ff8b5c",
    },
  ];

  return (
    <section
      style={{
        border: "1px solid #d8e4ff",
        borderRadius: 12,
        padding: 14,
        background: "linear-gradient(180deg, #ffffff 0%, #f7f4ff 100%)",
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: 12, color: "#5a43d1" }}>数据维度看板</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
        {cards.map((item) => (
          <div
            key={item.label}
            style={{
              border: "1px solid #e8eefd",
              borderRadius: 10,
              padding: 10,
              background: "rgba(255,255,255,0.85)",
            }}
          >
            <div style={{ color: "#666", fontSize: 12 }}>{item.label}</div>
            <div style={{ marginTop: 6, fontWeight: 700, fontSize: 20, color: item.color }}>{item.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
