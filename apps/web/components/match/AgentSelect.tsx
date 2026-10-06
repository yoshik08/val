import Skeleton from "../ui/Skeleton";

/**
 * Agent-select side panel: shows the agent you locked in pregame,
 * or a picking shimmer while agents are still being chosen.
 */
export default function AgentSelect({ agent }: { agent?: string | null }) {
  if (agent) {
    return (
      <p className="match-meta">
        you locked <b style={{ color: "var(--ink)" }}>{agent}</b>
      </p>
    );
  }
  return (
    <div className="row" style={{ marginTop: 8 }}>
      <Skeleton width={90} height={12} />
      <span className="dim">picking agents…</span>
    </div>
  );
}
