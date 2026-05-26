import { useEffect, useMemo, useState } from "react";

import { api } from "../api/client";
import type { Store, ToolSettings } from "../types";
import { StoreManager } from "./StoreManager";

type Props = {
  stores: Store[];
  toolSettings: ToolSettings | null;
  onStoreChanged: () => Promise<void>;
  onSettingsChanged: (settings: ToolSettings) => void;
  hideTitle?: boolean;
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

export function SettingsPanel({ stores, toolSettings, onStoreChanged, onSettingsChanged, hideTitle = false }: Props) {
  const presetOptions = toolSettings?.preset_options ?? [5, 10, 20];
  const priceStepPresets = toolSettings?.repricing_rules.price_step_presets ?? ["0.1", "1"];
  const [selectedOption, setSelectedOption] = useState<string>("10");
  const [customMinutes, setCustomMinutes] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [priceStep, setPriceStep] = useState<string>("0.1");
  const [savingRules, setSavingRules] = useState(false);

  const isCurrentPreset = useMemo(
    () => (toolSettings ? presetOptions.includes(toolSettings.scan_interval_minutes) : true),
    [presetOptions, toolSettings]
  );

  useEffect(() => {
    if (!toolSettings) return;
    const current = toolSettings.scan_interval_minutes;
    if (presetOptions.includes(current)) {
      setSelectedOption(String(current));
      setCustomMinutes("");
    } else {
      setSelectedOption("custom");
      setCustomMinutes(String(current));
    }
  }, [presetOptions, toolSettings]);

  useEffect(() => {
    if (!toolSettings) return;
    setPriceStep(String(toolSettings.repricing_rules.price_step ?? "0.1"));
  }, [toolSettings]);

  async function saveInterval() {
    const minutes =
      selectedOption === "custom"
        ? Number(customMinutes || 0)
        : Number(selectedOption);
    if (!Number.isInteger(minutes) || minutes <= 0) {
      alert("请输入有效的分钟数（正整数）");
      return;
    }
    setSaving(true);
    try {
      const latest = await api.updateScanInterval(minutes);
      onSettingsChanged(latest);
      setSelectedOption(String(minutes));
      if (!latest.preset_options.includes(minutes)) {
        setSelectedOption("custom");
        setCustomMinutes(String(minutes));
      }
    } finally {
      setSaving(false);
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
    <section
      style={{
        border: "1px solid #d8e4ff",
        borderRadius: 10,
        padding: 14,
        display: "grid",
        gap: 12,
        background: "linear-gradient(180deg, #ffffff 0%, #f2f9ff 100%)",
      }}
    >
      {!hideTitle && <h2 style={{ margin: 0 }}>设置</h2>}

      <div style={{ border: "1px solid #deebff", borderRadius: 8, padding: 12, background: "rgba(255,255,255,0.88)" }}>
        <h3 style={{ marginTop: 0, color: "#145f9e" }}>跟卖扫描频率</h3>
        <p style={{ marginTop: 0, color: "#666" }}>
          当前：每 {toolSettings?.scan_interval_minutes ?? "-"} 分钟扫描一次
        </p>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={selectedOption}
            onChange={(e) => setSelectedOption(e.target.value)}
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
            onChange={(e) => setCustomMinutes(e.target.value)}
            disabled={selectedOption !== "custom"}
            min={1}
            step={1}
            style={{ border: "1px solid #c5d7ff", borderRadius: 6, padding: "6px 8px" }}
          />
          <button
            onClick={saveInterval}
            disabled={saving}
            style={{
              border: "1px solid #4f8cff",
              borderRadius: 7,
              padding: "6px 12px",
              color: "#fff",
              background: "linear-gradient(135deg, #4f8cff, #6d5efc)",
            }}
          >
            保存扫描频率
          </button>
        </div>
        {!isCurrentPreset && toolSettings && (
          <small style={{ color: "#666" }}>当前使用自定义频率：{toolSettings.scan_interval_minutes} 分钟</small>
        )}
      </div>

      <div style={{ border: "1px solid #deebff", borderRadius: 8, padding: 12, background: "rgba(255,255,255,0.88)" }}>
        <h3 style={{ marginTop: 0, color: "#145f9e" }}>自动调价规则</h3>
        <p style={{ marginTop: 0, color: "#666", fontSize: 13, lineHeight: 1.5 }}>
          以下三条为固定跟卖逻辑；你只需设置「比对手低多少卢布」。成本价在商品列表中为每个 SKU 单独维护，触及后停止跟价。
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
          }}
        >
          保存调价规则
        </button>
      </div>

      <StoreManager stores={stores} onStoreChanged={onStoreChanged} />
    </section>
  );
}
