import { useEffect, useRef, useState } from "react";
import { useArt } from "@/lib/balabet/art";
import {
  DIRECTION_LABEL,
  MODE_LABEL,
  formatBalas,
} from "@/lib/balabet/engine";
import { useDispute, type ResultCard } from "@/lib/balabet/store";
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

function Card({ card, candy, lollipop }: { card: ResultCard; candy: string; lollipop: string }) {
  const headline =
    card.outcome === "win" ? "VOCÊ GANHOU!" : card.outcome === "loss" ? "VOCÊ PERDEU!" : "EMPATE!";
  return (
    <article className={`panel flex flex-col p-4 ${card.lollipop ? "lolli-glow" : ""}`}>
      <header className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{card.name}</h3>
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
      <p className="mt-auto pt-4 font-mono text-xs text-muted">Saldo: {formatBalas(card.balanceAfter)}</p>
    </article>
  );
}

export function ResultsPanel() {
  const roundView = useDispute((state) => state.roundView);
  const phase = useDispute((state) => state.phase);
  const exitResults = useDispute((state) => state.exitResults);
  const requestReset = useDispute((state) => state.requestReset);
  const { candy, lollipop } = useArt();
  const exitRef = useRef<HTMLButtonElement>(null);
  const [confettiNonce, setConfettiNonce] = useState(0);

  const hasWinner = Boolean(roundView?.cards.some((card) => card.outcome === "win"));

  useEffect(() => {
    exitRef.current?.focus();
    if (hasWinner) {
      setConfettiNonce((n) => n + 1);
    }
  }, [roundView?.round, hasWinner]);

  if (phase !== "results" || !roundView) return null;

  return (
    <>
      {/* Efeito de confetes no centro da tela ao vencer uma aposta */}
      <ConfettiCanvas key={`${roundView.round}-${confettiNonce}`} active={hasWinner} />

      <div className="fixed inset-x-0 bottom-0 top-16 z-30 overflow-y-auto bg-bg/80 p-4 backdrop-blur-sm">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="results-title"
          className="mx-auto w-full max-w-6xl"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 id="results-title" className="text-xl font-semibold">
                  Resultados da rodada {roundView.round}/3
                </h2>
                {hasWinner ? (
                  <span className="rounded-full bg-win/20 px-2.5 py-0.5 font-mono text-xs font-semibold text-win border border-win/40 animate-pulse">
                    🎉 VITÓRIA NA RODADA
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-muted">Os quadrinhos ficam aqui até você clicar em SAIR.</p>
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
              <button type="button" className="btn btn-danger" onClick={requestReset}>
                Resetar todos os dados
              </button>
              <button
                type="button"
                className="btn btn-primary"
                data-testid="exit-results"
                ref={exitRef}
                onClick={exitResults}
              >
                SAIR
              </button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {roundView.cards.map((card) => (
              <Card key={card.playerId} card={card} candy={candy} lollipop={lollipop} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
