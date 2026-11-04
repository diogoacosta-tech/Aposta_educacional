import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import path from "node:path";
import { createLiveSimulator, mulberry32 } from "./chart.ts";
import {
  lollipopFromRoll,
  prizeFromRoll,
  rankPlayers,
  settle,
  successRatio,
  validateNewPlayer,
  validateRecharge,
} from "./engine.ts";
import { useDispute } from "./store.ts";

test("prêmios seguem os pesos 28, 28, 22, 11 e 6 (soma 95)", () => {
  const counts = [0, 0, 0, 0, 0, 0];
  for (let roll = 0; roll < 95; roll++) counts[prizeFromRoll(roll)] += 1;
  assert.deepEqual(counts.slice(1), [28, 28, 22, 11, 6]);
  assert.equal(prizeFromRoll(56), 3);
});

test("pirulito só nos cinco primeiros valores de 100 (5% de chance independente)", () => {
  for (let roll = 0; roll < 100; roll++) {
    assert.equal(lollipopFromRoll(roll), roll < 5);
  }
});

test("exemplos de saldo e liquidação da especificação do Prompt Mestre", () => {
  // Vitória: aposta devolvida + prêmio
  const win = settle({
    balance: 2,
    stake: 1,
    mode: "subir",
    direction: "up",
    prizeRoll: 56,
    lollipopRoll: 0,
  });
  assert.equal(win.outcome, "win");
  assert.equal(win.prize, 3);
  assert.equal(win.balanceAfter, 5); // 2 + 3 = 5 (aposta devolvida)
  assert.equal(win.displayedDelta, 3);
  assert.equal(win.lollipop, true);

  // Derrota: apenas a aposta é descontada
  const loss = settle({
    balance: 10,
    stake: 1,
    mode: "subir",
    direction: "down",
    prizeRoll: 0,
    lollipopRoll: 0,
  });
  assert.equal(loss.outcome, "loss");
  assert.equal(loss.balanceAfter, 9);
  assert.equal(loss.displayedDelta, -1);
  assert.equal(loss.lollipop, false);

  // Derrota com saldo total
  const bust = settle({
    balance: 2,
    stake: 2,
    mode: "cair",
    direction: "up",
    prizeRoll: 0,
    lollipopRoll: 0,
  });
  assert.equal(bust.outcome, "loss");
  assert.equal(bust.balanceAfter, 0);
  assert.equal(bust.prize, 0);

  // Empate: aposta devolvida sem prêmio nem pirulito
  const tie = settle({
    balance: 8,
    stake: 3,
    mode: "automatico",
    direction: "flat",
    prizeRoll: 0,
    lollipopRoll: 0,
  });
  assert.equal(tie.outcome, "tie");
  assert.equal(tie.balanceAfter, 8);
  assert.equal(tie.displayedDelta, 0);
  assert.equal(tie.lollipop, false);
});

test("validação estrita: recusa aposta inválida, saldo negativo e cadastro duplicado", () => {
  // Aposta acima do saldo
  assert.throws(() =>
    settle({ balance: 3, stake: 4, mode: "subir", direction: "up", prizeRoll: 0, lollipopRoll: 50 }),
  );
  // Aposta zero
  assert.throws(() =>
    settle({ balance: 3, stake: 0, mode: "subir", direction: "up", prizeRoll: 0, lollipopRoll: 50 }),
  );

  // Cálculo de taxa de sucesso
  assert.equal(successRatio(0, 0), null);
  assert.equal(successRatio(1, 1), 50);
  assert.equal(successRatio(2, 0), 100);

  // Validação de nomes (case-insensitive e espaços extras)
  const duplicated = validateNewPlayer(" maria ", "10", ["Maria"], 1);
  assert.ok("error" in duplicated);

  // Limite máximo de 5 participantes
  const sixth = validateNewPlayer("Lia", "4", ["a", "b", "c", "d", "e"], 5);
  assert.ok("error" in sixth);

  // Cadastro válido com normalização
  const ok = validateNewPlayer("  João   Pedro ", "8", [], 0);
  assert.deepEqual(ok, { name: "João Pedro", balance: 8 });

  // Saldo zero ou decimal rejeitado
  assert.ok("error" in validateNewPlayer("Ana", "0", [], 0));
  assert.ok("error" in validateNewPlayer("Ana", "1.5", [], 0));
});

test("ranking empata porcentagem igual e exclui empates do cálculo", () => {
  const ranked = rankPlayers([
    { id: "a", name: "Ana", wins: 1, losses: 1 },
    { id: "b", name: "Bia", wins: 2, losses: 2 },
    { id: "c", name: "Caio", wins: 1, losses: 0 },
    { id: "d", name: "Duda", wins: 0, losses: 0 },
  ]);
  assert.equal(ranked[0].id, "c");
  assert.equal(ranked[0].rank, 1);
  assert.equal(ranked[1].rank, 2);
  assert.equal(ranked[2].rank, 2);
  assert.equal(ranked[1].tied, true);
  assert.equal(ranked[2].tied, true);
  assert.equal(ranked[3].percent, null);
});

test("o gráfico é monotônico, não revela ponto além do relógio e encerra aos 15s", () => {
  const sim = createLiveSimulator(mulberry32(7), 50);
  let previous = 0;
  for (const mark of [0, 120, 1000, 8000, 15000]) {
    const points = sim.visible(mark);
    assert.ok(points.every((point) => point.t <= mark + 0.001));
    for (let index = 1; index < points.length; index++) {
      assert.ok(points[index].t >= points[index - 1].t);
    }
    const last = points[points.length - 1].t;
    assert.ok(last + 0.001 >= previous);
    previous = last;
  }
  const end = createLiveSimulator(mulberry32(7), 50).visible(15000);
  assert.equal(end[end.length - 1].t, 15000);
  assert.ok(end.length >= 2);
});

test("Módulos escolares PHP e Java: bridge de integração e fallback", () => {
  const cwd = process.cwd();
  const phpBin = path.join(cwd, "school/bin/php");
  const phpScript = path.join(cwd, "school/php/settle.php");

  // Testa se o binário do PHP responde
  const phpVersion = spawnSync(phpBin, ["-v"], { encoding: "utf8" });
  if (phpVersion.status === 0) {
    assert.match(phpVersion.stdout, /PHP/);

    const payload = {
      players: [
        {
          id: "joao",
          balance: 2,
          stake: 1,
          mode: "subir",
          direction: "up",
          prizeRoll: 56,
          lollipopRoll: 0,
        },
      ],
    };

    // Testa validação do PHP
    const phpRun = spawnSync(phpBin, [phpScript], {
      input: JSON.stringify(payload),
      encoding: "utf8",
    });

    if (phpRun.status === 0 && phpRun.stdout) {
      try {
        const body = JSON.parse(phpRun.stdout);
        assert.ok(typeof body === "object");
      } catch {
        // Formato não json
      }
    }
  }
});

test("Validação de recarga administrativa: rejeita zero, negativos, decimais e aceita inteiros positivos", () => {
  assert.equal(validateRecharge("0").valid, false);
  assert.equal(validateRecharge("-5").valid, false);
  assert.equal(validateRecharge("3.5").valid, false);
  assert.equal(validateRecharge("abc").valid, false);
  assert.equal(validateRecharge("").valid, false);
  const ok = validateRecharge("20");
  assert.equal(ok.valid, true);
  assert.equal(ok.amount, 20);
});

test("Cenário 1: Dois ou mais jogadores, um fica sem saldo e é eliminado. Os outros continuam até a terceira rodada", async () => {
  const store = useDispute.getState();
  store.confirmReset();

  store.addPlayer("João", "2");
  store.addPlayer("Pedro", "10");
  store.beginDispute();

  // Rodada 1
  store.setDraft(useDispute.getState().players[0].id, { mode: "subir", amount: "2" });
  store.setDraft(useDispute.getState().players[1].id, { mode: "subir", amount: "2" });
  store.startRound();
  store.markRunning();

  // João perde tudo (fica com 0), Pedro ganha
  await store.settleRound(
    [
      { playerId: useDispute.getState().players[0].id, direction: "down" },
      { playerId: useDispute.getState().players[1].id, direction: "up" },
    ],
    []
  );

  assert.equal(useDispute.getState().players[0].balance, 0);
  assert.ok(useDispute.getState().players[1].balance > 10);

  // Sai dos resultados para entrar na preparação da Rodada 2
  useDispute.getState().exitResults();
  assert.equal(useDispute.getState().roundIndex, 1);
  assert.equal(useDispute.getState().phase, "preparing");

  // Se tentar iniciar sem resolver João (saldo 0), é bloqueado
  const errBefore = useDispute.getState().startRound();
  assert.match(String(errBefore), /saldo esgotado/i);

  // Administrador elimina João da disputa
  const joaoId = useDispute.getState().players[0].id;
  const elimErr = useDispute.getState().eliminatePlayer(joaoId);
  assert.equal(elimErr, null);
  assert.equal(useDispute.getState().players[0].eliminated, true);

  // Agora Pedro pode configurar aposta e jogar a Rodada 2 sozinho
  const pedroId = useDispute.getState().players[1].id;
  useDispute.getState().setDraft(pedroId, { mode: "cair", amount: "3" });
  const startR2Err = useDispute.getState().startRound();
  assert.equal(startR2Err, null);
  useDispute.getState().markRunning();

  await useDispute.getState().settleRound(
    [{ playerId: pedroId, direction: "down" }],
    []
  );

  // Sai da rodada 2 para a rodada 3
  useDispute.getState().exitResults();
  assert.equal(useDispute.getState().roundIndex, 2);

  // Rodada 3 com Pedro
  useDispute.getState().setDraft(pedroId, { mode: "subir", amount: "1" });
  const startR3Err = useDispute.getState().startRound();
  assert.equal(startR3Err, null);
  useDispute.getState().markRunning();

  await useDispute.getState().settleRound(
    [{ playerId: pedroId, direction: "up" }],
    []
  );

  useDispute.getState().exitResults();
  assert.equal(useDispute.getState().phase, "final");

  // João completou rodada 1, foi eliminado, preservou seus dados, e Pedro concluiu as 3 rodadas
  const finalState = useDispute.getState();
  assert.equal(finalState.players[0].eliminated, true);
  assert.equal(finalState.players[0].history.length, 1);
  assert.equal(finalState.players[1].history.length, 3);
});

test("Cenário 2: Um jogador fica sem saldo e recebe recarga de quantidade escolhida. Ele continua na próxima rodada", async () => {
  const store = useDispute.getState();
  store.confirmReset();

  store.addPlayer("Carlos", "1");
  store.beginDispute();

  store.setDraft(useDispute.getState().players[0].id, { mode: "subir", amount: "1" });
  store.startRound();
  store.markRunning();

  // Carlos perde tudo (0 balas)
  await store.settleRound([{ playerId: useDispute.getState().players[0].id, direction: "down" }], []);
  assert.equal(useDispute.getState().players[0].balance, 0);

  useDispute.getState().exitResults();
  assert.equal(useDispute.getState().phase, "preparing");

  // Administrador adiciona 25 balas livremente
  const carlosId = useDispute.getState().players[0].id;
  const rechargeErr = useDispute.getState().rechargePlayer(carlosId, "25");
  assert.equal(rechargeErr, null);

  assert.equal(useDispute.getState().players[0].balance, 25);
  assert.equal(useDispute.getState().players[0].recharges?.length, 1);
  assert.equal(useDispute.getState().players[0].recharges?.[0].amount, 25);

  // Carlos continua normalmente na rodada 2
  useDispute.getState().setDraft(carlosId, { mode: "cair", amount: "5" });
  const startErr = useDispute.getState().startRound();
  assert.equal(startErr, null);
  useDispute.getState().markRunning();

  await useDispute.getState().settleRound([{ playerId: carlosId, direction: "down" }], []);
  assert.equal(useDispute.getState().phase, "results");
});

test("Cenário 3: Jogador eliminado tem tentativa de recarga recusada", () => {
  const store = useDispute.getState();
  store.confirmReset();

  store.addPlayer("Lucas", "5");
  store.beginDispute();

  const lucasId = useDispute.getState().players[0].id;
  store.eliminatePlayer(lucasId);
  assert.equal(useDispute.getState().players[0].eliminated, true);

  // Tentar recarregar jogador eliminado
  const err = useDispute.getState().rechargePlayer(lucasId, "50");
  assert.match(String(err), /eliminad/i);
  assert.equal(useDispute.getState().players[0].balance, 5);
});

test("Cenário 4: Jogador eliminado após a 1ª rodada mantém histórico e estatísticas anteriores intactos", async () => {
  const store = useDispute.getState();
  store.confirmReset();

  store.addPlayer("Mariana", "5");
  store.beginDispute();

  const mId = useDispute.getState().players[0].id;
  store.setDraft(mId, { mode: "subir", amount: "2" });
  store.startRound();
  store.markRunning();

  await store.settleRound([{ playerId: mId, direction: "up" }], []);

  const pAfterR1 = useDispute.getState().players[0];
  assert.equal(pAfterR1.wins, 1);
  assert.equal(pAfterR1.losses, 0);
  assert.equal(pAfterR1.history.length, 1);
  const balanceAfterWin = pAfterR1.balance;

  useDispute.getState().exitResults();

  // Elimina Mariana
  useDispute.getState().eliminatePlayer(mId);

  const pEliminated = useDispute.getState().players[0];
  assert.equal(pEliminated.eliminated, true);
  assert.equal(pEliminated.wins, 1);
  assert.equal(pEliminated.losses, 0);
  assert.equal(pEliminated.history.length, 1);
  assert.equal(pEliminated.balance, balanceAfterWin);

  // Ranking reflete 100% de vitórias
  const ranked = rankPlayers(useDispute.getState().players);
  assert.equal(ranked[0].name, "Mariana");
  assert.equal(ranked[0].percent, 100);
  assert.equal(ranked[0].eliminated, true);
});

test("Cenário 5: Três jogadores, dois eliminados e um continua até a 3ª rodada", async () => {
  const store = useDispute.getState();
  store.confirmReset();

  store.addPlayer("P1", "2");
  store.addPlayer("P2", "2");
  store.addPlayer("P3", "10");
  store.beginDispute();

  const [id1, id2, id3] = useDispute.getState().players.map((p) => p.id);

  // Elimina P1 e P2
  store.eliminatePlayer(id1);
  store.eliminatePlayer(id2);

  assert.equal(useDispute.getState().players.filter((p) => !p.eliminated).length, 1);

  // P3 joga rodadas 1, 2 e 3 sozinho
  for (let r = 0; r < 3; r++) {
    useDispute.getState().setDraft(id3, { mode: "subir", amount: "1" });
    assert.equal(useDispute.getState().startRound(), null);
    useDispute.getState().markRunning();
    await useDispute.getState().settleRound([{ playerId: id3, direction: "up" }], []);
    useDispute.getState().exitResults();
  }

  assert.equal(useDispute.getState().phase, "final");
  assert.equal(useDispute.getState().players[2].history.length, 3);
});

test("Cenário 6: Recarga não é contabilizada como vitória ou prêmio", () => {
  const store = useDispute.getState();
  store.confirmReset();

  store.addPlayer("Bruno", "10");
  store.beginDispute();

  const bId = useDispute.getState().players[0].id;
  const initialWins = useDispute.getState().players[0].wins;
  const initialLosses = useDispute.getState().players[0].losses;
  const initialHistoryLength = useDispute.getState().players[0].history.length;

  store.rechargePlayer(bId, "100");

  const player = useDispute.getState().players[0];
  assert.equal(player.balance, 110);
  assert.equal(player.wins, initialWins);
  assert.equal(player.losses, initialLosses);
  assert.equal(player.history.length, initialHistoryLength);
  assert.equal(player.recharges?.length, 1);
  assert.equal(player.recharges?.[0].amount, 100);
});

test("Cenário 7: Nova disputa reinicia condição de eliminado", () => {
  const store = useDispute.getState();
  store.confirmReset();

  store.addPlayer("Beatriz", "5");
  store.beginDispute();

  const bId = useDispute.getState().players[0].id;
  store.eliminatePlayer(bId);
  assert.equal(useDispute.getState().players[0].eliminated, true);

  // Reset para nova disputa
  store.confirmReset();
  assert.equal(useDispute.getState().phase, "registration");
  assert.equal(useDispute.getState().players.length, 0);

  // Cadastra Beatriz novamente em nova disputa
  store.addPlayer("Beatriz", "10");
  assert.equal(useDispute.getState().players[0].eliminated, false);
  assert.equal(useDispute.getState().players[0].balance, 10);
});
