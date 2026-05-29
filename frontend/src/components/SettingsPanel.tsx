import { useEffect, useState } from "react";

import { api } from "../api/client";
import type { Store, ToolSettings } from "../types";
import { StoreManager } from "./StoreManager";

type Props = {
  stores: Store[];
  toolSettings: ToolSettings | null;
  onStoreChanged: () => Promise<void>;
  onProductsChanged: () => Promise<void>;
  onSettingsChanged: (settings: ToolSettings) => void;
};

const RULE_DESCRIPTIONS = [
  {
    title: "规则一 · 对手价低于我方时跟价",
    body: "只要对手价低于你的售价，工具会把价格调到「对手价 − 跟价步长」。对手不继续降价则维持现价；对手再降则继续压价。触及商品成本价后停止调价。",
  },
  {
    title: "规则二 · 部分对手退出后回调",
    body: "跟价过程中若你已是全场最低价，有对手退出或不跟价但仍有其他卖家时，不会恢复跟价前原价，而是回调至「仍高于你的最低对手价 − 跟价步长」，在保持最低价的前提下尽量抬高利润。",
  },
  {
    title: "规则三 · 无竞争对手",
    body: "同一链接没有任何竞争参考价时，价格保持不变。",
  },
];

type IntervalCardProps = {
  title: string;
  current: number | undefined;
  presetOptions: number[];
  saving: boolean;
  selected: string;
  customMinutes: string;
  onSelectChange: (value: string) => void;
  onCustomChange: (value: string) => void;
  onSave: () => void;
  hint?: string;
};

function IntervalCard({
  title,
  current,
  presetOptions,
  saving,
  selected,
  customMinutes,
  onSelectChange,
  onCustomChange,
  onSave,
  hint,
}: IntervalCardProps) {
  return (
    <div style={{ border: "1px solid #deebff", borderRadius: 10, padding: 14, background: "rgba(255,255,255,0.92)" }}>
      <h3 style={{ marginTop: 0, color: "#145f9e" }}>{title}</h3>
      <p style={{ marginTop: 0, color: "#666" }}>
        当前：每 {current ?? "-"} 分钟
      </p>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <select
          value={selected}
          onChange={(e) => onSelectChange(e.target.value)}
          style={{ border: "1px solid #c5d7ff", borderRadius: 6, padding: "6px 8px" }}
        >
          {presetOptions.map((m) => (
            <option key={m} value={String(m)}>
              每 {m} 分钟
            </option>
          ))}
          <option value="custom">自定义</option>
        </select>
        <input
          type="number"
          placeholder="自定义分钟"
          value={customMinutes}
          onChange={(e) => onCustomChange(e.target.value)}
          disabled={selected !== "custom"}
          min={1}
          step={1}
          style={{ border: "1px solid #c5d7ff", borderRadius: 6, padding: "6px 8px", width: 110 }}
        />
        <button
          onClick={onSave}
          disabled={saving}
          style={{
            border: "1px solid #4f8cff",
            borderRadius: 7,
            padding: "6px 12px",
            color: "#fff",
            background: "linear-gradient(135deg, #4f8cff, #6d5efc)",
            cursor: "pointer",
          }}
        >
          保存
        </button>
      </div>
      {hint && <small style={{ display: "block", marginTop: 6, color: "#666" }}>{hint}</small>}
    </div>
  );
}

export function SettingsPanel({ stores, toolSettings, onStoreChanged, onProductsChanged, onSettingsChanged }: Props) {
  const scanPresets = toolSettings?.preset_options ?? [5, 10, 20];
  const syncPresets = toolSettings?.auto_sync_preset_options ?? [30, 60, 120, 240];
  const priceStepPresets = toolSettings?.repricing_rules.price_step_presets ?? ["0.1", "1"];

  const [scanSelected, setScanSelected] = useState<string>("10");
  const [scanCustom, setScanCustom] = useState<string>("");
  const [savingScan, setSavingScan] = useState(false);

  const [syncSelected, setSyncSelected] = useState<string>("60");
  const [syncCustom, setSyncCustom] = useState<string>("");
  const [savingSync, setSavingSync] = useState(false);

  const [priceStep, setPriceStep] = useState<string>("0.1");
  const [savingRules, setSavingRules] = useState(false);

  useEffect(() => {
    if (!toolSettings) return;
    const current = toolSettings.scan_interval_minutes;
    if (scanPresets.includes(current)) {
      setScanSelected(String(current));
      setScanCustom("");
    } else {
      setScanSelected("custom");
      setScanCustom(String(current));
    }
  }, [scanPresets, toolSettings]);

  useEffect(() => {
    if (!toolSettings) return;
    const current = toolSettings.auto_sync_interval_minutes;
    if (syncPresets.includes(current)) {
      setSyncSelected(String(current));
      setSyncCustom("");
    } else {
      setSyncSelected("custom");
      setSyncCustom(String(current));
    }
  }, [syncPresets, toolSettings]);

  useEffect(() => {
    if (!toolSettings) return;
    setPriceStep(String(toolSettings.repricing_rules.price_step ?? "0.1"));
  }, [toolSettings]);

  async function saveScanInterval() {
    const minutes = scanSelected === "custom" ? Number(scanCustom || 0) : Number(scanSelected);
    if (!Number.isInteger(minutes) || minutes <= 0) {
      alert("请输入有效的分钟数（正整数）");
      return;
    }
    setSavingScan(true);
    try {
      const latest = await api.updateScanInterval(minutes);
      onSettingsChanged(latest);
    } catch (err) {
      alert(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSavingScan(false);
    }
  }

  async function saveSyncInterval() {
    const minutes = syncSelected === "custom" ? Number(syncCustom || 0) : Number(syncSelected);
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 1440) {
      alert("自动同步间隔需在 5–1440 分钟之间");
      return;
    }
    setSavingSync(true);
    try {
      const latest = await api.updateAutoSyncInterval(minutes);
      onSettingsChanged(latest);
    } catch (err) {
      alert(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSavingSync(false);
    }
  }

  async function saveRules() {
    const step = Number(priceStep);
    if (!Number.isFinite(step) || step <= 0) {
      alert("跟价步长必须大于 0");
      return;
    }
    setSavingRules(true);
    try {
      const latest = await api.updateRepricingRules({ price_step: step });
      onSettingsChanged(latest);
    } finally {
      setSavingRules(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        <IntervalCard
          title="跟卖扫描频率"
          current={toolSettings?.scan_interval_minutes}
          presetOptions={scanPresets}
          saving={savingScan}
          selected={scanSelected}
          customMinutes={scanCustom}
          onSelectChange={setScanSelected}
          onCustomChange={setScanCustom}
          onSave={saveScanInterval}
          hint="作用于全部已绑定店铺，控制竞品价格扫描与自动调价节奏。"
        />
        <IntervalCard
          title="自动同步商品间隔"
          current={toolSettings?.auto_sync_interval_minutes}
          presetOptions={syncPresets}
          saving={savingSync}
          selected={syncSelected}
          customMinutes={syncCustom}
          onSelectChange={setSyncSelected}
          onCustomChange={setSyncCustom}
          onSave={saveSyncInterval}
          hint="一键应用到所有店铺。到点会自动从 Ozon 重新拉取商品并更新价格、库存与图片。"
        />
      </div>

      <div style={{ border: "1px solid #deebff", borderRadius: 10, padding: 14, background: "rgba(255,255,255,0.92)" }}>
        <h3 style={{ marginTop: 0, color: "#145f9e" }}>自动调价规则</h3>
        <p style={{ marginTop: 0, color: "#666", fontSize: 13, lineHeight: 1.5 }}>
          以下三条为固定跟卖逻辑；你只需设置「比对手低多少卢布」。成本价在「商品成本管理」中维护，保存后实时参与调价底线计算。
        </p>

        <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
          {RULE_DESCRIPTIONS.map((rule) => (
            <div
              key={rule.title}
              style={{
                border: "1px solid #e8f0ff",
                borderRadius: 8,
                padding: "8px 10px",
                background: "#f8fbff",
                fontSize: 13,
                lineHeight: 1.55,
              }}
            >
              <b style={{ color: "#1d4f91" }}>{rule.title}</b>
              <p style={{ margin: "4px 0 0", color: "#415472" }}>{rule.body}</p>
            </div>
          ))}
        </div>

        <label style={{ display: "grid", gap: 6, color: "#415472", fontSize: 13 }}>
          跟价步长（比对手低多少，单位：卢布）
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {priceStepPresets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setPriceStep(String(preset))}
                style={{
                  border: priceStep === String(preset) ? "1px solid #4f8cff" : "1px solid #c5d7ff",
                  borderRadius: 7,
                  padding: "6px 12px",
                  background: priceStep === String(preset) ? "#eef4ff" : "#fff",
                  color: priceStep === String(preset) ? "#2b5fcc" : "#415472",
                  cursor: "pointer",
                }}
              >
                {preset} ₽
              </button>
            ))}
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={priceStep}
              onChange={(e) => setPriceStep(e.target.value)}
              style={{ border: "1px solid #c5d7ff", borderRadius: 6, padding: "6px 8px", width: 90 }}
            />
          </div>
        </label>

        <button
          onClick={saveRules}
          disabled={savingRules}
          style={{
            marginTop: 10,
            border: "1px solid #4f8cff",
            borderRadius: 7,
            padding: "6px 12px",
            color: "#fff",
            background: "linear-gradient(135deg, #4f8cff, #6d5efc)",
            cursor: "pointer",
          }}
        >
          保存调价规则
        </button>
      </div>

      <StoreManager stores={stores} onStoreChanged={onStoreChanged} onProductsChanged={onProductsChanged} />
    </div>
  );
}
