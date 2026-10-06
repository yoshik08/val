import type { Teammate } from "@/lib/types";

export default function TeammateList({ teammates }: { teammates?: Teammate[] }) {
  if (!teammates || teammates.length === 0) {
    return <p className="dim" style={{ marginTop: 8 }}>no teammate info yet.</p>;
  }
  return (
    <div className="team-list">
      {teammates.map((p, i) => (
        <div className="p" key={`${p.name}-${i}`}>
          <span>{p.name}</span>
          {p.agent && <span className="a">{p.agent}</span>}
        </div>
      ))}
    </div>
  );
}
