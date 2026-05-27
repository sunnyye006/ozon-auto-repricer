import { createPortal } from "react-dom";

type Props = {
  isOpen: boolean;
  onClick: () => void;
};

export function FixedSettingsButton({ isOpen, onClick }: Props) {
  return createPortal(
    <button
      type="button"
      onClick={onClick}
      aria-label={isOpen ? "关闭设置" : "打开设置"}
      title={isOpen ? "关闭设置" : "打开设置"}
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 10001,
        width: 44,
        height: 44,
        border: "1px solid #8bb8ff",
        borderRadius: 10,
        background: "linear-gradient(135deg, #4f8cff, #6d5efc)",
        color: "#fff",
        cursor: "pointer",
        fontSize: isOpen ? 20 : 22,
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 4px 16px rgba(79, 140, 255, 0.35)",
      }}
    >
      {isOpen ? "✕" : "⚙"}
    </button>,
    document.body
  );
}
