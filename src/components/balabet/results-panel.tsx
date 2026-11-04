import { useEffect, useRef, useState } from "react";
import { useArt } from "@/lib/balabet/art";
import {
  DIRECTION_LABEL,
  MODE_LABEL,
  formatBalas,
} from "@/lib/balabet/engine";
import { useDispute, type ResultCard, type Player } from "@/lib/balabet/store";
import { ConfettiCanvas } from "@/components/balabet/confetti-canvas";

function tone(outcome: ResultCard["outcome"]) {
  if (outcome === "win") return "text-win";
  if (outcome === "loss") return "text-loss";
  return "text-gold";
}

function LossMarks({ count, src }: { count: number; src: string }) {
  if (count <= 36) {
    return (
      <div className="mt-3 flex max-h-28 flex-wrap gap-1 overflow-hidden" aria-hidden="true">
        {Array.from({ length: count }, (_, index) => (
          <img key={index} src={src} alt="" className="bala-rise size-7 rounded-full object-cover" />
        ))}
      </div>
    );
  }
  const shown = Math.min(count, 4000);
  const columns = Math.ceil(Math.sqrt(shown));
  return (
    <div
      className="mt-3 grid max-h-36 gap-0.5 overflow-hidden"
      style={{ gridTemplateColumns: `repeat(${Math.min(columns, 24)}, minmax(0, 1fr))` }}
      aria-hidden="true"
    >
      {Array.from({ length: shown }, (_, index) => (
        <img key={index} src={src} alt="" className="bala-rise aspect-square w-full rounded-full object-cover" />
      ))}
    </div>
  );
}

function Card({
  card,
  candy,
  lollipop,
  player,
  isLastRound,
  onRecharge,
  onEliminate,
}: {
  card: ResultCard;
  candy: string;
  lollipop: string;
  player?: Player;
  isLastRound: boolean;
  onRecharge: (player: Player) => void;
  onEliminate: (player: Player) => void;
}) {
  const headline =
    card.outcome === "win" ? "VOCÊ GANHOU!" : card.outcome === "loss" ? "VOCÊ PERDEU!" : "EMPATE!";
  const isEliminated = Boolean(player?.eliminated);
  const currentBalance = player ? player.balance : card.balanceAfter;
  const isZeroBalance = !isEliminated && currentBalance === 0;

  return (
    <article className={`panel flex flex-col p-4 ${card.lollipop ? "lolli-glow" : ""}`}>
      <header className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-fg flex items-center gap-1.5">
          <span>{card.name}</span>
          {isEliminated ? (
            <span className="rounded bg-loss/15 px-1.5 py-0.2 font-mono text-[10px] font-semibold text-loss border border-loss/30">
              ELIMINADO
            </span>
          ) : isZeroBalance ? (
            <span className="rounded bg-amber-500/20 px-1.5 py-0.2 font-mono text-[10px] font-semibold text-amber-400 border border-amber-500/30">
              0 BALAS
            </span>
          ) : null}
        </h3>
        <span className="font-mono text-xs text-muted">{MODE_LABEL[card.mode]}</span>
      </header>
      <p className={`count-pop mt-3 text-2xl font-semibold ${tone(card.outcome)}`}>{headline}</p>
      <p className="mt-1 text-sm text-muted">Último segmento {DIRECTION_LABEL[card.direction]}.</p>
      {card.outcome === "win" ? (
        <>
          <p className="mt-3 font-mono text-lg text-win">+{formatBalas(card.prize)} balas de prêmio</p>
          <div className="mt-2 flex gap-1" aria-hidden="true">
            {Array.from({ length: card.prize }, (_, index) => (
              <img key={index} src={candy} alt="" className="bala-pop size-8 rounded-full object-cover" />
            ))}
          </div>
          {card.lollipop ? (
            <div className="mt-3 flex items-center gap-2">
              <img src={lollipop} alt="" className="bala-pop size-14 rounded-full object-cover" />
              <p className="text-sm font-semibold text-gold">Pirulito raro</p>
            </div>
          ) : null}
        </>
      ) : null}
      {card.outcome === "loss" ? (
        <>
          <p className="mt-3 font-mono text-lg text-loss">−{formatBalas(card.stake)} balas</p>
          <LossMarks count={card.stake} src={candy} />
        </>
      ) : null}
      {card.outcome === "tie" ? (
        <p className="mt-3 text-sm text-gold-2">A aposta de {formatBalas(card.stake)} balas foi devolvida.</p>
      ) : null}

      <div className="mt-auto pt-4 border-t border-line/60">
        <div className="flex items-center justify-between font-mono text-xs text-muted">
          <span>Saldo atual:</span>
          <strong className={isZeroBalance ? "text-amber-400 font-bold" : "text-fg"}>
            {formatBalas(currentBalance)} balas
          </strong>
        </div>

        {/* Controles de Gerenciamento Individual se terminou com 0 balas */}
        {isZeroBalance && !isLastRound && player ? (
          <div className="mt-3 pt-2 border-t border-amber-500/20 space-y-1.5">
            <p className="text-[11px] text-amber-300 font-medium">
              ⚠️ Jogador sem saldo para a próxima rodada:
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                className="btn btn-primary text-xs py-1 min-h-[2rem]"
                onClick={() => onRecharge(player)}
              >
                ADICIONAR SALDO
              </button>
              <button
                type="button"
                className="btn btn-danger text-xs py-1 min-h-[2rem]"
                onClick={() => onEliminate(player)}
              >
                ELIMINAR DA DISPUTA
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function ResultsPanel() {
  const roundView = useDispute((state) => state.roundView);
  const phase = useDispute((state) => state.phase);
  const players = useDispute((state) => state.players);
  const exitResults = useDispute((state) => state.exitResults);
  const requestReset = useDispute((state) => state.requestReset);
  const rechargePlayer = useDispute((state) => state.rechargePlayer);
  const eliminatePlayer = useDispute((state) => state.eliminatePlayer);

  const { candy, lollipop } = useArt();
  const exitRef = useRef<HTMLButtonElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [confettiNonce, setConfettiNonce] = useState(0);

  // Estados dos modais de ação rápida no painel de resultados
  const [rechargeTarget, setRechargeTarget] = useState<Player | null>(null);
  const [rechargeInput, setRechargeInput] = useState<string>("");
  const [rechargeError, setRechargeError] = useState<string | null>(null);

  const [eliminateTarget, setEliminateTarget] = useState<Player | null>(null);

  const hasWinner = Boolean(roundView?.cards.some((card) => card.outcome === "win"));

  useEffect(() => {
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    exitRef.current?.focus({ preventScroll: true });
    if (hasWinner) {
      setConfettiNonce((n) => n + 1);
    }
  }, [roundView?.round, hasWinner]);

  if (phase !== "results" || !roundView) return null;

  const isLastRound = roundView.round >= 3;
  const zeroBalancePlayers = players.filter((p) => !p.eliminated && p.balance === 0);

  return (
    <>
      {/* Efeito de confetes no centro da tela ao vencer uma aposta */}
      <ConfettiCanvas key={`${roundView.round}-${confettiNonce}`} active={hasWinner} />

      <section
        ref={sectionRef}
        id="painel-resultados"
        aria-labelledby="results-title"
        className="panel border-2 border-gold/40 bg-surface/95 p-5 sm:p-6 shadow-2xl rounded-2xl space-y-5 my-4"
      >
        <div className="w-full">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-line/60 pb-4">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 id="results-title" className="text-xl sm:text-2xl font-bold tracking-tight text-fg">
                  Resultados da Rodada {roundView.round}/3
                </h2>
                {hasWinner ? (
                  <span className="rounded-full bg-win/20 px-3 py-1 font-mono text-xs font-bold text-win border border-win/40 animate-pulse">
                    🎉 VITÓRIA NA RODADA
                  </span>
                ) : (
                  <span className="rounded-full bg-surface-2 px-3 py-1 font-mono text-xs font-semibold text-muted border border-line">
                    RODADA CONCLUÍDA
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted">
                Os resultados dos participantes permanecem visíveis. Clique em <strong>SAIR</strong> para avançar para a próxima etapa.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {hasWinner ? (
                <button
                  type="button"
                  className="btn btn-ghost text-xs text-win border border-win/40 hover:bg-win/10 flex items-center gap-1.5"
                  onClick={() => setConfettiNonce((n) => n + 1)}
                  title="Disparar confetes novamente no centro da tela"
                >
                  <span aria-hidden="true">🎊</span>
                  <span>Soltar Confetes</span>
                </button>
              ) : null}
              <button type="button" className="btn btn-ghost text-xs" onClick={requestReset}>
                Resetar todos os dados
              </button>
              <button
                type="button"
                className="btn btn-primary text-sm font-bold px-6 py-2.5 shadow-lg shadow-gold/25"
                data-testid="exit-results"
                ref={exitRef}
                onClick={exitResults}
              >
                SAIR
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {roundView.cards.map((card) => {
              const p = players.find((item) => item.id === card.playerId);
              return (
                <Card
                  key={card.playerId}
                  card={card}
                  candy={candy}
                  lollipop={lollipop}
                  player={p}
                  isLastRound={isLastRound}
                  onRecharge={(target) => {
                    setRechargeTarget(target);
                    setRechargeInput("");
                    setRechargeError(null);
                  }}
                  onEliminate={(target) => setEliminateTarget(target)}
                />
              );
            })}
          </div>

          {/* Aviso e identificação de jogadores que zeraram o saldo na rodada */}
          {zeroBalancePlayers.length > 0 && !isLastRound ? (
            <div className="mt-4 rounded-xl border border-amber-500/40 bg-surface-2/90 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-amber-400 flex items-center gap-2">
                  <span>⚠️</span>
                  <span>Gerenciamento de Jogadores Sem Saldo ({zeroBalancePlayers.length})</span>
                </span>
                <span className="font-mono text-xs text-muted">Ação requerida para a Rodada {roundView.round + 1}/3</span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Os jogadores com saldo zerado não poderão participar da próxima rodada até que sua situação seja resolvida pelo administrador (via recarga administrativa ou eliminação da disputa).
                Você pode utilizar os botões abaixo ou na tela de preparação ao clicar em <strong>SAIR</strong>.
              </p>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {zeroBalancePlayers.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-surface p-3"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <strong className="text-fg">{p.name}</strong>
                      <span className="font-mono text-amber-400 font-bold">0 balas</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <button
                        type="button"
                        className="btn btn-primary text-xs py-1 min-h-[2rem]"
                        onClick={() => {
                          setRechargeTarget(p);
                          setRechargeInput("");
                          setRechargeError(null);
                        }}
                      >
                        ADICIONAR SALDO
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger text-xs py-1 min-h-[2rem]"
                        onClick={() => setEliminateTarget(p)}
                      >
                        ELIMINAR
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* Modal de Recarga rápida dentro do ResultsPanel */}
      {rechargeTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="results-recharge-title"
            className="panel w-full max-w-md p-6 shadow-2xl border-gold/40"
          >
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 id="results-recharge-title" className="text-lg font-semibold text-fg">
                Adicionar Saldo — {rechargeTarget.name}
              </h2>
              <span className="font-mono text-xs text-gold">Recarga Administrativa</span>
            </div>
            <div className="mt-4 space-y-4">
              <div className="rounded-lg border border-line bg-surface/60 p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted">Jogador:</span>
                  <strong className="text-fg">{rechargeTarget.name}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Saldo atual:</span>
                  <strong className="font-mono text-gold font-bold">
                    {formatBalas(rechargeTarget.balance)} balas
                  </strong>
                </div>
              </div>

              <label className="block text-sm">
                <span className="font-medium text-fg">Quantidade de balas a adicionar</span>
                <input
                  className="field mt-1.5 font-mono text-base"
                  inputMode="numeric"
                  autoFocus
                  value={rechargeInput}
                  onChange={(e) => {
                    setRechargeInput(e.target.value);
                    if (rechargeError) setRechargeError(null);
                  }}
                  placeholder="Ex: 10, 20, 50"
                />
              </label>

              {rechargeError ? (
                <p role="alert" className="text-xs text-loss font-medium">
                  ⚠ {rechargeError}
                </p>
              ) : null}

              <p className="text-xs text-muted leading-relaxed">
                * A recarga é uma operação administrativa para permitir que o participante continue na disputa. Não é contabilizada como vitória, prêmio ou resultado de aposta.
              </p>

              <div className="mt-6 flex justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setRechargeTarget(null);
                    setRechargeInput("");
                    setRechargeError(null);
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    const err = rechargePlayer(rechargeTarget.id, rechargeInput);
                    if (err) {
                      setRechargeError(err);
                      return;
                    }
                    setRechargeTarget(null);
                    setRechargeInput("");
                    setRechargeError(null);
                  }}
                >
                  Confirmar Recarga
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal de Eliminação rápida dentro do ResultsPanel */}
      {eliminateTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="results-eliminate-title"
            className="panel w-full max-w-md p-6 shadow-2xl border-loss/40"
          >
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 id="results-eliminate-title" className="text-lg font-semibold text-loss flex items-center gap-2">
                <span>⚠️</span>
                Eliminar Jogador da Disputa?
              </h2>
              <span className="font-mono text-xs text-loss uppercase">Definitivo</span>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <p className="text-fg font-medium">
                Confirma a eliminação de <strong>{eliminateTarget.name}</strong> da disputa atual?
              </p>
              <div className="rounded-lg border border-line bg-surface/60 p-3 text-xs space-y-1.5 text-muted">
                <p>• O jogador <strong>não participará das rodadas restantes</strong>.</p>
                <p>• Todo o histórico de <strong>vitórias ({eliminateTarget.wins})</strong>, <strong>derrotas ({eliminateTarget.losses})</strong> e <strong>empates ({eliminateTarget.ties})</strong> será integralmente preservado.</p>
                <p>• A posição no ranking continuará preservada com base nas rodadas disputadas.</p>
                <p>• <strong>Nenhuma derrota artificial</strong> será computada pela eliminação.</p>
                <p>• Os demais participantes ativos prosseguirão normalmente até a 3ª rodada.</p>
                <p className="text-loss/90 font-semibold">• A eliminação é definitiva para esta disputa: recargas futuras serão bloqueadas.</p>
              </div>

              <div className="mt-6 flex justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setEliminateTarget(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => {
                    eliminatePlayer(eliminateTarget.id);
                    setEliminateTarget(null);
                  }}
                >
                  Confirmar Eliminação
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
