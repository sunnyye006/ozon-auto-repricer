import type { Product, Store, ToolSettings } from "../types";
import { SettingsPanel } from "./SettingsPanel";

type Props = {
  stores: Store[];
  products: Product[];
  toolSettings: ToolSettings | null;
  onClose: () => void;
  onStoreChanged: () => Promise<void>;
  onProductsChanged: () => Promise<void>;
  onSettingsChanged: (settings: ToolSettings) => void;
};

export function SettingsPage({
  stores,
  products,
  toolSettings,
  onClose,
  onStoreChanged,
  onProductsChanged,
  onSettingsChanged,
}: Props) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #eef6ff 0%, #f4f9ff 40%, #f8f5ff 100%)",
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "24px 24px 32px",
          boxSizing: "border-box",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ margin: 0, color: "#12263f", fontSize: 28 }}>系统设置</h1>
            <p style={{ margin: "6px 0 0", color: "#666", fontSize: 14 }}>
              管理扫描频率、跟卖规则、店铺绑定与商品成本价
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "1px solid #c5d7ff",
              borderRadius: 8,
              padding: "8px 16px",
              background: "#fff",
              color: "#2b5fcc",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            返回仪表盘
          </button>
        </header>

        <SettingsPanel
          stores={stores}
          products={products}
          toolSettings={toolSettings}
          onStoreChanged={onStoreChanged}
          onProductsChanged={onProductsChanged}
          onSettingsChanged={onSettingsChanged}
        />
      </div>
    </main>
  );
}
