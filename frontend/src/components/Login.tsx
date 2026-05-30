import { useState } from "react";

import { api, setToken } from "../api/client";
import type { AuthUser } from "../types";
import loginBg from "../assets/login-bg.png";

type Props = {
  onAuthed: (user: AuthUser) => void;
};

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
      {off && <line x1="3" y1="3" x2="21" y2="21" />}
    </svg>
  );
}

export function Login({ onAuthed }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!email.trim() || !password) {
      setError("请输入邮箱和密码");
      return;
    }
    if (mode === "register" && !username.trim()) {
      setError("请输入用户名");
      return;
    }
    if (mode === "register" && password.length < 6) {
      setError("密码至少 6 位");
      return;
    }
    setSubmitting(true);
    try {
      const res =
        mode === "login"
          ? await api.login(email.trim(), password)
          : await api.register(email.trim(), username.trim(), password);
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
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: `#eef3fb url(${loginBg}) center / cover no-repeat`,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: "rgba(255, 255, 255, 0.6)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderRadius: 16,
          border: "1px solid rgba(255, 255, 255, 0.8)",
          boxShadow: "0 20px 52px rgba(60, 100, 190, 0.18)",
          padding: 28,
        }}
      >
        <h1 style={{ margin: "0 0 4px", color: "#12263f", fontSize: 22 }}>Ozon 自动跟卖调价</h1>
        <p style={{ margin: "0 0 20px", color: "#41527a", fontSize: 13 }}>
          {mode === "login" ? "登录你的账号" : "注册新账号"}
        </p>

        <div style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#33456a" }}>
            邮箱
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={inputStyle}
            />
          </label>

          {mode === "register" && (
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#33456a" }}>
              用户名
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="显示在右上角的名字"
                style={inputStyle}
              />
            </label>
          )}

          <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#33456a" }}>
            密码
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submit();
                }}
                placeholder={mode === "register" ? "至少 6 位" : "请输入密码"}
                style={{ ...inputStyle, width: "100%", boxSizing: "border-box", paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "隐藏密码" : "显示密码"}
                title={showPassword ? "隐藏密码" : "显示密码"}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  border: "none",
                  background: "transparent",
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                  cursor: "pointer",
                  color: "#6a7695",
                }}
              >
                <EyeIcon off={showPassword} />
              </button>
            </div>
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

const inputStyle = {
  border: "1px solid #c5d7ff",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 14,
  background: "rgba(255, 255, 255, 0.9)",
  color: "#12263f",
} as const;
