import { useEffect, useMemo, useState } from "react";

import type { PriceEvent } from "../types";

type Props = {
  events: PriceEvent[];
};

export function EventStream({ events }: Props) {
  const [filter, setFilter] = useState<"all" | "down" | "up">("all");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const filteredEvents = useMemo(() => {
    if (filter === "all") return events;
    return events.filter((e) => (filter === "down" ? e.direction === "↓" : e.direction === "↑"));
  }, [events, filter]);

  const recent5mCount = useMemo(() => {
    return events.filter((e) => {
      const t = Date.parse(e.timestamp ?? e.created_at ?? "");
      return Number.isFinite(t) && now - t <= 5 * 60 * 1000;
    }).length;
  }, [events, now]);

  const latestEventTs = Date.parse(events[0]?.timestamp ?? events[0]?.created_at ?? "");
  const isLive = Number.isFinite(latestEventTs) && now - latestEventTs <= 3 * 60 * 1000;

  const trendBars = events.slice(0, 12);

  const logoLabels = ["AMZ", "AE", "GS", "OZ"];

  function getAgeText(rawTs?: string) {
    if (!rawTs) return "-";
    const t = Date.parse(rawTs);
    if (!Number.isFinite(t)) return rawTs;
    const diffMin = Math.max(0, Math.floor((now - t) / 60000));
    if (diffMin < 1) return "刚刚";
    if (diffMin < 60) return `${diffMin} 分钟前`;
    const diffHour = Math.floor(diffMin / 60);
    return `${diffHour} 小时前`;
  }

  return (
    <div
      style={{
        border: "1px solid #d8e4ff",
        borderRadius: 12,
        padding: 14,
        background: "linear-gradient(180deg, #ffffff 0%, #f5faff 100%)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0, color: "#1d4f91" }}>实时调价事件流</h3>
        <div style={{ display: "inline-flex", gap: 10, alignItems: "center", fontSize: 12 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: isLive ? "#0b8b5f" : "#7f8ba6",
              fontWeight: 700,
            }}
          >
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: 999,
                background: isLive ? "#12c48b" : "#c8d1e3",
              }}
            />
            {isLive ? "实时活跃" : "等待事件"}
          </span>
          <span style={{ color: "#57627f" }}>近5分钟 {recent5mCount} 条</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {[
          { id: "all", label: "全部" },
          { id: "up", label: "调涨" },
          { id: "down", label: "调降" },
          { id: "down", label: "抢占最优价" },
          { id: "up", label: "未占最优价" },
        ].map((item) => (
          <button
            key={`${item.id}-${item.label}`}
            onClick={() => setFilter(item.id as "all" | "down" | "up")}
            style={{
              border: "1px solid #c9d8ff",
              borderRadius: 999,
              padding: "4px 10px",
              fontSize: 12,
              background: filter === item.id ? "#4f8cff" : "#fff",
              color: filter === item.id ? "#fff" : "#3d4f74",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 12, alignItems: "end", height: 28 }}>
        {trendBars.map((event, i) => (
          <div
            key={`${event.product_name}-${i}`}
            title={`${event.product_name} ${event.direction}`}
            style={{
              width: 8,
              borderRadius: 6,
              background: event.direction === "↓" ? "#e23d67" : "#09b57f",
              height: `${12 + ((i % 4) + 1) * 4}px`,
              opacity: 1 - i * 0.05,
            }}
          />
        ))}
      </div>

      <div style={{ maxHeight: 430, overflow: "auto" }}>
        {filteredEvents.map((event, idx) => (
          <div
            key={`${event.product_name}-${idx}`}
            style={{
              padding: "8px 6px",
              borderBottom: "1px solid #eef4ff",
              borderRadius: 8,
              background: idx % 2 === 0 ? "rgba(79, 140, 255, 0.05)" : "transparent",
              display: "grid",
              gridTemplateColumns: "34px 1fr auto",
              gap: 8,
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: "#fff",
                border: "1px solid #d8e4ff",
                display: "grid",
                placeItems: "center",
                fontSize: 10,
                color: "#3a4d75",
                fontWeight: 700,
              }}
            >
              {logoLabels[idx % logoLabels.length]}
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: 999, background: "#56c97d" }} />
                <b style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{event.product_name}</b>
              </div>
              <small style={{ color: "#6b7694" }}>
                调价时间: {event.timestamp ?? event.created_at} · {event.store_name}
              </small>
            </div>

            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: event.direction === "↓" ? "#cb1b45" : "#2f855a", fontWeight: 800, fontSize: 16 }}>
                {event.direction === "↓" ? "↘" : "↗"}
              </span>
              <small style={{ color: "#6b7694", minWidth: 52, textAlign: "right" }}>{getAgeText(event.timestamp ?? event.created_at)}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
