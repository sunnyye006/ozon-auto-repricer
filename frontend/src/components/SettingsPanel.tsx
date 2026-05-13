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

      <StoreManager stores={stores} onStoreChanged={onStoreChanged} />
    </section>
  );
}
