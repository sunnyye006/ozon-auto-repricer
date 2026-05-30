import { type CSSProperties, Fragment, useEffect, useState } from "react";

import { api } from "../api/client";
import type { AdminStore, AuthUser } from "../types";

const sectionStyle = {
  border: "1px solid #dbe7ff",
  borderRadius: 10,
  padding: 14,
  background: "linear-gradient(180deg, #ffffff 0%, #f7fbff 100%)",
} as const;

const UNASSIGNED = "__none__";

const editInputStyle: CSSProperties = {
  border: "1px solid #c5d7ff",
  borderRadius: 8,
  padding: "8px 11px",
  fontSize: 13,
  minWidth: 220,
};

function actionBtn(color: string): CSSProperties {
  return {
    border: `1px solid ${color}`,
    borderRadius: 6,
    padding: "3px 9px",
    background: "#fff",
    color,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  };
}

type Props = {
  currentUserId?: number | null;
  onSelfUpdated?: (user: AuthUser) => void;
};

export function AdminPanel({ currentUserId, onSelfUpdated }: Props) {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [stores, setStores] = useState<AdminStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingStoreId, setSavingStoreId] = useState<number | null>(null);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editPassword, setEditPassword] = useState("");

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

  async function runUserAction(userId: number, fn: () => Promise<void>) {
    setBusyUserId(userId);
    try {
      await fn();
    } catch (err) {
      alert(err instanceof Error ? err.message : "操作失败");
    } finally {
      setBusyUserId(null);
    }
  }

  function startEdit(user: AuthUser) {
    setEditingId(user.id);
    setEditName(user.username ?? "");
    setEditPassword("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditPassword("");
  }

  async function saveEdit(user: AuthUser) {
    const name = editName.trim();
    const wantName = !!name && name !== (user.username ?? "");
    const wantPassword = !!editPassword;
    if (!name) {
      alert("用户名不能为空");
      return;
    }
    if (wantPassword && editPassword.length < 6) {
      alert("新密码至少 6 位");
      return;
    }
    if (!wantName && !wantPassword) {
      alert("没有需要保存的修改");
      return;
    }
    await runUserAction(user.id, async () => {
      let updated = user;
      if (wantName) updated = await api.updateUserName(user.id, name);
      if (wantPassword) updated = await api.resetUserPassword(user.id, editPassword);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? updated : u)));
      if (currentUserId != null && user.id === currentUserId) onSelfUpdated?.(updated);
      cancelEdit();
    });
  }

  async function toggleActive(user: AuthUser) {
    await runUserAction(user.id, async () => {
      const updated = await api.setUserActive(user.id, !user.is_active);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? updated : u)));
    });
  }

  async function removeUser(user: AuthUser) {
    if (!window.confirm(`确定删除用户「${user.username || user.email}」？其名下店铺将变为未分配。`)) return;
    await runUserAction(user.id, async () => {
      await api.deleteUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      await reload();
    });
  }

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
                  <th align="left" style={{ padding: "8px" }}>用户名</th>
                  <th align="left" style={{ padding: "8px" }}>邮箱</th>
                  <th align="left" style={{ padding: "8px" }}>角色</th>
                  <th align="left" style={{ padding: "8px" }}>状态</th>
                  <th align="left" style={{ padding: "8px" }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = currentUserId != null && u.id === currentUserId;
                  const busy = busyUserId === u.id;
                  const editing = editingId === u.id;
                  return (
                  <Fragment key={u.id}>
                  <tr style={{ borderTop: "1px solid #eef3ff" }}>
                    <td style={{ padding: "8px", color: "#415472" }}>{u.id}</td>
                    <td style={{ padding: "8px", color: "#12263f", fontWeight: 600 }}>{u.username || "—"}</td>
                    <td style={{ padding: "8px", color: "#415472" }}>{u.email}</td>
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
                      {u.is_active ? "启用" : "已暂停"}
                    </td>
                    <td style={{ padding: "8px" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        <button type="button" disabled={busy} onClick={() => (editing ? cancelEdit() : startEdit(u))} style={actionBtn("#1d4f91")}>
                          {editing ? "收起" : "编辑"}
                        </button>
                        {isSelf ? (
                          <span style={{ color: "#aaa", fontSize: 12 }}>当前账号</span>
                        ) : (
                          <>
                            <button type="button" disabled={busy} onClick={() => void toggleActive(u)} style={actionBtn(u.is_active ? "#a15d00" : "#1a7f37")}>
                              {u.is_active ? "暂停" : "启用"}
                            </button>
                            <button type="button" disabled={busy} onClick={() => void removeUser(u)} style={actionBtn("#d6336c")}>
                              删除
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {editing && (
                    <tr style={{ background: "#f7faff" }}>
                      <td colSpan={6} style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                          <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#33456a" }}>
                            用户名
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              placeholder="用户名"
                              style={editInputStyle}
                            />
                          </label>
                          <label style={{ display: "grid", gap: 4, fontSize: 12, color: "#33456a" }}>
                            新密码（留空则不修改）
                            <input
                              type="password"
                              value={editPassword}
                              onChange={(e) => setEditPassword(e.target.value)}
                              autoComplete="new-password"
                              placeholder="至少 6 位"
                              style={editInputStyle}
                            />
                          </label>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void saveEdit(u)}
                            style={{
                              border: "none",
                              borderRadius: 8,
                              padding: "9px 18px",
                              color: "#fff",
                              fontSize: 13,
                              fontWeight: 600,
                              background: "linear-gradient(135deg, #4f8cff, #6d5efc)",
                              cursor: busy ? "not-allowed" : "pointer",
                              opacity: busy ? 0.7 : 1,
                            }}
                          >
                            {busy ? "保存中…" : "保存"}
                          </button>
                          <button type="button" onClick={cancelEdit} style={actionBtn("#788196")}>
                            取消
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                  );
                })}
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
