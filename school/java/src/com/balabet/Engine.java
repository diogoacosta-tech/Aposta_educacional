package com.balabet;

/**
 * Regras de liquidação da BalaBet. Única implementação Java dos prêmios,
 * do pirulito e dos saldos. Não conhece o gráfico: recebe a direção já
 * observada no último segmento visível.
 */
public final class Engine {
    public static final int[] PRIZE_WEIGHTS = {35, 35, 16, 10, 4};
    public static final int PRIZE_TOTAL = 100;

    private Engine() {}

    public enum Mode {
        SUBIR,
        CAIR,
        AUTOMATICO
    }

    public enum Direction {
        UP,
        DOWN,
        FLAT
    }

    public enum Outcome {
        WIN,
        LOSS,
        TIE
    }

    public static final class Settlement {
        public final Outcome outcome;
        public final int prize;
        public final boolean lollipop;
        public final long balanceAfter;
        public final long displayedDelta;
        public final long stake;
        public final int prizeRoll;
        public final int lollipopRoll;

        public Settlement(
                Outcome outcome,
                int prize,
                boolean lollipop,
                long balanceAfter,
                long displayedDelta,
                long stake,
                int prizeRoll,
                int lollipopRoll) {
            this.outcome = outcome;
            this.prize = prize;
            this.lollipop = lollipop;
            this.balanceAfter = balanceAfter;
            this.displayedDelta = displayedDelta;
            this.stake = stake;
            this.prizeRoll = prizeRoll;
            this.lollipopRoll = lollipopRoll;
        }
    }

    public static Mode parseMode(String raw) {
        if (raw == null) {
            throw new IllegalArgumentException("modo ausente");
        }
        switch (raw.trim().toLowerCase()) {
            case "subir":
                return Mode.SUBIR;
            case "cair":
                return Mode.CAIR;
            case "automatico":
                return Mode.AUTOMATICO;
            default:
                throw new IllegalArgumentException("modo inválido");
        }
    }

    public static Direction parseDirection(String raw) {
        if (raw == null) {
            throw new IllegalArgumentException("direção ausente");
        }
        switch (raw.trim().toLowerCase()) {
            case "up":
                return Direction.UP;
            case "down":
                return Direction.DOWN;
            case "flat":
                return Direction.FLAT;
            default:
                throw new IllegalArgumentException("direção inválida");
        }
    }

    public static String modeToken(Mode mode) {
        switch (mode) {
            case SUBIR:
                return "subir";
            case CAIR:
                return "cair";
            default:
                return "automatico";
        }
    }

    public static String outcomeToken(Outcome outcome) {
        switch (outcome) {
            case WIN:
                return "win";
            case LOSS:
                return "loss";
            default:
                return "tie";
        }
    }

    /** Rolagem inteira em [0, 95). */
    public static int prizeFromRoll(int roll) {
        if (roll < 0 || roll >= PRIZE_TOTAL) {
            throw new IllegalArgumentException("rolagem de prêmio fora de 0..94");
        }
        int acc = 0;
        for (int i = 0; i < PRIZE_WEIGHTS.length; i++) {
            acc += PRIZE_WEIGHTS[i];
            if (roll < acc) {
                return i + 1;
            }
        }
        throw new IllegalStateException("tabela de prêmios inconsistente");
    }

    /** Rolagem inteira em [0, 100). Pirulito nos cinco primeiros valores. */
    public static boolean lollipopFromRoll(int roll) {
        if (roll < 0 || roll >= 100) {
            throw new IllegalArgumentException("rolagem de pirulito fora de 0..99");
        }
        return roll < 5;
    }

    public static Outcome outcome(Mode mode, Direction direction) {
        if (direction == Direction.FLAT) {
            return Outcome.TIE;
        }
        if (mode == Mode.SUBIR) {
            return direction == Direction.UP ? Outcome.WIN : Outcome.LOSS;
        }
        if (mode == Mode.CAIR) {
            return direction == Direction.DOWN ? Outcome.WIN : Outcome.LOSS;
        }
        return direction == Direction.UP ? Outcome.WIN : Outcome.LOSS;
    }

    public static Settlement settle(
            long balance,
            long stake,
            Mode mode,
            Direction direction,
            int prizeRoll,
            int lollipopRoll) {
        if (balance < 0) {
            throw new IllegalArgumentException("saldo negativo");
        }
        if (stake < 1) {
            throw new IllegalArgumentException("aposta mínima é 1");
        }
        if (stake > balance) {
            throw new IllegalArgumentException("aposta acima do saldo");
        }
        Outcome result = outcome(mode, direction);
        if (result == Outcome.LOSS) {
            long after = balance - stake;
            return new Settlement(result, 0, false, after, -stake, stake, prizeRoll, lollipopRoll);
        }
        if (result == Outcome.TIE) {
            return new Settlement(result, 0, false, balance, 0, stake, prizeRoll, lollipopRoll);
        }
        int prize = prizeFromRoll(prizeRoll);
        boolean lollipop = lollipopFromRoll(lollipopRoll);
        return new Settlement(result, prize, lollipop, balance + prize, prize, stake, prizeRoll, lollipopRoll);
    }
}
