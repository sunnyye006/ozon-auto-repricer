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

  const trendBars = events.slice(0, 14);
  const avgRecentChanges = Math.max(
    1,
    Math.round(
      events.slice(0, 12).reduce((acc, e) => {
        const oldPrice = Number(e.old_price);
        const newPrice = Number(e.new_price);
        if (!Number.isFinite(oldPrice) || !Number.isFinite(newPrice) || oldPrice === 0) {
          return acc;
        }
        return acc + Math.abs(((newPrice - oldPrice) / oldPrice) * 100);
      }, 0) / Math.max(1, events.slice(0, 12).length)
    )
  );

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

  function getPlatformLabel(platform?: string) {
    const value = (platform ?? "").trim();
    if (!value) return "OZ";
    return value.slice(0, 2).toUpperCase();
  }

  function formatEventTime(rawTs?: string) {
    if (!rawTs) return "-";
    const t = Date.parse(rawTs);
    if (!Number.isFinite(t)) return rawTs;
    return new Date(t).toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  return (
    <div
      style={{
        border: "1px solid #dce7ff",
        borderRadius: 16,
        padding: 16,
        background: "linear-gradient(180deg, #ffffff 0%, #f3f8ff 58%, #f7fbff 100%)",
        boxShadow: "0 10px 28px rgba(40, 85, 170, 0.08)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, color: "#1d4f91", fontSize: 19 }}>实时调价事件流</h3>
        <div style={{ display: "inline-flex", gap: 10, alignItems: "center", fontSize: 12, flexWrap: "wrap" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: isLive ? "#0d9464" : "#7f8ba6",
              fontWeight: 700,
              background: isLive ? "rgba(13, 148, 100, 0.09)" : "rgba(127, 139, 166, 0.12)",
              borderRadius: 999,
              padding: "4px 10px",
            }}
          >
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: 999,
                boxShadow: isLive ? "0 0 0 4px rgba(18, 196, 139, 0.15)" : "none",
                background: isLive ? "#12c48b" : "#c8d1e3",
              }}
            />
            {isLive ? "实时活跃" : "等待事件"}
          </span>
          <span style={{ color: "#57627f", fontWeight: 600 }}>近5分钟 {recent5mCount} 条</span>
          <span style={{ color: "#5f6c89", background: "rgba(79, 140, 255, 0.08)", borderRadius: 999, padding: "4px 10px" }}>
            平均变动幅度 ±{avgRecentChanges}%
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
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
              border: filter === item.id ? "1px solid #4f8cff" : "1px solid #c9d8ff",
              borderRadius: 999,
              padding: "5px 11px",
              fontSize: 12,
              fontWeight: 600,
              background: filter === item.id ? "linear-gradient(135deg, #4f8cff, #6d5efc)" : "#fff",
              color: filter === item.id ? "#fff" : "#3d4f74",
              cursor: "pointer",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 12,
          alignItems: "end",
          height: 30,
          padding: "8px 10px",
          borderRadius: 10,
          border: "1px solid #e7efff",
          background: "#f8fbff",
        }}
      >
        {trendBars.map((event, i) => (
          <div
            key={`${event.product_name}-${i}`}
            title={`${event.product_name} ${event.direction}`}
            style={{
              width: 8,
              borderRadius: 6,
              background: event.direction === "↓" ? "#e23d67" : "#09b57f",
              height: `${12 + ((i % 4) + 1) * 4}px`,
              opacity: Math.max(0.35, 1 - i * 0.06),
            }}
          />
        ))}
      </div>

      <div style={{ maxHeight: 456, overflow: "auto", paddingRight: 2 }}>
        {filteredEvents.map((event, idx) => (
          <div
            key={`${event.product_name}-${idx}`}
            style={{
              padding: "9px 8px",
              borderBottom: "1px solid #eef4ff",
              borderRadius: 10,
              background: idx % 2 === 0 ? "rgba(79, 140, 255, 0.06)" : "rgba(255, 255, 255, 0.72)",
              display: "grid",
              gridTemplateColumns: "36px minmax(0, 1fr) auto",
              gap: 8,
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                background: "#ffffff",
                border: "1px solid #d2e2ff",
                display: "grid",
                placeItems: "center",
                fontSize: 10.5,
                color: "#3a4d75",
                fontWeight: 700,
              }}
            >
              {getPlatformLabel(event.platform)}
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: event.direction === "↓" ? "#e23d67" : "#12b981",
                    boxShadow:
                      event.direction === "↓" ? "0 0 0 3px rgba(226, 61, 103, 0.16)" : "0 0 0 3px rgba(18, 185, 129, 0.16)",
                  }}
                />
                <b style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#243759" }}>{event.product_name}</b>
              </div>
              <small style={{ color: "#6b7694", display: "inline-block", marginTop: 1 }}>
                {event.store_name} · {formatEventTime(event.timestamp ?? event.created_at)}
              </small>
            </div>

            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  display: "inline-grid",
                  placeItems: "center",
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  color: event.direction === "↓" ? "#cb1b45" : "#146f50",
                  background: event.direction === "↓" ? "rgba(203, 27, 69, 0.12)" : "rgba(20, 111, 80, 0.12)",
                  fontWeight: 800,
                  fontSize: 14,
                }}
              >
                {event.direction === "↓" ? "↘" : "↗"}
              </span>
              <small style={{ color: "#6b7694", minWidth: 58, textAlign: "right", fontWeight: 600 }}>
                {getAgeText(event.timestamp ?? event.created_at)}
              </small>
            </div>
          </div>
        ))}
        {filteredEvents.length === 0 && (
          <div style={{ padding: "26px 10px", textAlign: "center", color: "#7a86a5", fontSize: 13 }}>当前筛选条件下暂无事件</div>
        )}
      </div>
    </div>
  );
}
