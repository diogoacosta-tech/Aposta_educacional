export const PRIZE_WEIGHTS = [28, 28, 22, 11, 6] as const;
export const PRIZE_TOTAL = 95;
export const MAX_PLAYERS = 5;
export const ROUND_MS = 15_000;
export const COUNTDOWN_MS = 3_000;
export const ROUND_LIMIT = 3;

export type Mode = "subir" | "cair" | "automatico";
export type Direction = "up" | "down" | "flat";
export type Outcome = "win" | "loss" | "tie";

export type Settlement = {
  outcome: Outcome;
  prize: number;
  lollipop: boolean;
  balanceAfter: number;
  displayedDelta: number;
  stake: number;
  prizeRoll: number;
  lollipopRoll: number;
};

const MODES: Mode[] = ["subir", "cair", "automatico"];

export function prizeFromRoll(roll: number): number {
  if (!Number.isInteger(roll) || roll < 0 || roll >= PRIZE_TOTAL) {
    throw new Error("Rolagem de prêmio fora de 0..94.");
  }
  let acc = 0;
  for (let i = 0; i < PRIZE_WEIGHTS.length; i++) {
    acc += PRIZE_WEIGHTS[i];
    if (roll < acc) return i + 1;
  }
  throw new Error("Tabela de prêmios inconsistente.");
}

export function lollipopFromRoll(roll: number): boolean {
  if (!Number.isInteger(roll) || roll < 0 || roll >= 100) {
    throw new Error("Rolagem de pirulito fora de 0..99.");
  }
  return roll < 5;
}

export function outcomeOf(mode: Mode, direction: Direction): Outcome {
  if (direction === "flat") return "tie";
  if (mode === "subir") return direction === "up" ? "win" : "loss";
  if (mode === "cair") return direction === "down" ? "win" : "loss";
  return direction === "up" ? "win" : "loss";
}

export function settle(input: {
  balance: number;
  stake: number;
  mode: Mode;
  direction: Direction;
  prizeRoll: number;
  lollipopRoll: number;
}): Settlement {
  const { balance, stake, mode, direction, prizeRoll, lollipopRoll } = input;
  if (!Number.isSafeInteger(balance) || balance < 0) {
    throw new Error("Saldo inválido.");
  }
  if (!Number.isSafeInteger(stake) || stake < 1) {
    throw new Error("A aposta mínima é 1 bala.");
  }
  if (stake > balance) {
    throw new Error("A aposta não pode passar do saldo disponível.");
  }
  if (!MODES.includes(mode)) throw new Error("Modo inválido.");
  const outcome = outcomeOf(mode, direction);
  if (outcome === "loss") {
    return {
      outcome,
      prize: 0,
      lollipop: false,
      balanceAfter: balance - stake,
      displayedDelta: -stake,
      stake,
      prizeRoll,
      lollipopRoll,
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
      prizeRoll,
      lollipopRoll,
    };
  }
  const prize = prizeFromRoll(prizeRoll);
  return {
    outcome,
    prize,
    lollipop: lollipopFromRoll(lollipopRoll),
    balanceAfter: balance + prize,
    displayedDelta: prize,
    stake,
    prizeRoll,
    lollipopRoll,
  };
}

export function randomRoll(span: number): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] % span;
}

export function settleLocal(input: {
  balance: number;
  stake: number;
  mode: Mode;
  direction: Direction;
  prizeRoll?: number;
  lollipopRoll?: number;
}): Settlement {
  return settle({
    ...input,
    prizeRoll: input.prizeRoll ?? randomRoll(PRIZE_TOTAL),
    lollipopRoll: input.lollipopRoll ?? randomRoll(100),
  });
}

export function successRatio(wins: number, losses: number): number | null {
  const decided = wins + losses;
  if (decided <= 0) return null;
  return (wins / decided) * 100;
}

export function formatPercent(value: number | null): string {
  if (value === null) return "—";
  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

export function formatBalas(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function nameKey(name: string): string {
  return normalizeName(name).toLocaleLowerCase("pt-BR");
}

export function validateNewPlayer(
  name: string,
  balanceRaw: string,
  existingNames: string[],
  existingCount: number,
): { name: string; balance: number } | { error: string } {
  if (existingCount >= MAX_PLAYERS) {
    return { error: "O limite é de cinco jogadores por disputa." };
  }
  const clean = normalizeName(name);
  if (!clean) return { error: "Informe um nome." };
  if (clean.length > 24) return { error: "Use um nome de até 24 caracteres." };
  const key = nameKey(clean);
  if (existingNames.some((item) => nameKey(item) === key)) {
    return { error: "Esse nome já está na disputa." };
  }
  const balance = parsePositiveInt(balanceRaw);
  if (balance === null || balance < 1) {
    return { error: "O saldo inicial precisa ser um inteiro de pelo menos 1 bala." };
  }
  return { name: clean, balance };
}

export function parsePositiveInt(raw: string): number | null {
  const text = raw.trim();
  if (!/^[0-9]+$/.test(text)) return null;
  const value = Number(text);
  if (!Number.isSafeInteger(value)) return null;
  return value;
}

export function stakeError(raw: string, balance: number): string | null {
  const text = raw.trim();
  if (!text) return "Informe quantas balas apostar.";
  if (!/^[0-9]+$/.test(text)) return "Use somente um número inteiro, sem decimais.";
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value < 1) return "A aposta mínima é 1 bala.";
  if (value > balance) return `Saldo insuficiente. O máximo é ${formatBalas(balance)}.`;
  return null;
}

export type Ranked = {
  id: string;
  name: string;
  wins: number;
  losses: number;
  percent: number | null;
  rank: number;
  tied: boolean;
};

export function rankPlayers(
  players: { id: string; name: string; wins: number; losses: number }[],
): Ranked[] {
  const ordered = players.map((player, index) => ({
    ...player,
    percent: successRatio(player.wins, player.losses),
    index,
  }));
  ordered.sort((a, b) => {
    if (a.percent === null && b.percent === null) return a.index - b.index;
    if (a.percent === null) return 1;
    if (b.percent === null) return -1;
    if (a.percent !== b.percent) return b.percent - a.percent;
    return a.index - b.index;
  });
  return ordered.map((player, index) => {
    let rank = index + 1;
    if (index > 0) {
      const prev = ordered[index - 1];
      const same =
        prev.percent === player.percent ||
        (prev.percent === null && player.percent === null);
      if (same) {
        rank = findRank(ordered, index);
      }
    }
    const next = ordered[index + 1];
    const tied =
      (index > 0 &&
        ordered[index - 1].percent === player.percent) ||
      (next !== undefined && next.percent === player.percent);
    return {
      id: player.id,
      name: player.name,
      wins: player.wins,
      losses: player.losses,
      percent: player.percent,
      rank,
      tied,
    };
  });
}

function findRank(
  ordered: { percent: number | null }[],
  index: number,
): number {
  const percent = ordered[index].percent;
  let cursor = index;
  while (cursor > 0 && ordered[cursor - 1].percent === percent) cursor -= 1;
  return cursor + 1;
}

export function directionOf(points: { y: number }[]): Direction {
  if (points.length < 2) return "flat";
  const previous = points[points.length - 2].y;
  const last = points[points.length - 1].y;
  if (last > previous) return "up";
  if (last < previous) return "down";
  return "flat";
}

export const MODE_LABEL: Record<Mode, string> = {
  subir: "SUBIR",
  cair: "CAIR",
  automatico: "AUTOMÁTICO",
};

export const DIRECTION_LABEL: Record<Direction, string> = {
  up: "subiu",
  down: "caiu",
  flat: "não se moveu",
};
