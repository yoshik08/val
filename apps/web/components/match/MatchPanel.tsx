"use client";

import { useApi } from "@/lib/use-api";
import type { MatchData } from "@/lib/types";
import Card from "../ui/Card";
import AgentSelect from "./AgentSelect";
import TeammateList from "./TeammateList";
import Skeleton from "../ui/Skeleton";

function SidePill({ side }: { side?: string }) {
  if (!side) return null;
  const s = side.toLowerCase();
  const isAttack = s === "attack" || s === "atk";
  const isDefend = s === "defend" || s === "def";
  if (!isAttack && !isDefend) {
    return <span className="pill pregame">{side}</span>;
  }
  return (
    <span className={`pill side-pill ${isAttack ? "attack" : "defend"}`}>
      {isAttack ? "attack" : "defend"}
    </span>
  );
}

export default function MatchPanel() {
  const { status, data, error, reload } = useApi<MatchData>("/api/match", [], 30000);

  const updated = status === "ok" ? new Date().toLocaleTimeString() : "";

  return (
    <Card
      title="live match"
      right={updated ? <span>updated {updated}</span> : undefined}
    >
      {status === "loading" && (
        <div style={{ display: "grid", gap: 10 }}>
          <Skeleton width={120} height={20} />
          <Skeleton width={60} height={14} />
          <Skeleton height={36} />
          <Skeleton height={36} />
        </div>
      )}
      {status === "error" && (
        <div>
          <p className="err">{error?.message}</p>
          <p className="dim" style={{ marginTop: 6 }}>
            <button
              className="icon-btn"
              style={{ width: "auto", padding: "4px 12px", height: "auto" }}
              onClick={() => reload()}
            >
              retry
            </button>
          </p>
        </div>
      )}
      {status === "ok" && data && !data.inGame && (
        <p className="dim">
          not in a match right now. queue up and this updates live.
        </p>
      )}
      {status === "ok" && data && data.inGame && (
        <div className="match-live">
          {data.phase === "pregame" ? (
            <>
              <span className="pill pregame">agent select</span>
              <div style={{ marginTop: 10 }}>
                <SidePill side={data.side} />
              </div>
              <h3 style={{ marginTop: 8 }}>
                {data.map}
                {data.mode && <span className="dim"> · {data.mode}</span>}
              </h3>
              {data.sideNote ? (
                <p className="match-meta">{data.sideNote}</p>
              ) : (
                <p className="match-meta">
                  starting side — first-half estimate, flips after round 12
                </p>
              )}
              <AgentSelect agent={data.myAgent} />
              <TeammateList teammates={data.teammates} />
            </>
          ) : (
            <>
              <span className="pill live">in match</span>
              <h3 style={{ marginTop: 8 }}>
                {data.map}
                {data.mode && <span className="dim"> · {data.mode}</span>}
              </h3>
              {data.myAgent && (
                <p className="match-meta">
                  playing <b style={{ color: "var(--ink)" }}>{data.myAgent}</b>
                </p>
              )}
              <TeammateList teammates={data.teammates} />
            </>
          )}
        </div>
      )}
    </Card>
  );
}
