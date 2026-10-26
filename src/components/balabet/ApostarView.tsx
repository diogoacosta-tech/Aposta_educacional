import { useState, useMemo, useEffect, useRef } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { ResultsPanel } from "@/components/balabet/results-panel";
import { StatsTable, RankingTable } from "@/components/balabet/stats-table";
import {
  COUNTDOWN_MS,
  MODE_LABEL,
  ROUND_MS,
  PRIZE_WEIGHTS,
  PRIZE_TOTAL,
  formatBalas,
  directionOf,
  type Mode,
  type Direction,
  type Outcome,
} from "@/lib/balabet/engine";
import { createLiveSimulator } from "@/lib/balabet/chart";
import { useLive } from "@/lib/balabet/live";
import { phaseLabel, useDispute, type Phase, type Player } from "@/lib/balabet/store";

export const MODES: Mode[] = ["subir", "cair", "automatico"];

export const PLAYER_COLORS = [
  "#47e0d0", // Ciano (Jogador 1)
  "#6cb6ff", // Azul (Jogador 2)
  "#ff8a5b", // Laranja (Jogador 3)
  "#d18bff", // Roxo (Jogador 4)
  "#f0d27a", // Ouro (Jogador 5)
];

export function colorOf(index: number) {
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}

// ============================================================================
// LÓGICA CENTRAL DE PROCESSAMENTO DAS APOSTAS & PROBABILIDADES
// ============================================================================

/**
 * 1. Determina o resultado (vitória, derrota, empate) com base no modo
 * selecionado pelo jogador e na direção do último segmento visível.
 */
export function determineOutcome(mode: Mode, direction: Direction): Outcome {
  if (direction === "flat") return "tie";
  if (mode === "subir") return direction === "up" ? "win" : "loss";
  if (mode === "cair") return direction === "down" ? "win" : "loss";
  if (mode === "automatico") return direction === "up" ? "win" : "loss";
  return "tie";
}

/**
 * 2. Calcula o prêmio adicional em balas segundo os pesos 28, 28, 22, 11 e 6 (soma 95).
 */
export function calculatePrizeFromRoll(roll: number): number {
  if (!Number.isInteger(roll) || roll < 0 || roll >= PRIZE_TOTAL) {
    throw new Error("Rolagem de prêmio fora do intervalo 0..94.");
  }
  let acc = 0;
  for (let i = 0; i < PRIZE_WEIGHTS.length; i++) {
    acc += PRIZE_WEIGHTS[i];
    if (roll < acc) return i + 1;
  }
  return 1;
}

/**
 * 3. Sorteio independente do pirulito raro: 5% de chance em caso de vitória.
 */
export function calculateLollipopFromRoll(roll: number, outcome: Outcome): boolean {
  if (outcome !== "win") return false;
  if (!Number.isInteger(roll) || roll < 0 || roll >= 100) {
    throw new Error("Rolagem de pirulito fora de 0..99.");
  }
  return roll < 5;
}

/**
 * 4. Processa a liquidação contábil da aposta de um participante.
 */
export function processBetSettlement(input: {
  balance: number;
  stake: number;
  mode: Mode;
  direction: Direction;
  prizeRoll: number;
  lollipopRoll: number;
}) {
  const { balance, stake, mode, direction, prizeRoll, lollipopRoll } = input;

  if (!Number.isSafeInteger(balance) || balance < 0) {
    throw new Error("Saldo inválido ou negativo.");
  }
  if (!Number.isSafeInteger(stake) || stake < 1) {
    throw new Error("A aposta mínima é 1 bala.");
  }
  if (stake > balance) {
    throw new Error("A aposta não pode ultrapassar o saldo disponível.");
  }

  const outcome = determineOutcome(mode, direction);

  if (outcome === "loss") {
    return {
      outcome,
      prize: 0,
      lollipop: false,
      balanceAfter: balance - stake,
      displayedDelta: -stake,
      stake,
    };
  }

  if (outcome === "tie") {
    return {
      outcome,
      prize: 0,
      lollipop: false,
      balanceAfter: balance,
      displayedDelta: 0,
      stake,
    };
  }

  // Vitória
  const prize = calculatePrizeFromRoll(prizeRoll);
  const lollipop = calculateLollipopFromRoll(lollipopRoll, outcome);

  return {
    outcome,
    prize,
    lollipop,
    balanceAfter: balance + prize,
    displayedDelta: prize,
    stake,
  };
}

/**
 * 5. Validação rigorosa individual de saldo e aposta antes do início da rodada.
 */
export function validatePlayerBet(
  player: Player,
  draft: { mode: string; amount: string } | undefined
): { valid: boolean; error: string | null } {
  if (player.balance < 1) {
    return {
      valid: false,
      error: `Saldo insuficiente (${player.balance} balas). Mínimo de 1 bala para apostar.`,
    };
  }
  if (!draft || !draft.mode) {
    return { valid: false, error: "Selecione o modo de aposta (SUBIR, CAIR ou AUTOMÁTICO)." };
  }
  if (!MODES.includes(draft.mode as Mode)) {
    return { valid: false, error: "Modo de aposta inválido." };
  }

  const rawAmount = draft.amount.trim();
  if (!rawAmount) {
    return { valid: false, error: "Informe a quantidade de balas para apostar." };
  }
  if (!/^[0-9]+$/.test(rawAmount)) {
    return { valid: false, error: "A aposta deve ser um número inteiro, sem decimais." };
  }

  const stake = Number(rawAmount);
  if (!Number.isSafeInteger(stake) || stake < 1) {
    return { valid: false, error: "A aposta mínima é de 1 bala." };
  }
  if (stake > player.balance) {
    return {
      valid: false,
      error: `Aposta de ${formatBalas(stake)} excede o saldo disponível de ${formatBalas(player.balance)} balas.`,
    };
  }
  if (player.balance - stake < 0) {
    return { valid: false, error: "A aposta geraria saldo negativo, o que é proibido." };
  }

  return { valid: true, error: null };
}

// ============================================================================
// UTILITÁRIOS E COORDENADAS DO GRÁFICO (60FPS COM SVG & RECHARTS)
// ============================================================================

export const SVG_WIDTH = 900;
export const SVG_HEIGHT = 380;
export const PADDING_LEFT = 50;
export const PADDING_RIGHT = 35;
export const PADDING_TOP = 25;
export const PADDING_BOTTOM = 35;
export const PLOT_W = SVG_WIDTH - PADDING_LEFT - PADDING_RIGHT; // 815
export const PLOT_H = SVG_HEIGHT - PADDING_TOP - PADDING_BOTTOM; // 320

export function mapX(tMs: number): number {
  const clamped = Math.max(0, Math.min(ROUND_MS, tMs));
  return PADDING_LEFT + (clamped / ROUND_MS) * PLOT_W;
}

export function mapY(valPercent: number): number {
  const clamped = Math.max(0, Math.min(100, valPercent));
  return PADDING_TOP + PLOT_H - (clamped / 100) * PLOT_H;
}

// ============================================================================
// HOOK DE ANIMAÇÃO CUSTOMIZADO (useChartAnimation A 60FPS VIA useRef)
// ============================================================================

/**
 * Garante atualizações suaves a 60fps durante os 15 segundos da rodada,
 * manipulando diretamente as referências DOM (useRef) e evitando a
 * re-renderização completa do componente que causa travamentos.
 */
export function useChartAnimation({
  activeRoundId,
  epoch,
  phase,
  players,
  markRunning,
  settleRound,
}: {
  activeRoundId: string | null;
  epoch: number;
  phase: Phase;
  players: Player[];
  markRunning: () => void;
  settleRound: (
    directions: { playerId: string; direction: Direction }[],
    series: { playerId: string; points: { t: number; y: number }[] }[]
  ) => Promise<void> | void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const linePathRefs = useRef<Map<string, SVGPathElement>>(new Map());
  const candyGroupRefs = useRef<Map<string, SVGGElement>>(new Map());
  const candyTextRefs = useRef<Map<string, SVGTextElement>>(new Map());
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const timerTextRef = useRef<HTMLSpanElement | null>(null);
  const countdownOverlayRef = useRef<HTMLDivElement | null>(null);
  const countdownNumberRef = useRef<HTMLParagraphElement | null>(null);
  const playerPillRefs = useRef<
    Map<string, { yEl: HTMLElement; trendEl: HTMLElement }>
  >(new Map());

  const activeSimulationRef = useRef<string | null>(null);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    // A simulação de contagem (3s) e gráfico em tempo real (15s) é controlada
    // pelo ciclo de vida do activeRoundId iniciado pelo operador
    if (!activeRoundId) {
      activeSimulationRef.current = null;
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      return;
    }

    // Se já estiver rodando o loop para este activeRoundId, não reinicia
    if (activeSimulationRef.current === activeRoundId) {
      return;
    }

    activeSimulationRef.current = activeRoundId;
    const currentEpoch = epoch;
    const currentRoundId = activeRoundId;
    const playerIds = players.map((p) => p.id);
    const sims = playerIds.map(() => createLiveSimulator(Math.random));
    const startTime = performance.now();
    let finishedSettlement = false;

    // Reset visual inicial via DOM refs
    if (progressBarRef.current) {
      progressBarRef.current.style.width = "0%";
    }
    if (timerTextRef.current) {
      timerTextRef.current.textContent = "15s restantes";
    }
    if (countdownOverlayRef.current) {
      countdownOverlayRef.current.style.display = "flex";
    }
    if (countdownNumberRef.current) {
      countdownNumberRef.current.textContent = "3";
    }

    const tick = (now: number) => {
      // Guarda estrita: cancela imediatamente se houve reset manual ou mudança de epoch/rodada
      const currentSnap = useDispute.getState();
      if (
        currentSnap.epoch !== currentEpoch ||
        currentSnap.activeRoundId !== currentRoundId
      ) {
        activeSimulationRef.current = null;
        return;
      }

      const elapsed = now - startTime;

      // 1. Fase de contagem regressiva de 3 segundos
      if (elapsed < COUNTDOWN_MS) {
        const secLeft = Math.max(1, Math.ceil((COUNTDOWN_MS - elapsed) / 1000));
        if (countdownOverlayRef.current) {
          countdownOverlayRef.current.style.display = "flex";
        }
        if (
          countdownNumberRef.current &&
          countdownNumberRef.current.textContent !== String(secLeft)
        ) {
          countdownNumberRef.current.textContent = String(secLeft);
        }

        // Posiciona as balas e linhas estaticamente no instante t=0s
        for (let idx = 0; idx < playerIds.length; idx++) {
          const pid = playerIds[idx];
          const initialPts = sims[idx].visible(0);
          if (initialPts.length > 0) {
            const first = initialPts[0];
            const px = mapX(0);
            const py = mapY(first.y);
            const pathEl = linePathRefs.current.get(pid);
            if (pathEl) {
              pathEl.setAttribute("d", `M ${px.toFixed(1)} ${py.toFixed(1)}`);
            }
            const groupEl = candyGroupRefs.current.get(pid);
            if (groupEl) {
              groupEl.setAttribute(
                "transform",
                `translate(${px.toFixed(1)}, ${py.toFixed(1)})`
              );
            }
            const textEl = candyTextRefs.current.get(pid);
            if (textEl) {
              textEl.textContent = `${Math.round(first.y)}%`;
            }
            const pill = playerPillRefs.current.get(pid);
            if (pill) {
              pill.yEl.textContent = `${Math.round(first.y)}%`;
              pill.trendEl.textContent = "—";
              pill.trendEl.className = "text-muted";
            }
          }
        }
      }
      // 2. Fase de movimento dinâmico suave a 60fps durante os 15 segundos
      else {
        if (
          countdownOverlayRef.current &&
          countdownOverlayRef.current.style.display !== "none"
        ) {
          countdownOverlayRef.current.style.display = "none";
        }

        if (currentSnap.phase === "countdown") {
          markRunning();
        }

        const runDuration = Math.min(elapsed - COUNTDOWN_MS, ROUND_MS);

        // Atualização da barra de progresso e timer via DOM refs diretos
        if (progressBarRef.current) {
          const pct = Math.min(100, Math.max(0, (runDuration / ROUND_MS) * 100));
          progressBarRef.current.style.width = `${pct}%`;
        }
        if (timerTextRef.current) {
          const rem = Math.max(0, Math.ceil((ROUND_MS - runDuration) / 1000));
          timerTextRef.current.textContent = `${rem}s restantes`;
        }

        // Atualização das 5 linhas e cabeças das balas a 60fps via useRef
        const activeSeries: { playerId: string; points: { t: number; y: number }[] }[] = [];
        for (let idx = 0; idx < playerIds.length; idx++) {
          const pid = playerIds[idx];
          const pts = sims[idx].visible(runDuration);
          activeSeries.push({ playerId: pid, points: pts });

          if (pts.length > 0) {
            let d = "";
            for (let i = 0; i < pts.length; i++) {
              const px = mapX(pts[i].t);
              const py = mapY(pts[i].y);
              d += (i === 0 ? "M " : " L ") + px.toFixed(1) + " " + py.toFixed(1);
            }
            const pathEl = linePathRefs.current.get(pid);
            if (pathEl) {
              pathEl.setAttribute("d", d);
            }

            const lastPt = pts[pts.length - 1];
            const lastX = mapX(lastPt.t);
            const lastY = mapY(lastPt.y);

            const groupEl = candyGroupRefs.current.get(pid);
            if (groupEl) {
              groupEl.setAttribute(
                "transform",
                `translate(${lastX.toFixed(1)}, ${lastY.toFixed(1)})`
              );
            }

            const textEl = candyTextRefs.current.get(pid);
            if (textEl) {
              textEl.textContent = `${Math.round(lastPt.y)}%`;
            }

            const pill = playerPillRefs.current.get(pid);
            if (pill) {
              pill.yEl.textContent = `${Math.round(lastPt.y)}%`;
              const prevPt = pts.length > 1 ? pts[pts.length - 2] : lastPt;
              const trend =
                lastPt.y > prevPt.y
                  ? "up"
                  : lastPt.y < prevPt.y
                    ? "down"
                    : "flat";
              pill.trendEl.textContent =
                trend === "up" ? "▲" : trend === "down" ? "▼" : "—";
              pill.trendEl.className =
                trend === "up"
                  ? "text-win"
                  : trend === "down"
                    ? "text-loss"
                    : "text-muted";
            }
          }
        }

        // 3. Fim exato dos 15 segundos: congela as linhas e liquida a rodada
        if (runDuration >= ROUND_MS && !finishedSettlement) {
          finishedSettlement = true;
          activeSimulationRef.current = null;
          const directions = activeSeries.map((item) => ({
            playerId: item.playerId,
            direction: directionOf(item.points),
          }));

          useLive.getState().setFrame(elapsed, activeSeries);
          void settleRound(directions, activeSeries);
          return;
        }
      }

      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [activeRoundId, epoch, players, markRunning, settleRound]);

  return {
    svgRef,
    linePathRefs,
    candyGroupRefs,
    candyTextRefs,
    progressBarRef,
    timerTextRef,
    countdownOverlayRef,
    countdownNumberRef,
    playerPillRefs,
  };
}

// ============================================================================
// COMPONENTE DO GRÁFICO DINÂMICO COM RECHARTS E 60FPS VIA useRef
// ============================================================================

export function DynamicRechartsChart({
  phase,
  hoveredPlayer,
  onHoverPlayer,
  animationRefs,
}: {
  phase: Phase;
  hoveredPlayer: string | null;
  onHoverPlayer: (id: string | null) => void;
  animationRefs: ReturnType<typeof useChartAnimation>;
}) {
  const snapshot = useDispute((state) => state.chartSnapshot);
  const players = useDispute((state) => state.players);
  const moving = phase === "countdown" || phase === "running";
  const frozen = phase === "results" || phase === "final";

  // Converte a série temporal dos participantes no formato tabular do Recharts para a visualização congelada
  const chartData = useMemo(() => {
    const series = snapshot;
    if (!series || series.length === 0) {
      if (players.length === 0) {
        return [
          { t: 0, tSec: 0, isLatest: true },
          { t: 15000, tSec: 15, isLatest: false },
        ];
      }
      const initialRow: Record<string, any> = {
        t: 0,
        tSec: 0,
        isLatest: true,
      };
      players.forEach((p) => {
        initialRow[p.id] = 50;
      });
      return [initialRow];
    }

    const timestamps = new Set<number>();
    timestamps.add(0);
    series.forEach((s) => {
      s.points.forEach((pt) => timestamps.add(Math.round(pt.t)));
    });
    const sortedT = Array.from(timestamps).sort((a, b) => a - b);
    const lastIndex = sortedT.length - 1;

    return sortedT.map((t, idx) => {
      const row: Record<string, any> = {
        t,
        tSec: Number((t / 1000).toFixed(2)),
        isLatest: idx === lastIndex,
      };
      series.forEach((s) => {
        const pts = s.points;
        if (pts.length === 0) return;
        if (t <= pts[0].t) {
          row[s.playerId] = pts[0].y;
        } else if (t >= pts[pts.length - 1].t) {
          row[s.playerId] = pts[pts.length - 1].y;
        } else {
          for (let i = 0; i < pts.length - 1; i++) {
            if (t >= pts[i].t && t <= pts[i + 1].t) {
              const span = pts[i + 1].t - pts[i].t;
              const ratio = span > 0 ? (t - pts[i].t) / span : 0;
              row[s.playerId] = Math.round(pts[i].y + (pts[i + 1].y - pts[i].y) * ratio);
              break;
            }
          }
        }
      });
      return row;
    });
  }, [snapshot, players]);

  // Calcula a posição instantânea e tendência de cada bala para o estado congelado
  const latestCandyPositions = useMemo(() => {
    if (players.length === 0) return [];
    return players.map((player) => {
      const s = snapshot?.find((item) => item.playerId === player.id);
      const pts = s?.points ?? [];
      const currentY = pts.length > 0 ? pts[pts.length - 1].y : 50;
      const prevY = pts.length > 1 ? pts[pts.length - 2].y : currentY;
      const trend = currentY > prevY ? "up" : currentY < prevY ? "down" : "flat";
      return {
        id: player.id,
        name: player.name,
        colorIndex: player.colorIndex,
        y: currentY,
        trend,
      };
    });
  }, [snapshot, players]);

  // Renderizador SVG customizado da 'bala' para o Recharts
  const renderBalaHead = (props: any, player: Player) => {
    const { cx, cy, payload } = props;
    if (cx === undefined || cy === undefined || isNaN(cx) || isNaN(cy)) return null;
    if (!payload?.isLatest) return null;

    const color = PLAYER_COLORS[player.colorIndex % PLAYER_COLORS.length];
    const value = payload[player.id];
    if (value === undefined) return null;

    return (
      <g key={`bala-marker-${player.id}`} className="bala-marker pointer-events-none">
        <circle cx={cx} cy={cy} r={14} fill={color} opacity={0.35} className="animate-pulse" />
        <path
          d={`M ${cx - 13} ${cy - 5} L ${cx - 7} ${cy} L ${cx - 13} ${cy + 5} Z`}
          fill={color}
          opacity={0.9}
        />
        <path
          d={`M ${cx + 13} ${cy - 5} L ${cx + 7} ${cy} L ${cx + 13} ${cy + 5} Z`}
          fill={color}
          opacity={0.9}
        />
        <circle cx={cx} cy={cy} r={8} fill={color} stroke="#070b12" strokeWidth={2} />
        <circle cx={cx - 2.5} cy={cy - 2.5} r={2.2} fill="#ffffff" opacity={0.85} />
        <g transform={`translate(${cx}, ${cy - 16})`}>
          <rect
            x={-28}
            y={-14}
            width={56}
            height={15}
            rx={4}
            fill="#090d16"
            stroke={color}
            strokeWidth={1}
            opacity={0.95}
          />
          <text
            x={0}
            y={-3}
            textAnchor="middle"
            fill="#e7eef8"
            fontSize={9.5}
            fontWeight="bold"
            fontFamily="monospace"
          >
            {value}%
          </text>
        </g>
      </g>
    );
  };

  return (
    <section className="panel p-3 sm:p-5" aria-label="Gráfico dinâmico com Balas a 60fps">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">
            GRÁFICO DINÂMICO · 60FPS COM BALAS EM MOVIMENTO (15S)
          </h2>
          <span className="rounded bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-gold border border-line">
            ATÉ 5 LINHAS INDEPENDENTES · USE-REF
          </span>
        </div>
        {frozen ? (
          <span className="font-mono text-xs text-gold font-semibold tracking-wide">
            ● BALAS CONGELADAS NO PONTO FINAL (15S)
          </span>
        ) : moving ? (
          <span className="font-mono text-xs text-win animate-pulse font-semibold">
            ● SIMULAÇÃO SUAVE A 60FPS EM TEMPO REAL (15S)
          </span>
        ) : (
          <span className="font-mono text-xs text-muted">AGUARDANDO INÍCIO DA RODADA</span>
        )}
      </div>

      <div className="relative h-80 w-full min-w-0 md:h-[400px]">
        {/* Quando estiver em movimento (countdown / running), renderiza o SVG otimizado via useRef sem re-renders */}
        {moving ? (
          <svg
            ref={animationRefs.svgRef}
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            className="h-full w-full select-none"
            preserveAspectRatio="none"
          >
            <defs>
              <filter id="bala-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Linhas de grade e escalas de Y (0..100%) */}
            {[0, 10, 30, 50, 80, 100].map((val) => {
              const y = mapY(val);
              return (
                <g key={`y-grid-${val}`}>
                  <line
                    x1={PADDING_LEFT}
                    y1={y}
                    x2={PADDING_LEFT + PLOT_W}
                    y2={y}
                    stroke="#243044"
                    strokeDasharray="3 3"
                    opacity={0.6}
                  />
                  <text
                    x={PADDING_LEFT - 8}
                    y={y + 4}
                    textAnchor="end"
                    fill="#93a0b5"
                    fontSize={11}
                    fontFamily="sans-serif"
                  >
                    {val}%
                  </text>
                </g>
              );
            })}

            {/* Linhas de grade e escalas de X (0..15s) */}
            {[0, 3, 6, 9, 12, 15].map((sec) => {
              const x = mapX(sec * 1000);
              return (
                <g key={`x-grid-${sec}`}>
                  <line
                    x1={x}
                    y1={PADDING_TOP}
                    x2={x}
                    y2={PADDING_TOP + PLOT_H}
                    stroke="#243044"
                    strokeDasharray="3 3"
                    opacity={0.6}
                  />
                  <text
                    x={x}
                    y={SVG_HEIGHT - 12}
                    textAnchor="middle"
                    fill="#93a0b5"
                    fontSize={11}
                    fontFamily="sans-serif"
                  >
                    {sec}s
                  </text>
                </g>
              );
            })}

            {/* Eixos estáticos */}
            <line
              x1={PADDING_LEFT}
              y1={PADDING_TOP}
              x2={PADDING_LEFT}
              y2={PADDING_TOP + PLOT_H}
              stroke="#93a0b5"
              strokeWidth={1}
            />
            <line
              x1={PADDING_LEFT}
              y1={PADDING_TOP + PLOT_H}
              x2={PADDING_LEFT + PLOT_W}
              y2={PADDING_TOP + PLOT_H}
              stroke="#93a0b5"
              strokeWidth={1}
            />

            {/* 5 Linhas de dados independentes (caminhos animados via useRef a 60fps) */}
            {players.map((player) => {
              const color = PLAYER_COLORS[player.colorIndex % PLAYER_COLORS.length];
              return (
                <path
                  key={`line-${player.id}`}
                  ref={(el) => {
                    if (el) animationRefs.linePathRefs.current.set(player.id, el);
                    else animationRefs.linePathRefs.current.delete(player.id);
                  }}
                  fill="none"
                  stroke={color}
                  strokeWidth={hoveredPlayer === player.id ? 4.5 : 2.8}
                  strokeOpacity={
                    hoveredPlayer !== null && hoveredPlayer !== player.id ? 0.25 : 1
                  }
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            })}

            {/* 5 Balas nas pontas das linhas (posições atualizadas via useRef a 60fps) */}
            {players.map((player) => {
              const color = PLAYER_COLORS[player.colorIndex % PLAYER_COLORS.length];
              return (
                <g
                  key={`candy-${player.id}`}
                  ref={(el) => {
                    if (el) animationRefs.candyGroupRefs.current.set(player.id, el);
                    else animationRefs.candyGroupRefs.current.delete(player.id);
                  }}
                  className="pointer-events-none"
                  transform={`translate(${PADDING_LEFT}, ${mapY(50)})`}
                >
                  <circle cx="0" cy="0" r={14} fill={color} opacity="0.35" />
                  <path d="M -13 -5 L -7 0 L -13 5 Z" fill={color} opacity="0.9" />
                  <path d="M 13 -5 L 7 0 L 13 5 Z" fill={color} opacity="0.9" />
                  <circle cx="0" cy="0" r={8} fill={color} stroke="#070b12" strokeWidth={2} />
                  <circle cx="-2.5" cy="-2.5" r="2.2" fill="#ffffff" opacity="0.85" />
                  <g transform="translate(0, -18)">
                    <rect
                      x="-26"
                      y="-14"
                      width="52"
                      height="15"
                      rx="4"
                      fill="#090d16"
                      stroke={color}
                      strokeWidth={1}
                      opacity="0.95"
                    />
                    <text
                      ref={(el) => {
                        if (el) animationRefs.candyTextRefs.current.set(player.id, el);
                        else animationRefs.candyTextRefs.current.delete(player.id);
                      }}
                      x="0"
                      y="-3"
                      textAnchor="middle"
                      fill="#e7eef8"
                      fontSize={9.5}
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      50%
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>
        ) : (
          /* Quando estático / congelado (preparação ou resultados), renderiza o Recharts interativo */
          <ResponsiveContainer width="100%" height="100%" minHeight={320}>
            <LineChart
              data={chartData}
              margin={{ top: 25, right: 30, left: 0, bottom: 10 }}
              onMouseLeave={() => onHoverPlayer(null)}
            >
              <CartesianGrid stroke="#243044" strokeDasharray="3 3" opacity={0.6} />
              <XAxis
                dataKey="tSec"
                type="number"
                domain={[0, 15]}
                ticks={[0, 3, 6, 9, 12, 15]}
                tickFormatter={(v) => `${v}s`}
                stroke="#93a0b5"
                fontSize={11}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 10, 30, 50, 80, 100]}
                tickFormatter={(v) => `${v}%`}
                stroke="#93a0b5"
                fontSize={11}
                width={44}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#101826",
                  borderColor: "#243044",
                  borderRadius: "0.75rem",
                  color: "#e7eef8",
                  fontSize: "12px",
                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
                }}
                formatter={(value: any, name: any) => [`${value}%`, name]}
                labelFormatter={(label: any) => `Tempo: ${label}s`}
              />
              {players.map((player) => (
                <Line
                  key={player.id}
                  type="linear"
                  dataKey={player.id}
                  name={player.name}
                  stroke={PLAYER_COLORS[player.colorIndex % PLAYER_COLORS.length]}
                  strokeWidth={hoveredPlayer === player.id ? 4 : 2.5}
                  strokeOpacity={
                    hoveredPlayer !== null && hoveredPlayer !== player.id ? 0.25 : 1
                  }
                  dot={(dotProps) => renderBalaHead(dotProps, player)}
                  activeDot={{
                    r: 8,
                    fill: PLAYER_COLORS[player.colorIndex % PLAYER_COLORS.length],
                    stroke: "#070b12",
                    strokeWidth: 2,
                  }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Monitor em tempo real das posições das balas dos participantes */}
      {players.length > 0 ? (
        <div className="mt-4 rounded-xl border border-line bg-surface/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-xs font-semibold uppercase text-gold">
              Posição das Balas ao Longo da Simulação (15s a 60fps)
            </span>
            <span className="font-mono text-[11px] text-muted">
              {moving
                ? "● Atualizando suavemente a 60fps via useRef..."
                : frozen
                  ? "● Posição final congelada"
                  : "Pronto para disparar"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
            {players.map((player) => {
              const color = PLAYER_COLORS[player.colorIndex % PLAYER_COLORS.length];
              const staticPos = latestCandyPositions.find((p) => p.id === player.id);
              const initialVal = staticPos ? staticPos.y : 50;
              const initialTrend = staticPos ? staticPos.trend : "flat";

              return (
                <div
                  key={player.id}
                  className="flex items-center justify-between rounded-lg border border-line/70 bg-bg/80 px-2.5 py-1.5"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: color }}
                    />
                    <span className="truncate text-xs font-medium text-fg">{player.name}</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono text-xs font-bold">
                    <span
                      style={{ color }}
                      ref={(el) => {
                        if (el) {
                          const existing = animationRefs.playerPillRefs.current.get(player.id) ?? {
                            yEl: el,
                            trendEl: null as any,
                          };
                          existing.yEl = el;
                          animationRefs.playerPillRefs.current.set(player.id, existing);
                        }
                      }}
                    >
                      {initialVal}%
                    </span>
                    <span
                      ref={(el) => {
                        if (el) {
                          const existing = animationRefs.playerPillRefs.current.get(player.id) ?? {
                            yEl: null as any,
                            trendEl: el,
                          };
                          existing.trendEl = el;
                          animationRefs.playerPillRefs.current.set(player.id, existing);
                        }
                      }}
                      className={
                        initialTrend === "up"
                          ? "text-win"
                          : initialTrend === "down"
                            ? "text-loss"
                            : "text-muted"
                      }
                    >
                      {initialTrend === "up" ? "▲" : initialTrend === "down" ? "▼" : "—"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Legenda dos Participantes com Realce ao passar o cursor */}
      <ul className="mt-4 flex flex-wrap gap-2 pt-2 border-t border-line/60">
        {players.map((player) => (
          <li
            key={player.id}
            onMouseEnter={() => onHoverPlayer(player.id)}
            onMouseLeave={() => onHoverPlayer(null)}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line bg-surface/50 px-3 py-1 text-xs transition hover:border-gold/50"
            style={{
              opacity: hoveredPlayer && hoveredPlayer !== player.id ? 0.45 : 1,
            }}
          >
            <span
              className="size-2.5 rounded-full shadow-sm"
              style={{
                background: PLAYER_COLORS[player.colorIndex % PLAYER_COLORS.length],
              }}
            />
            <span className="font-medium text-fg">{player.name}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ============================================================================
// COMPONENTE PRINCIPAL APOSTAR VIEW (MÁQUINA DE ESTADOS DAS 3 RODADAS)
// ============================================================================

export function ApostarView() {
  const phase = useDispute((state) => state.phase);
  const players = useDispute((state) => state.players);
  const roundIndex = useDispute((state) => state.roundIndex);
  const drafts = useDispute((state) => state.drafts);
  const locked = useDispute((state) => state.locked);
  const lockedBets = useDispute((state) => state.lockedBets);
  const banner = useDispute((state) => state.banner);
  const activeRoundId = useDispute((state) => state.activeRoundId);
  const epoch = useDispute((state) => state.epoch);

  const addPlayer = useDispute((state) => state.addPlayer);
  const removePlayer = useDispute((state) => state.removePlayer);
  const beginDispute = useDispute((state) => state.beginDispute);
  const setDraft = useDispute((state) => state.setDraft);
  const startRound = useDispute((state) => state.startRound);
  const markRunning = useDispute((state) => state.markRunning);
  const settleRound = useDispute((state) => state.settleRound);

  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [hoveredPlayer, setHoveredPlayer] = useState<string | null>(null);

  // Hook de animação customizado a 60fps via useRef para eliminar re-renderizações travadas
  const animationRefs = useChartAnimation({
    activeRoundId,
    epoch,
    phase,
    players,
    markRunning,
    settleRound,
  });

  // ==========================================================================
  // VALIDAÇÃO DE SALDO PRÉ-RODADA
  // ==========================================================================
  const validationSummary = useMemo(() => {
    if (phase !== "preparing") {
      return { allValid: true, errors: {}, summary: null };
    }
    const errors: Record<string, string> = {};
    let allValid = players.length > 0;

    for (const player of players) {
      const draft = drafts[player.id];
      const result = validatePlayerBet(player, draft);
      if (!result.valid && result.error) {
        errors[player.id] = result.error;
        allValid = false;
      }
    }

    const summary = allValid
      ? null
      : "Verifique os saldos e as opções de aposta dos jogadores antes de iniciar a rodada.";

    return { allValid, errors, summary };
  }, [phase, players, drafts]);

  // ==========================================================================
  // ACIONAMENTO CONTROLADO: IMPEDE REATIVAÇÃO SEM RESET OU AVANÇO DE ESTADO
  // ==========================================================================
  const handleStartRound = () => {
    // Guarda de máquina de estados: só pode ser acionada em 'preparing' e se não passou de 3 rodadas
    if (phase !== "preparing" || roundIndex >= 3) {
      return;
    }
    // Proíbe início se a validação de saldos falhar
    if (!validationSummary.allValid) {
      return;
    }
    startRound();
  };

  // Indicador legível do estado atual da máquina de estados
  const stateStatusLabel = useMemo(() => {
    switch (phase) {
      case "registration":
        return "1/6 · CADASTRO DE PARTICIPANTES";
      case "preparing":
        return `2/6 · PREPARANDO APOSTAS (RODADA ${roundIndex + 1}/3)`;
      case "countdown":
        return `3/6 · CONTAGEM REGRESSIVA 3S (BLOQUEADO)`;
      case "running":
        return `4/6 · SIMULAÇÃO EM ANDAMENTO 15S (BLOQUEADO)`;
      case "results":
        return `5/6 · RESULTADOS APURADOS (AGUARDANDO SAIR)`;
      case "final":
        return `6/6 · DISPUTA CONCLUÍDA (AGUARDANDO RESET)`;
    }
  }, [phase, roundIndex]);

  return (
    <div className="space-y-6">
      {/* Header com máquina de estados clara */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line/60 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-mono text-xs tracking-wide text-gold font-semibold uppercase">
              MÁQUINA DE ESTADOS · BALABET
            </p>
            <span className="rounded bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-muted border border-line">
              {stateStatusLabel}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-fg sm:text-3xl">
            {phaseLabel(phase, roundIndex)}
          </h1>
        </div>
        {phase !== "registration" && phase !== "final" ? (
          <div className="rounded-lg border border-line bg-surface px-3 py-1.5 font-mono text-xs text-muted">
            Rodada <strong className="text-gold font-bold">{roundIndex + 1}</strong> de 3
          </div>
        ) : null}
      </header>

      {/* Banner de erro geral da rodada ou de validação */}
      {banner || (phase === "preparing" && validationSummary.summary) ? (
        <div
          role="alert"
          className="rounded-xl border border-loss/40 bg-loss/10 px-4 py-3 text-sm text-loss font-medium flex items-center justify-between gap-2"
        >
          <span>{banner || validationSummary.summary}</span>
          <span className="font-mono text-xs text-loss/80 uppercase">Validação Ativa</span>
        </div>
      ) : null}

      {/* ESTADO 1: CADASTRO */}
      {phase === "registration" ? (
        <section className="grid gap-6 md:grid-cols-2">
          {/* Formulário de Cadastro */}
          <form
            className="panel p-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const error = addPlayer(name, balance);
              if (error) {
                setFormError(error);
                return;
              }
              setName("");
              setBalance("");
              setFormError(null);
            }}
          >
            <h2 className="text-lg font-semibold text-fg">Cadastro de Participantes</h2>
            <p className="text-sm leading-relaxed text-muted">
              Cadastre de 1 a 5 jogadores com nome exclusivo e saldo inicial individual em balas virtuais (mínimo de 1 bala).
              Depois que a disputa for iniciada, novos participantes só poderão ser adicionados após reset.
            </p>

            <label className="block text-sm">
              <span className="font-medium text-fg">Nome do jogador</span>
              <input
                className="field mt-1"
                value={name}
                placeholder="Ex: João, Maria, Pedro"
                onChange={(event) => {
                  setName(event.target.value);
                  if (formError) setFormError(null);
                }}
                maxLength={24}
                aria-invalid={Boolean(formError)}
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium text-fg">Saldo inicial (em balas)</span>
              <input
                className="field mt-1 font-mono"
                inputMode="numeric"
                value={balance}
                onChange={(event) => {
                  setBalance(event.target.value);
                  if (formError) setFormError(null);
                }}
                placeholder="Número inteiro, mínimo 1"
              />
            </label>

            {formError ? (
              <p role="alert" className="text-sm text-loss font-medium">
                {formError}
              </p>
            ) : null}

            <button
              type="submit"
              className="btn btn-primary w-full sm:w-auto"
              data-testid="add-player"
              disabled={players.length >= 5}
            >
              Adicionar jogador ({players.length}/5)
            </button>
          </form>

          {/* Lista de Jogadores Inscritos */}
          <div className="panel p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-fg">Jogadores Cadastrados</h2>
                <span className="font-mono text-xs text-muted">{players.length}/5 participantes</span>
              </div>

              {players.length === 0 ? (
                <p className="mt-4 text-sm text-muted">
                  Nenhum jogador cadastrado ainda. Adicione pelo menos um participante para iniciar a disputa.
                </p>
              ) : (
                <ul className="mt-4 space-y-2.5">
                  {players.map((player) => (
                    <li
                      key={player.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface/50 px-3.5 py-2.5"
                    >
                      <span className="flex items-center gap-2.5">
                        <span
                          className="size-3 rounded-full shadow-sm"
                          style={{ background: colorOf(player.colorIndex) }}
                        />
                        <span className="font-medium text-fg">{player.name}</span>
                        <span className="font-mono text-xs text-gold">
                          {formatBalas(player.balance)} balas
                        </span>
                      </span>
                      <button
                        type="button"
                        className="btn btn-ghost text-xs py-1 px-2.5 min-h-[2rem]"
                        onClick={() => removePlayer(player.id)}
                      >
                        Remover
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-line">
              <button
                type="button"
                className="btn btn-primary w-full"
                data-testid="begin-dispute"
                disabled={players.length === 0}
                onClick={() => {
                  const error = beginDispute();
                  setFormError(error);
                }}
              >
                Confirmar Cadastro e Iniciar Rodada 1/3
              </button>
            </div>
          </div>
        </section>
      ) : (
        <>
          {/* Card explicativo das regras centrais de aposta e probabilidades */}
          <section className="panel p-4 bg-surface/60 border-line/80 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/50 pb-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gold">
                Lógica Central de Processamento das Apostas
              </h2>
              <span className="font-mono text-[11px] text-muted">
                3 Modos · Probabilidades Normalizadas · Pirulito Raro 5%
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 text-xs">
              <div className="rounded-lg border border-line/60 bg-bg/40 p-2.5">
                <strong className="text-fg block mb-1">Modo SUBIR</strong>
                <p className="text-muted leading-relaxed">
                  Vitória se a linha for <strong>ascendente</strong> no último segmento. Derrota se for descendente. Empate se não se mover.
                </p>
              </div>
              <div className="rounded-lg border border-line/60 bg-bg/40 p-2.5">
                <strong className="text-fg block mb-1">Modo CAIR</strong>
                <p className="text-muted leading-relaxed">
                  Vitória se a linha for <strong>descendente</strong> no último segmento. Derrota se for ascendente. Empate se não se mover.
                </p>
              </div>
              <div className="rounded-lg border border-line/60 bg-bg/40 p-2.5">
                <strong className="text-fg block mb-1">Modo AUTOMÁTICO</strong>
                <p className="text-muted leading-relaxed">
                  Vitória se a linha for <strong>ascendente</strong> no último segmento. Segue estritamente as mesmas regras e prêmios dos demais.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-muted border-t border-line/40">
              <span>
                <strong>Pesos dos Prêmios:</strong> 1 bala (35%) · 2 balas (35%) · 3 balas (16%) · 4 balas (10%) · 5 balas (4%)
              </span>
              <span className="text-gold font-medium">
                Pirulito raro: 5% de chance independente apenas em vitórias
              </span>
            </div>
          </section>

          {/* Configuração individual de apostas com validação em tempo real */}
          <section aria-label="Configuração das apostas" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">
                {locked ? "Apostas Registradas na Rodada (Bloqueadas)" : "Configuração de Apostas dos Participantes"}
              </h2>
              {phase === "preparing" ? (
                <span className="text-xs text-muted">
                  A aposta mínima é 1 bala e o máximo é o saldo disponível. O saldo não pode ficar negativo.
                </span>
              ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {players.map((player) => {
                const draft = drafts[player.id] ?? { mode: "", amount: "" };
                const bet = lockedBets[player.id];
                const shownStake = locked && bet ? bet.stake : Number(draft.amount);
                const reserved =
                  locked && bet ? Math.max(0, player.balance - bet.stake) : player.balance;
                const error = phase === "preparing" ? validationSummary.errors[player.id] : null;

                return (
                  <article key={player.id} className="panel p-4 flex flex-col justify-between">
                    <div>
                      <header className="flex items-center justify-between gap-2 border-b border-line pb-2.5">
                        <h3 className="flex items-center gap-2 font-semibold text-fg">
                          <span
                            className="size-3 rounded-full"
                            style={{ background: colorOf(player.colorIndex) }}
                          />
                          {player.name}
                        </h3>
                        <span className="font-mono text-xs text-muted">
                          {locked && bet
                            ? `Disponível: ${formatBalas(reserved)} balas`
                            : `Saldo: ${formatBalas(player.balance)} balas`}
                        </span>
                      </header>

                      {/* Seletor de Modo */}
                      <div className="mt-3">
                        <span className="text-xs text-muted block mb-1">Estratégia da Rodada:</span>
                        <div
                          className="grid grid-cols-3 gap-1"
                          role="group"
                          aria-label={`Modo de ${player.name}`}
                        >
                          {MODES.map((mode) => {
                            const selected = (locked ? bet?.mode : draft.mode) === mode;
                            return (
                              <button
                                key={mode}
                                type="button"
                                disabled={locked || phase !== "preparing"}
                                aria-pressed={selected}
                                className={`btn ${selected ? "btn-primary shadow-sm" : "btn-ghost"} px-1 text-xs`}
                                onClick={() => setDraft(player.id, { mode })}
                              >
                                {MODE_LABEL[mode]}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Quantidade apostada com validação */}
                      <label className="mt-3 block text-sm">
                        <span className="text-xs text-muted">Balas apostadas nesta rodada:</span>
                        <input
                          className="field mt-1 font-mono text-sm"
                          inputMode="numeric"
                          disabled={locked || phase !== "preparing"}
                          value={locked && bet ? String(bet.stake) : draft.amount}
                          placeholder={`De 1 até ${player.balance}`}
                          onChange={(event) =>
                            setDraft(player.id, { amount: event.target.value })
                          }
                        />
                      </label>

                      {/* Mensagem de Erro de Validação de Saldo/Aposta */}
                      {phase === "preparing" && error ? (
                        <p className="mt-2 text-xs text-loss font-medium leading-relaxed" role="alert">
                          ⚠ {error}
                        </p>
                      ) : null}

                      {locked && bet ? (
                        <div className="mt-2.5 rounded-lg border border-line bg-surface/40 px-2.5 py-1.5 font-mono text-xs text-gold">
                          Aposta bloqueada: {formatBalas(shownStake)} balas · {MODE_LABEL[bet.mode]}
                        </div>
                      ) : null}
                    </div>

                    {player.history.length > 0 ? (
                      <div className="mt-3 pt-2.5 border-t border-line/60 font-mono text-[11px] text-muted flex flex-wrap gap-1.5">
                        {player.history.map((item) => {
                          const outcomeClass =
                            item.outcome === "win"
                              ? "text-win font-semibold"
                              : item.outcome === "loss"
                                ? "text-loss"
                                : "text-gold";
                          return (
                            <span
                              key={item.round}
                              className="rounded bg-surface px-1.5 py-0.5 border border-line/50"
                            >
                              R{item.round}: <span className={outcomeClass}>{item.outcome.toUpperCase()}</span>
                            </span>
                          );
                        })}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>

          {/* Gráfico Dinâmico com Recharts e Controles de Execução a 60fps */}
          <section className="space-y-3">
            <div className="relative">
              <DynamicRechartsChart
                phase={phase}
                hoveredPlayer={hoveredPlayer}
                onHoverPlayer={setHoveredPlayer}
                animationRefs={animationRefs}
              />

              {/* Contagem regressiva em destaque (3s) controlada via useRef */}
              <div
                ref={animationRefs.countdownOverlayRef}
                style={{ display: phase === "countdown" ? "flex" : "none" }}
                className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-bg/40 backdrop-blur-[2px]"
              >
                <p
                  ref={animationRefs.countdownNumberRef}
                  className="count-pop font-mono text-8xl font-black text-gold drop-shadow-lg"
                  aria-live="assertive"
                >
                  3
                </p>
                <p className="font-mono text-sm font-semibold tracking-widest text-fg uppercase mt-2">
                  Preparando Gráfico...
                </p>
              </div>
            </div>

            {/* Barra de progresso dos 15 segundos em tempo real controlados a 60fps via useRef */}
            {phase === "countdown" || phase === "running" ? (
              <div className="space-y-1">
                <div className="flex justify-between font-mono text-xs text-muted">
                  <span>Movimento em tempo real (15s a 60fps via useRef)</span>
                  <span ref={animationRefs.timerTextRef} className="text-gold font-bold">
                    15s restantes
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                  <div
                    ref={animationRefs.progressBarRef}
                    className="h-full bg-gradient-to-r from-gold to-gold-2"
                    style={{ width: "0%" }}
                  />
                </div>
              </div>
            ) : null}

            {/* Botão de Começar Rodada com verificação de validação e bloqueio estrito */}
            {phase === "preparing" && roundIndex < 3 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <p className="text-sm text-muted">
                  Após clicar, as apostas são bloqueadas e inicia-se a contagem de 3 segundos seguida por 15 segundos de gráfico.
                </p>
                <button
                  type="button"
                  className="btn btn-primary text-base px-6 py-3 shadow-lg shadow-gold/20"
                  data-testid="start-round"
                  disabled={!validationSummary.allValid}
                  onClick={handleStartRound}
                >
                  COMEÇAR RODADA {roundIndex + 1}/3
                </button>
              </div>
            ) : phase === "countdown" || phase === "running" ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface/50 p-3 text-sm font-mono text-gold">
                <span>Rodada {roundIndex + 1}/3 em execução · Apostas bloqueadas</span>
                <span className="text-xs text-muted">Impossível reiniciar durante a simulação</span>
              </div>
            ) : null}
          </section>

          {/* Encerramento Final (Após SAIR da 3ª rodada) */}
          {phase === "final" ? (
            <section className="space-y-4">
              <div className="panel border-gold/40 p-6 bg-surface/90">
                <p className="font-mono text-xs text-gold font-bold uppercase tracking-wider">
                  DISPUTA ENCERRADA · 3/3 RODADAS
                </p>
                <h2 className="mt-1 text-2xl font-bold text-fg">
                  As três rodadas foram concluídas com sucesso!
                </h2>
                <p className="mt-2 text-sm text-muted leading-relaxed">
                  O gráfico permanece congelado no estado final da terceira rodada. Conforme as regras da BalaBet,
                  é <strong>estritamente proibido</strong> iniciar uma 4ª rodada. Para jogar novamente, utilize o botão{" "}
                  <strong>Resetar todos os dados</strong> para reiniciar a máquina de estados.
                </p>
              </div>
              <RankingTable final={true} />
            </section>
          ) : null}

          {/* Tabela de Estatísticas */}
          <StatsTable />
        </>
      )}

      {/* Modal de Resultados (permanece até o clique em SAIR) */}
      <ResultsPanel />
    </div>
  );
}
