import { useMemo } from "react";

import type { DashboardStats, PriceEvent, Product } from "../types";

type Props = {
  events: PriceEvent[];
  topRatio: number;
  products: Product[];
  stats: DashboardStats | null;
};

const cardStyle = {
  border: "1px solid #dce7ff",
  borderRadius: 16,
  background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
  padding: 14,
  boxShadow: "0 10px 28px rgba(40, 85, 170, 0.08)",
} as const;

function Donut({
  segments,
  centerLabel,
  centerValue,
}: {
  segments: { label: string; value: number; color: string }[];
  centerLabel: string;
  centerValue: string | number;
}) {
  const total = segments.reduce((acc, s) => acc + s.value, 0);
  let angle = 0;
  return (
    <svg width="176" height="176" viewBox="0 0 170 170">
      <circle cx="85" cy="85" r="58" fill="none" stroke="#edf2ff" strokeWidth="18" />
      {total > 0 &&
        segments.map((seg, idx) => {
          if (seg.value <= 0) return null;
          const portion = seg.value / total;
          const sweep = portion * 360;
          const start = angle;
          const end = start + sweep;
          angle = end;
          const largeArc = sweep > 180 ? 1 : 0;
          const sx = 85 + 58 * Math.cos((Math.PI / 180) * (start - 90));
          const sy = 85 + 58 * Math.sin((Math.PI / 180) * (start - 90));
          const ex = 85 + 58 * Math.cos((Math.PI / 180) * (end - 90));
          const ey = 85 + 58 * Math.sin((Math.PI / 180) * (end - 90));
          if (portion >= 0.999) {
            return (
              <circle key={idx} cx="85" cy="85" r="58" fill="none" stroke={seg.color} strokeWidth="18" />
            );
          }
          return (
            <path
              key={idx}
              d={`M ${sx} ${sy} A 58 58 0 ${largeArc} 1 ${ex} ${ey}`}
              stroke={seg.color}
              strokeWidth="18"
              fill="none"
            />
          );
        })}
      <text x="85" y="80" textAnchor="middle" fontSize="11" fill="#7a86a5">
        {centerLabel}
      </text>
      <text x="85" y="104" textAnchor="middle" fontSize="26" fontWeight="700" fill="#1f2f44">
        {centerValue}
      </text>
    </svg>
  );
}

function Legend({ items }: { items: { label: string; value: number; color: string }[] }) {
  const total = items.reduce((acc, s) => acc + s.value, 0);
  return (
    <div style={{ display: "grid", gap: 6, fontSize: 12.5, color: "#546180" }}>
      {items.map((it) => (
        <div key={it.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "#546180" }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: it.color }} />
            {it.label}
          </span>
          <b style={{ color: "#23406b" }}>
            {it.value}
            <span style={{ color: "#8893ad", fontWeight: 500 }}> ({total > 0 ? ((it.value / total) * 100).toFixed(1) : "0.0"}%)</span>
          </b>
        </div>
      ))}
    </div>
  );
}

export function EventAnalyticsPanel({ events, topRatio, products, stats }: Props) {
  const last = events.slice(0, 12).reverse();

  const { downSeries, upSeries } = useMemo(() => {
    let downAcc = 0;
    let upAcc = 0;
    const down: number[] = [];
    const up: number[] = [];
    for (const e of last) {
      if (e.direction === "↓") downAcc += 1;
      if (e.direction === "↑") upAcc += 1;
      down.push(downAcc);
      up.push(upAcc);
    }
    return { downSeries: down, upSeries: up };
  }, [last]);

  function pointsPath(series: number[], maxY: number, width: number, height: number) {
    if (!series.length) return "";
    return series
      .map((v, i) => {
        const x = (i / Math.max(series.length - 1, 1)) * width;
        const y = height - (v / Math.max(maxY, 1)) * height;
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }

  const chartWidth = 560;
  const chartHeight = 170;
  const graphWidth = 540;
  const graphHeight = 138;
  const maxY = Math.max(...downSeries, ...upSeries, 1);
  const downPath = pointsPath(downSeries, maxY, graphWidth, graphHeight);
  const upPath = pointsPath(upSeries, maxY, graphWidth, graphHeight);
  const gridYs = [0, 1, 2, 3, 4].map((n) => (n / 4) * graphHeight);

  const totalAdjustments = events.length;
  const downCount = events.filter((e) => e.direction === "↓").length;
  const upCount = events.filter((e) => e.direction === "↑").length;

  const marginBuckets = useMemo(() => {
    const buckets = [
      { label: "亏损 (<0%)", color: "#e23d67", value: 0 },
      { label: "0–10%", color: "#ff8b5c", value: 0 },
      { label: "10–20%", color: "#f1a43c", value: 0 },
      { label: "20–30%", color: "#4abf74", value: 0 },
      { label: "30%以上", color: "#2f7bff", value: 0 },
    ];
    for (const p of products) {
      const price = Number(p.current_price);
      const cost = Number(p.cost_price);
      if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(cost) || cost <= 0) continue;
      const margin = ((price - cost) / price) * 100;
      if (margin < 0) buckets[0].value += 1;
      else if (margin < 10) buckets[1].value += 1;
      else if (margin < 20) buckets[2].value += 1;
      else if (margin < 30) buckets[3].value += 1;
      else buckets[4].value += 1;
    }
    return buckets;
  }, [products]);
  const marginTotal = marginBuckets.reduce((acc, b) => acc + b.value, 0);

  const totalProducts = stats?.total_products ?? products.length;
  const effectiveRatio = stats?.top_price_capture_ratio ?? topRatio;
  const occupiedCount = Math.round(effectiveRatio * totalProducts);
  const occupySegments = [
    { label: "已抢占最优价", value: occupiedCount, color: "#2f7bff" },
    { label: "未抢占", value: Math.max(0, totalProducts - occupiedCount), color: "#e74b4b" },
  ];

  const autoOn = products.filter((p) => p.auto_reprice_enabled).length;
  const autoSegments = [
    { label: "自动调价开启", value: autoOn, color: "#4abf74" },
    { label: "已关闭", value: Math.max(0, products.length - autoOn), color: "#c8d1e3" },
  ];

  return (
    <section style={{ display: "grid", gap: 14 }}>
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, color: "#2f4f8f", fontSize: 18 }}>调价次数趋势</h3>
          <div style={{ fontSize: 12, color: "#6a7695", fontWeight: 600 }}>最近 12 条事件</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginBottom: 10 }}>
          <div style={{ border: "1px solid #deebff", borderRadius: 10, background: "#fff", padding: "8px 10px" }}>
            <div style={{ fontSize: 12, color: "#697899" }}>调价总次数</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#23406b" }}>{totalAdjustments}</div>
          </div>
          <div style={{ border: "1px solid #deebff", borderRadius: 10, background: "#fff", padding: "8px 10px" }}>
            <div style={{ fontSize: 12, color: "#697899" }}>调降 / 调涨</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#23406b" }}>
              {downCount}/{upCount}
            </div>
          </div>
          <div style={{ border: "1px solid #deebff", borderRadius: 10, background: "#fff", padding: "8px 10px" }}>
            <div style={{ fontSize: 12, color: "#697899" }}>抢占最优价占比</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#23406b" }}>{(effectiveRatio * 100).toFixed(1)}%</div>
          </div>
        </div>

        {totalAdjustments === 0 ? (
          <div style={{ padding: "26px 10px", textAlign: "center", color: "#7a86a5", fontSize: 13, border: "1px dashed #dbe7ff", borderRadius: 10 }}>
            暂无调价事件，开启自动调价并完成一次扫描后将在此展示趋势。
          </div>
        ) : (
          <>
            <svg width="100%" viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ display: "block" }}>
              {gridYs.map((y) => (
                <line key={y} x1="0" y1={y} x2={graphWidth} y2={y} stroke="#e7efff" strokeWidth="1" />
              ))}
              <path d={downPath} fill="none" stroke="#2f7bff" strokeWidth="3" strokeLinecap="round" />
              <path d={upPath} fill="none" stroke="#4abf74" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#5e6b8b", marginTop: 4, flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 999, background: "#2f7bff" }} />
                累计调降
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 999, background: "#4abf74" }} />
                累计调涨
              </span>
            </div>
          </>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
        <div style={cardStyle}>
          <h3 style={{ margin: "0 0 12px", color: "#2f4f8f", fontSize: 17 }}>利润率分布（售价 vs 成本）</h3>
          <div style={{ display: "grid", gridTemplateColumns: "176px 1fr", gap: 12, alignItems: "center" }}>
            <Donut segments={marginBuckets} centerLabel="可计算商品" centerValue={marginTotal} />
            <Legend items={marginBuckets} />
          </div>
        </div>

        <div style={cardStyle}>
          <h3 style={{ margin: "0 0 12px", color: "#2f4f8f", fontSize: 17 }}>抢占状态 / 自动调价占比</h3>
          <div style={{ display: "grid", gridTemplateColumns: "176px 1fr", gap: 12, alignItems: "center" }}>
            <Donut segments={occupySegments} centerLabel="全部商品" centerValue={totalProducts} />
            <div style={{ display: "grid", gap: 12 }}>
              <Legend items={occupySegments} />
              <div style={{ borderTop: "1px dashed #e0e8f7", paddingTop: 10 }}>
                <Legend items={autoSegments} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
