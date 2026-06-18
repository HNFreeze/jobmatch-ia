// Reusable card surface (inline styles, no UI libraries).
export default function Card({ children, dm = false, style = {}, ...rest }) {
  return (
    <div style={{
      background: dm ? "#0f172a" : "#fff",
      border: `1px solid ${dm ? "#1e293b" : "#e5e7eb"}`,
      borderRadius: 14,
      padding: 20,
      boxShadow: dm ? "none" : "0 1px 3px rgba(0,0,0,0.06)",
      ...style,
    }} {...rest}>
      {children}
    </div>
  );
}
