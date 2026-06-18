import * as Dialog from "@radix-ui/react-dialog";
import { palette } from "../../constants/theme";

// Accessible modal built on Radix Dialog (headless): focus trap, Escape to
// close, aria wiring and scroll lock come for free; the visual styling is ours
// (inline styles + theme tokens). No external *styled* UI library.
export default function Modal({ open, onClose, title, description, children, footer, dm = false, maxWidth = 460 }) {
  const t = palette(dm);
  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose?.(); }}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{ position: "fixed", inset: 0, background: t.overlay, zIndex: 9998, backdropFilter: "blur(2px)" }}
        />
        <Dialog.Content
          style={{
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            width: "calc(100vw - 32px)", maxWidth, maxHeight: "85vh", overflowY: "auto",
            background: t.surface, color: t.text, border: `1px solid ${t.border}`,
            borderRadius: 14, padding: 22, zIndex: 9999,
            boxShadow: "0 20px 60px rgba(0,0,0,0.28)", fontFamily: "'Segoe UI', system-ui, sans-serif",
          }}
        >
          {title && (
            <Dialog.Title style={{ fontSize: 17, fontWeight: 800, color: t.text, margin: 0 }}>{title}</Dialog.Title>
          )}
          {description && (
            <Dialog.Description style={{ fontSize: 14, color: t.textMuted, margin: "8px 0 0", lineHeight: 1.5 }}>
              {description}
            </Dialog.Description>
          )}
          {children && <div style={{ marginTop: title || description ? 16 : 0 }}>{children}</div>}
          {footer && <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
