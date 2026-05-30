import { useEffect, useState } from "react";

import { api } from "../api/client";
import type { AdminStore, AuthUser } from "../types";

const sectionStyle = {
  border: "1px solid #dbe7ff",
  borderRadius: 10,
  padding: 14,
  background: "linear-gradient(180deg, #ffffff 0%, #f7fbff 100%)",
} as const;

const UNASSIGNED = "__none__";

export function AdminPanel() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [stores, setStores] = useState<AdminStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingStoreId, setSavingStoreId] = useState<number | null>(null);

  async function reload() {
    setError(null);
    try {
      const [u, s] = await Promise.all([api.getAdminUsers(), api.getAdminStores()]);
      setUsers(u);
      setStores(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function changeOwner(store: AdminStore, value: string) {
    const userId = value === UNASSIGNED ? null : Number(value);
    setSavingStoreId(store.id);
    try {
      const updated = await api.assignStore(store.id, userId);
      setStores((prev) => prev.map((s) => (s.id === store.id ? updated : s)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "分配失败");
    } finally {
      setSavingStoreId(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={sectionStyle}>
        <h3 style={{ marginTop: 0, color: "#1d4f91" }}>用户管理（超级管理员）</h3>
        {error && <div style={{ color: "#cb1b45", fontSize: 13 }}>{error}</div>}
        {loading ? (
          <p style={{ color: "#888", fontSize: 13, margin: 0 }}>加载中…</p>
        ) : users.length === 0 ? (
          <p style={{ color: "#888", fontSize: 13, margin: 0 }}>暂无注册用户。</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f1f6ff", color: "#1d4f91" }}>
                  <th align="left" style={{ padding: "8px" }}>ID</th>
                  <th align="left" style={{ padding: "8px" }}>邮箱</th>
                  <th align="left" style={{ padding: "8px" }}>角色</th>
                  <th align="left" style={{ padding: "8px" }}>状态</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderTop: "1px solid #eef3ff" }}>
                    <td style={{ padding: "8px", color: "#415472" }}>{u.id}</td>
                    <td style={{ padding: "8px", color: "#12263f", fontWeight: 600 }}>{u.email}</td>
                    <td style={{ padding: "8px" }}>
                      <span
                        style={{
                          fontSize: 12,
                          borderRadius: 6,
                          padding: "2px 8px",
                          background: u.role === "admin" ? "#fff1d6" : "#e8f0ff",
                          color: u.role === "admin" ? "#a15d00" : "#2b5fcc",
                          fontWeight: 700,
                        }}
                      >
                        {u.role === "admin" ? "超级管理员" : "普通用户"}
                      </span>
                    </td>
                    <td style={{ padding: "8px", color: u.is_active ? "#1a7f37" : "#999" }}>
                      {u.is_active ? "启用" : "禁用"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={sectionStyle}>
        <h3 style={{ marginTop: 0, color: "#1d4f91" }}>店铺归属分配</h3>
        <p style={{ marginTop: 0, color: "#666", fontSize: 13 }}>
          把每个店铺分配给某个用户后，该用户登录后只能看到分配给自己的店铺；未分配的店铺仅超级管理员可见。
        </p>
        {loading ? (
          <p style={{ color: "#888", fontSize: 13, margin: 0 }}>加载中…</p>
        ) : stores.length === 0 ? (
          <p style={{ color: "#888", fontSize: 13, margin: 0 }}>暂无店铺。</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {stores.map((store) => (
              <div
                key={store.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                  padding: "10px 12px",
                  border: "1px solid #ecf2ff",
                  borderRadius: 8,
                  background: "#fff",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: "#12263f" }}>{store.name}</div>
                  <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
                    当前归属：{store.owner_email ?? "未分配（仅超管可见）"}
                  </div>
                </div>
                <select
                  value={store.owner_id == null ? UNASSIGNED : String(store.owner_id)}
                  disabled={savingStoreId === store.id}
                  onChange={(e) => changeOwner(store, e.target.value)}
                  style={{ border: "1px solid #c5d7ff", borderRadius: 6, padding: "6px 8px", minWidth: 200 }}
                >
                  <option value={UNASSIGNED}>未分配（仅超管可见）</option>
                  {users.map((u) => (
                    <option key={u.id} value={String(u.id)}>
                      {u.email}
                      {u.role === "admin" ? "（超管）" : ""}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
