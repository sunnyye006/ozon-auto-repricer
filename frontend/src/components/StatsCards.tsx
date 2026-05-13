import type { DashboardStats } from "../types";

type Props = {
  stats: DashboardStats | null;
};

export function StatsCards({ stats }: Props) {
  const totalProducts = stats?.total_products ?? 0;
  const repricingCount = stats?.repricing_product_count ?? 0;
  const topRatio = stats ? `${(stats.top_price_capture_ratio * 100).toFixed(2)} %` : "-";
  const topCount = stats ? Math.round((stats.top_price_capture_ratio || 0) * totalProducts) : 0;
  const competitorCount = stats?.competitor_count ?? 0;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
      <div style={{ border: "1px solid #ffe5c4", borderRadius: 12, padding: 12, background: "#fff8ef" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#8a5a2f", fontSize: 13, fontWeight: 600 }}>
          <span style={{ width: 16, height: 16, borderRadius: 4, background: "#ffb15c", display: "inline-block" }} />
          抢占最优价占比
        </div>
        <div style={{ marginTop: 10, fontSize: 38, lineHeight: "40px", fontWeight: 800, color: "#f08a24" }}>{topRatio}</div>
      </div>

      <div style={{ border: "1px solid #d8edff", borderRadius: 12, padding: 12, background: "#f2fbff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, background: "#e1f4ff", borderRadius: 6, padding: "3px 8px", color: "#3a6f96" }}>全部商品</span>
          <span style={{ fontSize: 12, background: "#d4ecff", borderRadius: 6, padding: "3px 8px", color: "#1f4f77", fontWeight: 700 }}>
            可调价商品
          </span>
        </div>
        <div style={{ marginTop: 10, fontSize: 38, lineHeight: "40px", fontWeight: 800, color: "#1f2f44" }}>
          {totalProducts}
          <span style={{ marginLeft: 10, fontSize: 18, color: "#2f7bb6", fontWeight: 700 }}>/ {repricingCount}</span>
        </div>
      </div>

      <div style={{ border: "1px solid #daf2dc", borderRadius: 12, padding: 12, background: "#f3fff4" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, background: "#ddf8e2", borderRadius: 6, padding: "3px 8px", color: "#3b7f4f", fontWeight: 700 }}>
            已占优商品
          </span>
          <span style={{ fontSize: 12, background: "#ebfced", borderRadius: 6, padding: "3px 8px", color: "#5b8964" }}>在售商品</span>
        </div>
        <div style={{ marginTop: 10, fontSize: 38, lineHeight: "40px", fontWeight: 800, color: "#1f2f44" }}>
          {topCount}
          <span style={{ marginLeft: 10, fontSize: 18, color: "#3f8f5b", fontWeight: 700 }}>/ {totalProducts}</span>
        </div>
      </div>

      <div style={{ border: "1px solid #e7ecff", borderRadius: 12, padding: 12, background: "#f9fbff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#4e5878", fontSize: 13, fontWeight: 600 }}>
          <span style={{ width: 16, height: 16, borderRadius: 4, background: "#8aa2ff", display: "inline-block" }} />
          竞争对手数
        </div>
        <div style={{ marginTop: 10, fontSize: 38, lineHeight: "40px", fontWeight: 800, color: "#1f2f44" }}>{competitorCount}</div>
      </div>
    </div>
  );
}
