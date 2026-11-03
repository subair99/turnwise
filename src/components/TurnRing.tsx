// The turn ring: members around the circle in turn order. Filled indigo = has collected (with their cycle number).
// Gold outline = still waiting. In auction mode every waiting member is in the running; in fixed order, the next one pulses.
export interface RingMember {
  id: string;
  name: string;
  city: string;
  collectedCycle: number | null;
}

const money = (c: number) => (c % 100 === 0 ? `$${(c / 100).toLocaleString("en-US")}` : `$${(c / 100).toFixed(2)}`);

export function TurnRing({ members, potCents, cycleNumber, totalCycles, closedCycles, dueLabel, turnMode }: {
  members: RingMember[];
  potCents: number;
  cycleNumber: number | null;
  totalCycles: number;
  closedCycles: number;
  dueLabel: string;
  turnMode: string;
}) {
  const size = 400;
  const pad = 90; // room for the side labels
  const c = size / 2;
  const r = 128;
  const n = Math.max(members.length, 1);
  const ordered = [...members].sort((a, b) => (a.collectedCycle ?? 99) - (b.collectedCycle ?? 99));
  const circumference = 2 * Math.PI * r;
  const progress = totalCycles ? closedCycles / totalCycles : 0;
  const nextUp = ordered.find((m) => m.collectedCycle === null);

  return (
    <svg viewBox={`${-pad} -6 ${size + pad * 2} ${size + 12}`} role="img" aria-label={`Turn ring: ${closedCycles} of ${totalCycles} turns paid out`}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="var(--wash)" strokeWidth={10} />
      <circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke="var(--indigo)"
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={`${circumference * progress} ${circumference}`}
        transform={`rotate(-90 ${c} ${c})`}
      />
      {ordered.map((m, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        const x = c + r * Math.cos(angle);
        const y = c + r * Math.sin(angle);
        const lx = c + (r + 40) * Math.cos(angle);
        const ly = c + (r + 40) * Math.sin(angle);
        const anchor = Math.abs(lx - c) < 12 ? "middle" : lx > c ? "start" : "end";
        const collected = m.collectedCycle !== null;
        const waiting = !collected && cycleNumber !== null;
        const pulse = waiting && turnMode !== "auction" && m.id === nextUp?.id;
        return (
          <g key={m.id}>
            <circle
              className={pulse ? "ring-current" : undefined}
              cx={x}
              cy={y}
              r={20}
              fill={collected ? "var(--indigo)" : "var(--surface)"}
              stroke={waiting ? "var(--kola)" : "var(--indigo)"}
              strokeWidth={waiting ? 3.5 : 2}
            />
            <text x={x} y={y + 5} textAnchor="middle" fontSize={14} fontWeight={700} fill={collected ? "#fff" : "var(--indigo)"}>
              {collected ? m.collectedCycle : m.name.slice(0, 1)}
            </text>
            <text x={lx} y={ly - 2} textAnchor={anchor} fontSize={14} fontWeight={700} fill="var(--indigo)">{m.name}</text>
            {m.city ? <text x={lx} y={ly + 14} textAnchor={anchor} fontSize={12} fill="var(--ink-muted)">{m.city}</text> : null}
          </g>
        );
      })}
      <text x={c} y={c - 22} textAnchor="middle" fontSize={14} fill="var(--ink-muted)">
        {cycleNumber ? `Cycle ${cycleNumber} of ${totalCycles}` : "Every turn paid out"}
      </text>
      <text x={c} y={c + 20} textAnchor="middle" fontSize={44} fontWeight={800} fill="var(--indigo)" style={{ fontFamily: "var(--font-display)" }}>
        {money(potCents)}
      </text>
      <text x={c} y={c + 44} textAnchor="middle" fontSize={13} fill="var(--ink-muted)">{dueLabel}</text>
    </svg>
  );
}
