import { useState } from "react";
import { ROUND_MS } from "@/lib/balabet/engine";
import { useLive } from "@/lib/balabet/live";
import { type Phase, useDispute } from "@/lib/balabet/store";

const TICKS = [100, 80, 50, 30, 10, 0];

function colorOf(index: number) {
  return `var(--color-player-${index + 1})`;
}

function toPoints(points: { t: number; y: number }[]) {
  return points
    .map((point) => {
      const x = (point.t / ROUND_MS) * 1000;
      const y = 1000 - (point.y / 100) * 1000;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function ChartPanel({ phase }: { phase: Phase }) {
  const liveChart = useLive((state) => state.chart);
  const snapshot = useDispute((state) => state.chartSnapshot);
  const players = useDispute((state) => state.players);
  const moving = phase === "countdown" || phase === "running";
  const series = moving ? liveChart : snapshot;
  const [hover, setHover] = useState<string | null>(null);
  const frozen = phase === "results" || phase === "final";

  return (
    <section className="panel p-3 sm:p-4" aria-label="Gráfico da rodada">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-muted">GRÁFICO</h2>
        {frozen ? <span className="font-mono text-xs text-gold">CONGELADO</span> : null}
      </div>
      <div className="flex gap-2">
        <div className="flex h-72 w-10 shrink-0 flex-col justify-between py-1 font-mono text-[10px] text-muted md:h-[26rem]">
          {TICKS.map((tick) => (
            <span key={tick}>{tick}%</span>
          ))}
        </div>
        <div
          className="relative h-72 min-w-0 flex-1 overflow-hidden rounded-xl border border-line bg-bg md:h-[26rem]"
          onMouseLeave={() => setHover(null)}
        >
          <svg viewBox="0 0 1000 1000" className="chart-grid h-full w-full" role="img" aria-label="Linhas independentes dos jogadores">
            {TICKS.map((tick) => {
              const y = 1000 - (tick / 100) * 1000;
              return <line key={tick} x1="0" y1={y} x2="1000" y2={y} />;
            })}
            {[0, 250, 500, 750, 1000].map((x) => (
              <line key={x} x1={x} y1="0" x2={x} y2="1000" />
            ))}
            {players.map((player) => {
              const line = series?.find((item) => item.playerId === player.id);
              if (!line || line.points.length === 0) return null;
              const points = toPoints(line.points);
              const dim = hover !== null && hover !== player.id;
              return (
                <g key={player.id}>
                  <polyline
                    points={points}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="36"
                    onMouseEnter={() => setHover(player.id)}
                  />
                  <polyline
                    points={points}
                    fill="none"
                    stroke={colorOf(player.colorIndex)}
                    strokeWidth={hover === player.id ? 7 : 4.5}
                    strokeLinejoin="miter"
                    strokeLinecap="butt"
                    opacity={dim ? 0.28 : 1}
                    style={{ filter: hover === player.id ? "drop-shadow(0 0 6px currentColor)" : undefined }}
                  />
                </g>
              );
            })}
          </svg>
          {!series ? (
            <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted">
              As linhas aparecem na contagem e se movem por 15 segundos.
            </p>
          ) : null}
        </div>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {players.map((player) => (
          <li
            key={player.id}
            className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-sm"
            style={{ opacity: hover && hover !== player.id ? 0.45 : 1 }}
          >
            <span className="size-2.5 rounded-full" style={{ background: colorOf(player.colorIndex) }} />
            {player.name}
          </li>
        ))}
      </ul>
    </section>
  );
}
