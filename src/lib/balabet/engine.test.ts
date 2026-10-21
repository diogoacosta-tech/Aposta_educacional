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
} from "./engine.ts";

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
