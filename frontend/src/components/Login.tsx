import { useState } from "react";

import { api, setToken } from "../api/client";
import type { AuthUser } from "../types";

type Props = {
  onAuthed: (user: AuthUser) => void;
};

export function Login({ onAuthed }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!email.trim() || !password) {
      setError("请输入邮箱和密码");
      return;
    }
    if (mode === "register" && password.length < 6) {
      setError("密码至少 6 位");
      return;
    }
    setSubmitting(true);
    try {
      const res = mode === "login" ? await api.login(email.trim(), password) : await api.register(email.trim(), password);
      setToken(res.access_token);
      onAuthed(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #eef6ff 0%, #f4f9ff 45%, #f6f3ff 100%)",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: "#fff",
          borderRadius: 16,
          border: "1px solid #e2ebff",
          boxShadow: "0 18px 48px rgba(40, 85, 170, 0.12)",
          padding: 28,
        }}
      >
        <h1 style={{ margin: "0 0 4px", color: "#12263f", fontSize: 22 }}>Ozon 自动跟卖调价</h1>
        <p style={{ margin: "0 0 20px", color: "#6a7695", fontSize: 13 }}>
          {mode === "login" ? "登录你的账号" : "注册新账号"}
        </p>

        <div style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#415472" }}>
            邮箱
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{ border: "1px solid #c5d7ff", borderRadius: 8, padding: "10px 12px", fontSize: 14 }}
            />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#415472" }}>
            密码
            <input
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
              placeholder={mode === "register" ? "至少 6 位" : "请输入密码"}
              style={{ border: "1px solid #c5d7ff", borderRadius: 8, padding: "10px 12px", fontSize: 14 }}
            />
          </label>

          {error && <div style={{ color: "#cb1b45", fontSize: 13 }}>{error}</div>}

          <button
            type="button"
            disabled={submitting}
            onClick={submit}
            style={{
              border: "none",
              borderRadius: 8,
              padding: "11px 12px",
              color: "#fff",
              fontSize: 15,
              fontWeight: 600,
              background: "linear-gradient(135deg, #4f8cff, #6d5efc)",
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.75 : 1,
            }}
          >
            {submitting ? "处理中…" : mode === "login" ? "登录" : "注册并登录"}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode((m) => (m === "login" ? "register" : "login"));
              setError(null);
            }}
            style={{ border: "none", background: "transparent", color: "#2b5fcc", cursor: "pointer", fontSize: 13 }}
          >
            {mode === "login" ? "没有账号？去注册" : "已有账号？去登录"}
          </button>
        </div>
      </div>
    </div>
  );
}
