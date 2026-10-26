package com.balabet;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Protocolo em linhas, consumido pelo PHP.
 *
 * stdin:
 *   N
 *   id balance stake mode direction prizeRoll lollipopRoll
 * prizeRoll/lollipopRoll = -1 sorteia aqui.
 *
 * stdout:
 *   OK
 *   id outcome prize lollipop balanceAfter displayedDelta stake prizeRoll lollipopRoll
 * ou:
 *   ERR mensagem
 */
public final class Main {
    private Main() {}

    public static void main(String[] args) {
        try {
            if (args.length > 0 && "selftest".equals(args[0])) {
                selfTest();
                return;
            }
            if (args.length >= 2 && "map".equals(args[0])) {
                System.out.println(Engine.prizeFromRoll(Integer.parseInt(args[1])));
                return;
            }
            if (args.length >= 2 && "lollipop".equals(args[0])) {
                System.out.println(Engine.lollipopFromRoll(Integer.parseInt(args[1])) ? "1" : "0");
                return;
            }
            BufferedReader reader =
                    new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
            String header = reader.readLine();
            if (header == null) {
                fail("entrada vazia");
                return;
            }
            int n = Integer.parseInt(header.trim());
            if (n < 1 || n > 5) {
                fail("quantidade de jogadores inválida");
                return;
            }
            StringBuilder out = new StringBuilder();
            out.append("OK\n");
            for (int i = 0; i < n; i++) {
                String line = reader.readLine();
                if (line == null) {
                    fail("faltam jogadores");
                    return;
                }
                String[] parts = line.trim().split(" ");
                if (parts.length != 7) {
                    fail("linha de aposta inválida");
                    return;
                }
                String id = parts[0];
                if (!id.matches("[A-Za-z0-9_-]{1,64}")) {
                    fail("identificador inválido");
                    return;
                }
                long balance = Long.parseLong(parts[1]);
                long stake = Long.parseLong(parts[2]);
                Engine.Mode mode = Engine.parseMode(parts[3]);
                Engine.Direction direction = Engine.parseDirection(parts[4]);
                int prizeRoll = Integer.parseInt(parts[5]);
                int lollipopRoll = Integer.parseInt(parts[6]);
                if (prizeRoll < 0) {
                    prizeRoll = ThreadLocalRandom.current().nextInt(Engine.PRIZE_TOTAL);
                }
                if (lollipopRoll < 0) {
                    lollipopRoll = ThreadLocalRandom.current().nextInt(100);
                }
                Engine.Settlement settlement =
                        Engine.settle(balance, stake, mode, direction, prizeRoll, lollipopRoll);
                out.append(id)
                        .append(' ')
                        .append(Engine.outcomeToken(settlement.outcome))
                        .append(' ')
                        .append(settlement.prize)
                        .append(' ')
                        .append(settlement.lollipop ? '1' : '0')
                        .append(' ')
                        .append(settlement.balanceAfter)
                        .append(' ')
                        .append(settlement.displayedDelta)
                        .append(' ')
                        .append(settlement.stake)
                        .append(' ')
                        .append(settlement.prizeRoll)
                        .append(' ')
                        .append(settlement.lollipopRoll)
                        .append('\n');
            }
            System.out.print(out);
        } catch (IllegalArgumentException ex) {
            fail(ex.getMessage() == null ? "dados inválidos" : ex.getMessage());
        } catch (Exception ex) {
            fail("falha interna");
        }
    }

    private static void fail(String message) {
        System.out.println("ERR " + message.replace('\n', ' '));
        System.exit(2);
    }

    private static void selfTest() {
        int[] counts = new int[6];
        for (int roll = 0; roll < 95; roll++) {
            counts[Engine.prizeFromRoll(roll)]++;
        }
        expect(counts[1] == 35, "peso 1");
        expect(counts[2] == 35, "peso 2");
        expect(counts[3] == 16, "peso 3");
        expect(counts[4] == 10, "peso 4");
        expect(counts[5] == 4, "peso 5");
        expect(Engine.prizeFromRoll(56) == 3, "prêmio 3 no exemplo");
        for (int roll = 0; roll < 100; roll++) {
            expect(Engine.lollipopFromRoll(roll) == (roll < 5), "pirulito " + roll);
        }
        Engine.Settlement win =
                Engine.settle(2, 1, Engine.Mode.SUBIR, Engine.Direction.UP, 56, 0);
        expect(win.outcome == Engine.Outcome.WIN, "vitória");
        expect(win.prize == 3, "prêmio adicional 3");
        expect(win.lollipop, "pirulito na vitória");
        expect(win.balanceAfter == 5, "saldo 2+3");
        expect(win.displayedDelta == 3, "delta anunciado é o prêmio");

        Engine.Settlement loss =
                Engine.settle(10, 1, Engine.Mode.SUBIR, Engine.Direction.DOWN, 0, 0);
        expect(loss.outcome == Engine.Outcome.LOSS, "derrota");
        expect(loss.balanceAfter == 9, "10-1");
        expect(!loss.lollipop, "sem pirulito na derrota");
        expect(loss.prize == 0, "sem prêmio na derrota");

        Engine.Settlement bust =
                Engine.settle(2, 2, Engine.Mode.CAIR, Engine.Direction.UP, 0, 0);
        expect(bust.balanceAfter == 0, "saldo zerado");
        expect(!bust.lollipop, "sem pirulito ao zerar");

        Engine.Settlement tie =
                Engine.settle(8, 3, Engine.Mode.AUTOMATICO, Engine.Direction.FLAT, 0, 0);
        expect(tie.outcome == Engine.Outcome.TIE, "empate");
        expect(tie.balanceAfter == 8, "aposta devolvida");
        expect(!tie.lollipop && tie.prize == 0, "empate sem brinde");

        Engine.Settlement auto =
                Engine.settle(4, 1, Engine.Mode.AUTOMATICO, Engine.Direction.UP, 0, 99);
        expect(auto.outcome == Engine.Outcome.WIN && auto.prize == 1 && !auto.lollipop, "automático");

        boolean threw = false;
        try {
            Engine.settle(3, 4, Engine.Mode.SUBIR, Engine.Direction.UP, 0, 0);
        } catch (IllegalArgumentException ex) {
            threw = true;
        }
        expect(threw, "recusa aposta acima do saldo");
        System.out.println("PASS");
    }

    private static void expect(boolean condition, String label) {
        if (!condition) {
            System.out.println("FAIL " + label);
            System.exit(1);
        }
    }
}
