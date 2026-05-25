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

export function SettingsPanel({ stores, toolSettings, onStoreChanged, onSettingsChanged, hideTitle = false }: Props) {
  const presetOptions = toolSettings?.preset_options ?? [5, 10, 20];
  const [selectedOption, setSelectedOption] = useState<string>("10");
  const [customMinutes, setCustomMinutes] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [rulesDraft, setRulesDraft] = useState({
    price_step: "0.10",
    cost_buffer: "0.00",
    max_round_drop_percent: "30",
    restore_when_no_competitors: true,
  });
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
    setRulesDraft({
      price_step: toolSettings.repricing_rules.price_step ?? "0.10",
      cost_buffer: toolSettings.repricing_rules.cost_buffer ?? "0.00",
      max_round_drop_percent: String(toolSettings.repricing_rules.max_round_drop_percent ?? 30),
      restore_when_no_competitors: Boolean(toolSettings.repricing_rules.restore_when_no_competitors),
    });
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
    const payload = {
      price_step: Number(rulesDraft.price_step),
      cost_buffer: Number(rulesDraft.cost_buffer),
      max_round_drop_percent: Number(rulesDraft.max_round_drop_percent),
      restore_when_no_competitors: rulesDraft.restore_when_no_competitors,
    };
    if (!Number.isFinite(payload.price_step) || payload.price_step <= 0) {
      alert("降价步长必须大于 0");
      return;
    }
    if (!Number.isFinite(payload.cost_buffer) || payload.cost_buffer < 0) {
      alert("成本缓冲不能小于 0");
      return;
    }
    if (
      !Number.isFinite(payload.max_round_drop_percent) ||
      payload.max_round_drop_percent <= 0 ||
      payload.max_round_drop_percent > 100
    ) {
      alert("单轮最大降幅必须在 0-100 之间");
      return;
    }
    setSavingRules(true);
    try {
      const latest = await api.updateRepricingRules(payload);
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
        <p style={{ marginTop: 0, color: "#666" }}>在这里可直接调节降价策略和止损边界，保存后后端下一轮扫描立即生效。</p>
        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ display: "grid", gap: 4, color: "#415472", fontSize: 13 }}>
            降价步长（每轮）
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={rulesDraft.price_step}
              onChange={(e) => setRulesDraft((prev) => ({ ...prev, price_step: e.target.value }))}
              style={{ border: "1px solid #c5d7ff", borderRadius: 6, padding: "6px 8px" }}
            />
          </label>
          <label style={{ display: "grid", gap: 4, color: "#415472", fontSize: 13 }}>
            成本缓冲（成本价上方保底）
            <input
              type="number"
              min={0}
              step={0.01}
              value={rulesDraft.cost_buffer}
              onChange={(e) => setRulesDraft((prev) => ({ ...prev, cost_buffer: e.target.value }))}
              style={{ border: "1px solid #c5d7ff", borderRadius: 6, padding: "6px 8px" }}
            />
          </label>
          <label style={{ display: "grid", gap: 4, color: "#415472", fontSize: 13 }}>
            单轮最大降幅（%）
            <input
              type="number"
              min={1}
              max={100}
              step={0.1}
              value={rulesDraft.max_round_drop_percent}
              onChange={(e) => setRulesDraft((prev) => ({ ...prev, max_round_drop_percent: e.target.value }))}
              style={{ border: "1px solid #c5d7ff", borderRadius: 6, padding: "6px 8px" }}
            />
          </label>
          <label style={{ display: "inline-flex", gap: 8, alignItems: "center", color: "#415472", fontSize: 13 }}>
            <input
              type="checkbox"
              checked={rulesDraft.restore_when_no_competitors}
              onChange={(e) => setRulesDraft((prev) => ({ ...prev, restore_when_no_competitors: e.target.checked }))}
            />
            对手退出后恢复本轮原价
          </label>
          <button
            onClick={saveRules}
            disabled={savingRules}
            style={{
              justifySelf: "start",
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
      </div>

      <StoreManager stores={stores} onStoreChanged={onStoreChanged} />
    </section>
  );
}
