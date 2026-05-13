import { useMemo } from "react";

import type { PriceEvent } from "../types";

type Props = {
  events: PriceEvent[];
  topRatio: number;
};

export function EventAnalyticsPanel({ events, topRatio }: Props) {
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

  const maxY = Math.max(...downSeries, ...upSeries, 1);
  const downPath = pointsPath(downSeries, maxY, 540, 150);
  const upPath = pointsPath(upSeries, maxY, 540, 150);

  const days = ["05/20", "05/21", "05/22", "05/23", "05/24", "05/25", "05/26"];
  const occupied = days.map((_, i) => {
    const base = topRatio * 100;
    return Math.max(28, Math.min(88, Math.round(base + Math.sin(i * 0.8) * 8)));
  });

  const diffRatio = Math.max(8, Math.min(35, Math.round(18 + topRatio * 20)));
  const totalCount = 10195;
  const pie = [28, 22, 18, 16, 10, 6];
  const pieColors = ["#2f7bff", "#4abf74", "#f1a43c", "#444d66", "#73d6d0", "#9d8bff"];

  return (
    <section style={{ display: "grid", gap: 12 }}>
      <div style={{ border: "1px solid #d8e4ff", borderRadius: 12, background: "#fff", padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ margin: 0, color: "#2f4f8f" }}>调价次数</h3>
          <div style={{ fontSize: 12, color: "#6a7695" }}>最近 12 条事件</div>
        </div>
        <svg width="100%" viewBox="0 0 560 170" style={{ display: "block" }}>
          <path d={downPath} fill="none" stroke="#2f7bff" strokeWidth="3" />
          <path d={upPath} fill="none" stroke="#4abf74" strokeWidth="3" />
        </svg>
        <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#5e6b8b" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: "#2f7bff" }} />
            调降
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: "#4abf74" }} />
            调涨
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ border: "1px solid #d8e4ff", borderRadius: 12, background: "#fff", padding: 12 }}>
          <h3 style={{ margin: "0 0 10px", color: "#2f4f8f" }}>与购车价差价比 %</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 170px", gap: 8, alignItems: "center" }}>
            <div style={{ fontSize: 13, color: "#596786", lineHeight: 1.8 }}>
              <div>差价比：<b>{diffRatio}-{diffRatio + 9}%</b></div>
              <div>商品数：<b>2956</b></div>
              <div>占比：<b>29%</b></div>
            </div>
            <svg width="170" height="170" viewBox="0 0 170 170">
              <circle cx="85" cy="85" r="58" fill="none" stroke="#edf2ff" strokeWidth="18" />
              {pie.reduce(
                (acc, val, idx) => {
                  const seg = (val / 100) * 360;
                  const start = acc.angle;
                  const end = start + seg;
                  const largeArc = seg > 180 ? 1 : 0;
                  const sx = 85 + 58 * Math.cos((Math.PI / 180) * (start - 90));
                  const sy = 85 + 58 * Math.sin((Math.PI / 180) * (start - 90));
                  const ex = 85 + 58 * Math.cos((Math.PI / 180) * (end - 90));
                  const ey = 85 + 58 * Math.sin((Math.PI / 180) * (end - 90));
                  acc.nodes.push(
                    <path
                      key={`${idx}-${val}`}
                      d={`M ${sx} ${sy} A 58 58 0 ${largeArc} 1 ${ex} ${ey}`}
                      stroke={pieColors[idx]}
                      strokeWidth="18"
                      fill="none"
                      strokeLinecap="round"
                    />
                  );
                  acc.angle = end + 3;
                  return acc;
                },
                { angle: 0, nodes: [] as JSX.Element[] }
              ).nodes}
              <text x="85" y="82" textAnchor="middle" fontSize="11" fill="#7a86a5">
                未占商品总计
              </text>
              <text x="85" y="104" textAnchor="middle" fontSize="30" fontWeight="700" fill="#1f2f44">
                {totalCount}
              </text>
            </svg>
          </div>
        </div>

        <div style={{ border: "1px solid #d8e4ff", borderRadius: 12, background: "#fff", padding: 12 }}>
          <h3 style={{ margin: "0 0 10px", color: "#2f4f8f" }}>抢占状态占比</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 10 }}>
            {days.map((d, idx) => (
              <div key={d} style={{ textAlign: "center" }}>
                <div
                  style={{
                    height: 96,
                    borderRadius: 8,
                    background: "linear-gradient(to top, #41b96f 0%, #41b96f var(--p), #e74b4b var(--p), #e74b4b 100%)",
                    ["--p" as string]: `${occupied[idx]}%`,
                  }}
                />
                <div style={{ marginTop: 6, fontSize: 11, color: "#6a7695" }}>{d}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: "#5f6d8d" }}>
            已抢占：<b>{(topRatio * 100).toFixed(1)}%</b>
          </div>
        </div>
      </div>
    </section>
  );
}
