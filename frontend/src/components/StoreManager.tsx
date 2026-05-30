import { useState } from "react";

import { api } from "../api/client";
import type { Store, SyncProgress } from "../types";

type Props = {
  stores: Store[];
  onStoreChanged: () => Promise<void>;
  onProductsChanged: () => Promise<void>;
};

const sectionStyle = {
  border: "1px solid #dbe7ff",
  borderRadius: 10,
  padding: 14,
  background: "linear-gradient(180deg, #ffffff 0%, #f7fbff 100%)",
} as const;

const inputStyle = {
  border: "1px solid #c5d7ff",
  borderRadius: 6,
  padding: "8px 10px",
  minWidth: 140,
} as const;

type EditForm = {
  name: string;
  client_id: string;
  api_key: string;
  api_base_url: string;
};

function progressPercent(progress: SyncProgress | null): number {
  if (!progress) return 0;
  if (progress.phase === "done") return 100;
  if (!progress.total || progress.total <= 0) {
    return progress.phase === "fetch" ? 12 : 0;
  }
  return Math.min(99, Math.round(((progress.current ?? 0) / progress.total) * 100));
}

function ToggleSwitch({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        position: "relative",
        width: 44,
        height: 24,
        borderRadius: 999,
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        background: checked ? "linear-gradient(135deg, #4f8cff, #6d5efc)" : "#cdd6e5",
        transition: "background 0.2s ease",
        padding: 0,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: checked ? 23 : 3,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
          transition: "left 0.2s ease",
        }}
      />
    </button>
  );
}

export function StoreManager({ stores, onStoreChanged, onProductsChanged }: Props) {
  const [form, setForm] = useState({ name: "", client_id: "", api_key: "", api_base_url: "" });
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: "", client_id: "", api_key: "", api_base_url: "" });
  const [savingEditId, setSavingEditId] = useState<number | null>(null);
  const [syncingStoreIds, setSyncingStoreIds] = useState<Set<number>>(new Set());
  const [syncProgressByStore, setSyncProgressByStore] = useState<Record<number, SyncProgress>>({});
  const [autoOverrideByStore, setAutoOverrideByStore] = useState<Record<number, boolean>>({});

  function runSyncDetached(storeId: number) {
    setSyncingStoreIds((prev) => {
      const next = new Set(prev);
      next.add(storeId);
      return next;
    });
    setSyncProgressByStore((prev) => ({
      ...prev,
      [storeId]: { phase: "fetch", message: "准备同步…" },
    }));
    void (async () => {
      try {
        const result = await api.syncStoreProducts(storeId, (progress) =>
          setSyncProgressByStore((prev) => ({ ...prev, [storeId]: progress }))
        );
        setSyncProgressByStore((prev) => ({
          ...prev,
          [storeId]: { phase: "done", synced: result.synced, message: `同步完成，共 ${result.synced} 个商品` },
        }));
        await onStoreChanged();
        await onProductsChanged();
      } catch (err) {
        const message = err instanceof Error ? err.message : "同步商品失败";
        setSyncProgressByStore((prev) => ({
          ...prev,
          [storeId]: { phase: "error", message },
        }));
      } finally {
        setSyncingStoreIds((prev) => {
          const next = new Set(prev);
          next.delete(storeId);
          return next;
        });
      }
    })();
  }

  async function submit() {
    if (!form.name.trim() || !form.client_id.trim() || !form.api_key.trim()) {
      alert("请填写店铺名称、Client ID 和 API Key");
      return;
    }
    setCreating(true);
    try {
      const created = await api.createStore(form);
      setForm({ name: "", client_id: "", api_key: "", api_base_url: "" });
      await onStoreChanged();
      runSyncDetached(created.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "绑定店铺失败");
    } finally {
      setCreating(false);
    }
  }

  function startEdit(store: Store) {
    setEditingId(store.id);
    setEditForm({
      name: store.name,
      client_id: store.client_id,
      api_key: "",
      api_base_url: store.api_base_url,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({ name: "", client_id: "", api_key: "", api_base_url: "" });
  }

  async function saveEdit(storeId: number) {
    if (!editForm.name.trim() || !editForm.client_id.trim()) {
      alert("请填写店铺名称和 Client ID");
      return;
    }
    setSavingEditId(storeId);
    try {
      await api.updateStore(storeId, {
        name: editForm.name.trim(),
        client_id: editForm.client_id.trim(),
        api_base_url: editForm.api_base_url.trim() || undefined,
        ...(editForm.api_key.trim() ? { api_key: editForm.api_key.trim() } : {}),
      });
      cancelEdit();
      await onStoreChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : "保存店铺信息失败");
    } finally {
      setSavingEditId(null);
    }
  }

  function toggleStoreAutoReprice(store: Store, nextValue: boolean) {
    setAutoOverrideByStore((prev) => ({ ...prev, [store.id]: nextValue }));
    void (async () => {
      try {
        await api.updateStore(store.id, { auto_reprice_enabled: nextValue });
        await onStoreChanged();
        await onProductsChanged();
      } catch (err) {
        alert(err instanceof Error ? err.message : "切换店铺自动调价失败");
      } finally {
        setAutoOverrideByStore((prev) => {
          const nextState = { ...prev };
          delete nextState[store.id];
          return nextState;
        });
      }
    })();
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={sectionStyle}>
        <h3 style={{ marginTop: 0, color: "#1d4f91" }}>新增店铺</h3>
        <p style={{ marginTop: 0, color: "#666", fontSize: 13 }}>
          填写 Ozon Seller API 凭据后绑定新店铺。绑定成功后会自动开始首次商品同步（带进度条），同步过程中可以继续操作其它店铺。
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input placeholder="店铺名称" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} />
          <input placeholder="Client ID" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} style={inputStyle} />
          <input placeholder="API Key" value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} style={{ ...inputStyle, minWidth: 180 }} />
          <input placeholder="API Base URL (可选)" value={form.api_base_url} onChange={(e) => setForm({ ...form, api_base_url: e.target.value })} style={{ ...inputStyle, minWidth: 220 }} />
          <button
            disabled={creating}
            onClick={submit}
            style={{
              border: "1px solid #4f8cff",
              borderRadius: 7,
              padding: "8px 16px",
              color: "#fff",
              background: "linear-gradient(135deg, #4f8cff, #6d5efc)",
              cursor: creating ? "not-allowed" : "pointer",
            }}
          >
            {creating ? "绑定中…" : "绑定店铺"}
          </button>
        </div>
      </div>

      <div style={sectionStyle}>
        <h3 style={{ marginTop: 0, color: "#1d4f91" }}>已绑定店铺管理</h3>
        {stores.length === 0 ? (
          <p style={{ color: "#888", fontSize: 13, margin: 0 }}>暂无已绑定店铺。</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {stores.map((store) => {
              const isEditing = editingId === store.id;
              const isSyncing = syncingStoreIds.has(store.id);
              const syncProgress = syncProgressByStore[store.id];
              const percent = progressPercent(syncProgress ?? null);
              const showProgress = Boolean(syncProgress);

              return (
                <div
                  key={store.id}
                  style={{
                    padding: "12px 14px",
                    border: "1px solid #ecf2ff",
                    borderRadius: 8,
                    background: "#fff",
                    display: "grid",
                    gap: 10,
                  }}
                >
                  {isEditing ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <input placeholder="店铺名称" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} style={inputStyle} />
                      <input placeholder="Client ID" value={editForm.client_id} onChange={(e) => setEditForm({ ...editForm, client_id: e.target.value })} style={inputStyle} />
                      <input placeholder="新 API Key（留空则不修改）" value={editForm.api_key} onChange={(e) => setEditForm({ ...editForm, api_key: e.target.value })} style={{ ...inputStyle, minWidth: 200 }} />
                      <input placeholder="API Base URL" value={editForm.api_base_url} onChange={(e) => setEditForm({ ...editForm, api_base_url: e.target.value })} style={{ ...inputStyle, minWidth: 220 }} />
                      <button
                        disabled={savingEditId === store.id}
                        onClick={() => saveEdit(store.id)}
                        style={{
                          border: "1px solid #4f8cff",
                          borderRadius: 7,
                          padding: "6px 14px",
                          color: "#fff",
                          background: "linear-gradient(135deg, #4f8cff, #6d5efc)",
                          cursor: "pointer",
                        }}
                      >
                        保存
                      </button>
                      <button
                        onClick={cancelEdit}
                        style={{ border: "1px solid #c5d7ff", borderRadius: 7, padding: "6px 14px", background: "#fff", color: "#666", cursor: "pointer" }}
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontWeight: 600, color: "#12263f" }}>{store.name}</div>
                        <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>Client ID: {store.client_id}</div>
                        <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{store.api_base_url}</div>
                        <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>
                          上次同步：{store.last_synced_at ? new Date(store.last_synced_at).toLocaleString() : "—"}
                          {" · "}上次扫描：{store.last_scanned_at ? new Date(store.last_scanned_at).toLocaleString() : "—"}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                        {(() => {
                          const autoChecked = autoOverrideByStore[store.id] ?? store.auto_reprice_enabled;
                          return (
                            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#415472" }}>
                              店铺自动调价
                              <ToggleSwitch
                                checked={autoChecked}
                                onChange={(v) => toggleStoreAutoReprice(store, v)}
                              />
                              <span style={{ fontSize: 12, color: autoChecked ? "#1a7f37" : "#999" }}>
                                {autoChecked ? "已开启" : "已关闭"}
                              </span>
                            </label>
                          );
                        })()}
                        <button
                          onClick={() => startEdit(store)}
                          style={{ border: "1px solid #c5d7ff", borderRadius: 7, padding: "6px 14px", background: "#fff", color: "#2b5fcc", cursor: "pointer" }}
                        >
                          编辑信息
                        </button>
                        <button
                          disabled={isSyncing}
                          onClick={() => runSyncDetached(store.id)}
                          style={{
                            border: "1px solid #7c5cff",
                            borderRadius: 7,
                            padding: "6px 14px",
                            color: "#513ad9",
                            background: "#fff",
                            cursor: isSyncing ? "not-allowed" : "pointer",
                          }}
                        >
                          {isSyncing ? "同步中…" : "立即同步商品"}
                        </button>
                      </div>
                    </div>
                  )}

                  {showProgress && (
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ height: 8, borderRadius: 999, background: "#edf3ff", overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${percent}%`,
                            height: "100%",
                            background: syncProgress?.phase === "error" ? "#e5534b" : "linear-gradient(90deg, #4f8cff, #6d5efc)",
                            transition: "width 0.25s ease",
                          }}
                        />
                      </div>
                      <small style={{ color: syncProgress?.phase === "error" ? "#b42318" : "#666" }}>
                        {syncProgress?.message ?? "同步中…"}
                        {syncProgress?.total ? ` (${syncProgress.current ?? 0}/${syncProgress.total})` : ""}
                      </small>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
