import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  type Direction,
  type Mode,
  type Outcome,
  settle,
  settleLocal,
  validateNewPlayer,
} from "./engine";
import { settleUrl } from "./api";
import { useLive, type ChartSeries } from "./live";

export type Phase =
  | "registration"
  | "preparing"
  | "countdown"
  | "running"
  | "results"
  | "final";

export type HistoryEntry = {
  round: number;
  mode: Mode;
  stake: number;
  direction: Direction;
  outcome: Outcome;
  prize: number;
  lollipop: boolean;
  balanceAfter: number;
};

export type Player = {
  id: string;
  name: string;
  colorIndex: number;
  initialBalance: number;
  balance: number;
  wins: number;
  losses: number;
  ties: number;
  history: HistoryEntry[];
};

export type Draft = { mode: Mode | ""; amount: string };
export type LockedBet = { mode: Mode; stake: number };

export type ResultCard = {
  playerId: string;
  name: string;
  colorIndex: number;
  mode: Mode;
  direction: Direction;
  outcome: Outcome;
  stake: number;
  prize: number;
  lollipop: boolean;
  displayedDelta: number;
  balanceAfter: number;
};

type DisputeState = {
  epoch: number;
  phase: Phase;
  roundIndex: number;
  players: Player[];
  drafts: Record<string, Draft>;
  locked: boolean;
  lockedBets: Record<string, LockedBet>;
  activeRoundId: string | null;
  settledApplied: string | null;
  chartSnapshot: ChartSeries[] | null;
  roundView: { round: number; cards: ResultCard[] } | null;
  banner: string | null;
  resetOpen: boolean;
  addPlayer: (name: string, balanceRaw: string) => string | null;
  removePlayer: (id: string) => void;
  beginDispute: () => string | null;
  setDraft: (id: string, patch: Partial<Draft>) => void;
  startRound: () => string | null;
  markRunning: () => void;
  settleRound: (
    directions: { playerId: string; direction: Direction }[],
    chart: ChartSeries[],
  ) => Promise<void>;
  exitResults: () => void;
  requestReset: () => void;
  cancelReset: () => void;
  confirmReset: () => void;
  clearBanner: () => void;
};

function blankState() {
  return {
    epoch: 0,
    phase: "registration" as Phase,
    roundIndex: 0,
    players: [] as Player[],
    drafts: {} as Record<string, Draft>,
    locked: false,
    lockedBets: {} as Record<string, LockedBet>,
    activeRoundId: null as string | null,
    settledApplied: null as string | null,
    chartSnapshot: null as ChartSeries[] | null,
    roundView: null as DisputeState["roundView"],
    banner: null as string | null,
    resetOpen: false,
  };
}

type ServerRow = {
  id: string;
  outcome: Outcome;
  prize: number;
  lollipop: boolean;
  balanceAfter: number;
  displayedDelta: number;
  stake: number;
  prizeRoll: number;
  lollipopRoll: number;
};

let settleLock: string | null = null;

function freshDrafts(players: Player[], previous?: Record<string, LockedBet>): Record<string, Draft> {
  const drafts: Record<string, Draft> = {};
  for (const player of players) {
    const prior = previous?.[player.id];
    const amount =
      prior && player.balance >= 1 ? String(Math.min(prior.stake, player.balance)) : "";
    drafts[player.id] = {
      mode: prior?.mode ?? "",
      amount: player.balance >= 1 ? amount : "",
    };
  }
  return drafts;
}

export const useDispute = create<DisputeState>()(
  persist(
    (set, get) => ({
      ...blankState(),
      clearBanner: () => set({ banner: null }),
      addPlayer: (name, balanceRaw) => {
        const state = get();
        if (state.phase !== "registration") {
          return "Os jogadores não podem mudar depois que a disputa começa.";
        }
        const result = validateNewPlayer(
          name,
          balanceRaw,
          state.players.map((player) => player.name),
          state.players.length,
        );
        if ("error" in result) return result.error;
        const player: Player = {
          id: crypto.randomUUID().replace(/-/g, "").slice(0, 16),
          name: result.name,
          colorIndex: state.players.length,
          initialBalance: result.balance,
          balance: result.balance,
          wins: 0,
          losses: 0,
          ties: 0,
          history: [],
        };
        set({
          players: [...state.players, player],
          banner: null,
        });
        return null;
      },
      removePlayer: (id) => {
        const state = get();
        if (state.phase !== "registration") return;
        set({
          players: state.players
            .filter((player) => player.id !== id)
            .map((player, index) => ({ ...player, colorIndex: index })),
        });
      },
      beginDispute: () => {
        const state = get();
        if (state.phase !== "registration") return "A disputa já começou.";
        if (state.players.length < 1) return "Cadastre pelo menos um jogador.";
        set({
          phase: "preparing",
          roundIndex: 0,
          drafts: freshDrafts(state.players),
          lockedBets: {},
          banner: null,
          chartSnapshot: null,
          roundView: null,
        });
        useLive.getState().clear();
        return null;
      },
      setDraft: (id, patch) => {
        const state = get();
        if (state.phase !== "preparing" || state.locked) return;
        const current = state.drafts[id] ?? { mode: "", amount: "" };
        set({
          drafts: { ...state.drafts, [id]: { ...current, ...patch } },
          banner: null,
        });
      },
      startRound: () => {
        const state = get();
        const reject = (message: string) => {
          set({ banner: message });
          return message;
        };
        if (state.phase !== "preparing") return reject("A rodada não está em preparação.");
        if (state.roundIndex > 2) return reject("A disputa já teve as três rodadas.");
        const lockedBets: Record<string, LockedBet> = {};
        for (const player of state.players) {
          const draft = state.drafts[player.id];
          if (!draft || (draft.mode !== "subir" && draft.mode !== "cair" && draft.mode !== "automatico")) {
            return reject(`${player.name} ainda precisa escolher SUBIR, CAIR ou AUTOMÁTICO.`);
          }
          const text = draft.amount.trim();
          if (!/^[0-9]+$/.test(text)) {
            return reject(`${player.name}: informe um inteiro de balas.`);
          }
          const stake = Number(text);
          if (!Number.isSafeInteger(stake) || stake < 1) {
            return reject(`${player.name}: a aposta mínima é 1 bala.`);
          }
          if (stake > player.balance) {
            return reject(`${player.name} não tem saldo para essa aposta.`);
          }
          lockedBets[player.id] = { mode: draft.mode, stake };
        }
        useLive.getState().clear();
        set({
          phase: "countdown",
          locked: true,
          lockedBets,
          activeRoundId: crypto.randomUUID().replace(/-/g, "").slice(0, 16),
          settledApplied: null,
          chartSnapshot: null,
          roundView: null,
          banner: null,
        });
        return null;
      },
      markRunning: () => {
        if (get().phase === "countdown") set({ phase: "running" });
      },
      settleRound: async (directions, chart) => {
        const state = get();
        const roundId = state.activeRoundId;
        if (!roundId) return;
        if (state.phase !== "running" && state.phase !== "countdown") return;
        if (state.settledApplied === roundId || settleLock === roundId) return;
        settleLock = roundId;
        const epoch = state.epoch;
        const roundNumber = state.roundIndex + 1;
        const payload = {
          roundId,
          players: state.players.map((player) => {
            const bet = state.lockedBets[player.id];
            const direction =
              directions.find((item) => item.playerId === player.id)?.direction ?? "flat";
            return {
              id: player.id,
              balance: player.balance,
              stake: bet.stake,
              mode: bet.mode,
              direction,
            };
          }),
        };
        let rows: ServerRow[] | null = null;
        try {
          const response = await fetch(settleUrl(), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          });
          const body = (await response.json()) as {
            ok?: boolean;
            code?: string;
            error?: string;
            results?: ServerRow[];
          };
          if (body.ok && body.results) {
            rows = body.results;
          } else if (body.code === "validation") {
            if (get().epoch === epoch && get().activeRoundId === roundId) {
              set({
                phase: "preparing",
                locked: false,
                activeRoundId: null,
                banner: body.error ?? "A rodada foi recusada.",
              });
              useLive.getState().clear();
            }
            settleLock = null;
            return;
          }
        } catch {
          rows = null;
        }
        const current = get();
        if (current.epoch !== epoch || current.activeRoundId !== roundId) {
          settleLock = null;
          return;
        }
        if (current.settledApplied === roundId) {
          settleLock = null;
          return;
        }
        const byId = new Map(rows?.map((row) => [row.id, row]) ?? []);
        const cards: ResultCard[] = [];
        const players = current.players.map((player) => {
          const bet = current.lockedBets[player.id];
          const direction =
            directions.find((item) => item.playerId === player.id)?.direction ?? "flat";
          const remote = byId.get(player.id);
          let settled;
          try {
            if (
              remote &&
              (remote.outcome === "win" || remote.outcome === "loss" || remote.outcome === "tie")
            ) {
              const checked = settle({
                balance: player.balance,
                stake: bet.stake,
                mode: bet.mode,
                direction,
                prizeRoll: remote.prizeRoll,
                lollipopRoll: remote.lollipopRoll,
              });
              const agrees =
                checked.outcome === remote.outcome &&
                checked.prize === remote.prize &&
                checked.lollipop === remote.lollipop &&
                checked.balanceAfter === remote.balanceAfter;
              settled = agrees
                ? checked
                : settleLocal({
                    balance: player.balance,
                    stake: bet.stake,
                    mode: bet.mode,
                    direction,
                  });
            } else {
              settled = settleLocal({
                balance: player.balance,
                stake: bet.stake,
                mode: bet.mode,
                direction,
              });
            }
          } catch {
            settled = settleLocal({
              balance: player.balance,
              stake: bet.stake,
              mode: bet.mode,
              direction,
            });
          }
          const next = {
            ...player,
            balance: settled.balanceAfter,
            wins: player.wins + (settled.outcome === "win" ? 1 : 0),
            losses: player.losses + (settled.outcome === "loss" ? 1 : 0),
            ties: player.ties + (settled.outcome === "tie" ? 1 : 0),
            history: [
              ...player.history,
              {
                round: roundNumber,
                mode: bet.mode,
                stake: bet.stake,
                direction,
                outcome: settled.outcome,
                prize: settled.prize,
                lollipop: settled.lollipop,
                balanceAfter: settled.balanceAfter,
              },
            ],
          };
          cards.push({
            playerId: player.id,
            name: player.name,
            colorIndex: player.colorIndex,
            mode: bet.mode,
            direction,
            outcome: settled.outcome,
            stake: bet.stake,
            prize: settled.prize,
            lollipop: settled.lollipop,
            displayedDelta: settled.displayedDelta,
            balanceAfter: settled.balanceAfter,
          });
          return next;
        });
        if (get().epoch !== epoch || get().activeRoundId !== roundId || get().settledApplied === roundId) {
          settleLock = null;
          return;
        }
        set({
          players,
          phase: "results",
          settledApplied: roundId,
          chartSnapshot: chart,
          roundView: { round: roundNumber, cards },
          locked: true,
        });
        settleLock = null;
      },
      exitResults: () => {
        const state = get();
        if (state.phase !== "results") return;
        if (state.roundIndex >= 2) {
          set({ phase: "final", locked: true, roundView: null });
          return;
        }
        set({
          phase: "preparing",
          roundIndex: state.roundIndex + 1,
          locked: false,
          drafts: freshDrafts(state.players, state.lockedBets),
          activeRoundId: null,
          roundView: null,
          chartSnapshot: null,
          banner: null,
        });
        useLive.getState().clear();
      },
      requestReset: () => set({ resetOpen: true }),
      cancelReset: () => set({ resetOpen: false }),
      confirmReset: () => {
        settleLock = null;
        useLive.getState().clear();
        set({
          ...blankState(),
          epoch: get().epoch + 1,
          resetOpen: false,
        });
      },
    }),
    {
      name: "balabet-dispute-v1",
      skipHydration: true,
      partialize: (state) => ({
        epoch: state.epoch,
        phase: state.phase,
        roundIndex: state.roundIndex,
        players: state.players,
        drafts: state.drafts,
        locked: state.locked,
        lockedBets: state.lockedBets,
        activeRoundId: state.activeRoundId,
        settledApplied: state.settledApplied,
        chartSnapshot: state.chartSnapshot,
        roundView: state.roundView,
        banner: state.banner,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (state.phase === "countdown" || state.phase === "running") {
          useDispute.setState({
            phase: "preparing",
            locked: false,
            activeRoundId: null,
            chartSnapshot: null,
            roundView: null,
          });
          useLive.getState().clear();
        }
      },
    },
  ),
);

export function phaseLabel(phase: Phase, roundIndex: number): string {
  const n = Math.min(roundIndex + 1, 3);
  switch (phase) {
    case "registration":
      return "CADASTRO";
    case "preparing":
      return `PREPARANDO RODADA ${n}/3`;
    case "countdown":
      return `RODADA ${n}/3 — CONTAGEM`;
    case "running":
      return `RODADA ${n}/3 EM ANDAMENTO`;
    case "results":
      return `RESULTADOS DA RODADA ${n}/3`;
    case "final":
      return "DISPUTA FINALIZADA";
  }
}
