import type { CSSProperties } from "react";

export type NavKey = "dashboard" | "cost-manager";

type Item = {
  key: NavKey;
  label: string;
  icon: string;
  hint: string;
};

const ITEMS: Item[] = [
  { key: "dashboard", label: "首页", icon: "▦", hint: "实时数据 / 事件流" },
  { key: "cost-manager", label: "商品成本管理", icon: "₽", hint: "多店铺 · 成本与自动调价" },
];

type Props = {
  activeKey: NavKey;
  collapsed: boolean;
  onSelect: (key: NavKey) => void;
  onToggleCollapsed: () => void;
};

export function SideNav({ activeKey, collapsed, onSelect, onToggleCollapsed }: Props) {
  const width = collapsed ? 64 : 220;
  const aside: CSSProperties = {
    width,
    minWidth: width,
    transition: "width 0.2s ease, min-width 0.2s ease",
    background: "linear-gradient(180deg, #ffffff 0%, #f3f7ff 100%)",
    borderRight: "1px solid #e2ebff",
    display: "flex",
    flexDirection: "column",
    padding: "16px 10px",
    gap: 6,
    position: "sticky",
    top: 0,
    height: "100vh",
    boxSizing: "border-box",
  };

  return (
    <aside style={aside}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "space-between", marginBottom: 14 }}>
        {!collapsed && <span style={{ fontWeight: 700, color: "#1d4f91", fontSize: 14 }}>导航</span>}
        <button
          type="button"
          aria-label={collapsed ? "展开导航" : "收起导航"}
          onClick={onToggleCollapsed}
          style={{
            border: "1px solid #d6e2ff",
            background: "#fff",
            color: "#2b5fcc",
            borderRadius: 7,
            width: 30,
            height: 30,
            cursor: "pointer",
            fontSize: 14,
            lineHeight: 1,
          }}
        >
          {collapsed ? "›" : "‹"}
        </button>
      </div>

      {ITEMS.map((item) => {
        const active = activeKey === item.key;
        return (
          <button
            key={item.key}
            type="button"
            title={collapsed ? `${item.label} · ${item.hint}` : item.hint}
            onClick={() => onSelect(item.key)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: collapsed ? "10px 0" : "10px 12px",
              justifyContent: collapsed ? "center" : "flex-start",
              border: active ? "1px solid #4f8cff" : "1px solid transparent",
              background: active ? "linear-gradient(135deg, rgba(79,140,255,0.12), rgba(109,94,252,0.12))" : "transparent",
              color: active ? "#2b5fcc" : "#415472",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: active ? 600 : 500,
              textAlign: "left",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 28,
                height: 28,
                borderRadius: 8,
                background: active ? "linear-gradient(135deg, #4f8cff, #6d5efc)" : "#eef3ff",
                color: active ? "#fff" : "#2b5fcc",
                fontSize: 14,
              }}
            >
              {item.icon}
            </span>
            {!collapsed && <span style={{ fontSize: 14 }}>{item.label}</span>}
          </button>
        );
      })}
    </aside>
  );
}
