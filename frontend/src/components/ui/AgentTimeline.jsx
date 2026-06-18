import { palette, agentStateMeta } from "../../constants/theme";

const TERMINAL = new Set(["COMPLETED", "FAILED", "CANCELLED"]);

// Vertical timeline of the agent's OPERATIONAL steps (from the persisted
// step_log). Shows what the agent did and what it is waiting on — never its
// internal reasoning.
export default function AgentTimeline({ steps = [], currentState, dm = false }) {
  const t = palette(dm);
  if (!Array.isArray(steps) || steps.length === 0) return null;
  const lastIndex = steps.length - 1;
  const runFinished = TERMINAL.has(currentState);

  return (
    <ol aria-label="Pasos ejecutados por el agente" style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {steps.map((entry, i) => {
        const meta = agentStateMeta[entry.state] || { label: entry.state, tone: t.textMuted };
        const isCurrent = i === lastIndex && !runFinished && entry.state === "WAITING_FOR_USER";
        const isLastDone = i === lastIndex && runFinished;
        const dotColor = isCurrent ? meta.tone : isLastDone ? meta.tone : t.positive;
        return (
          <li key={i} style={{ display: "flex", gap: 10, paddingBottom: i === lastIndex ? 0 : 12, position: "relative" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{
                width: 12, height: 12, borderRadius: "50%", flexShrink: 0, marginTop: 2,
                background: isCurrent ? "transparent" : dotColor,
                border: isCurrent ? `2px solid ${meta.tone}` : "none",
                boxShadow: isCurrent ? `0 0 0 3px ${meta.tone}22` : "none",
              }} />
              {i !== lastIndex && <span style={{ width: 2, flex: 1, background: t.border, marginTop: 2 }} />}
            </div>
            <div style={{ paddingBottom: 2 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{meta.label}</div>
              {entry.detail && <div style={{ fontSize: 12, color: t.textMuted, marginTop: 1 }}>{entry.detail}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
