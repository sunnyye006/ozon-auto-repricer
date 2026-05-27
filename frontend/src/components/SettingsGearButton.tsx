type Props = {
  onClick: () => void;
  label?: string;
};

export function SettingsGearButton({ onClick, label = "设置" }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        width: 44,
        height: 44,
        flexShrink: 0,
        border: "1px solid #8bb8ff",
        borderRadius: 10,
        background: "linear-gradient(135deg, #4f8cff, #6d5efc)",
        color: "#fff",
        cursor: "pointer",
        fontSize: 22,
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 2px 8px rgba(79, 140, 255, 0.25)",
      }}
    >
      ⚙
    </button>
  );
}
