import type { NavTab } from "./shell";
import { RankingTable } from "@/components/balabet/stats-table";
import { useDispute } from "@/lib/balabet/store";

export function TopView({ onSelectTab }: { onSelectTab: (tab: NavTab) => void }) {
  const phase = useDispute((state) => state.phase);
  const players = useDispute((state) => state.players);
  const isFinal = phase === "final";

  return (
    <div className="space-y-6">
      <header className="border-b border-line pb-4">
        <p className="font-mono text-xs tracking-wide text-gold font-semibold uppercase">
          CLASSIFICAÇÃO GERAL
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-fg">TOP — Ranking dos Jogadores</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          A classificação é ordenada exclusivamente pela <strong>porcentagem de sucesso</strong>{" "}
          (vitórias ÷ [vitórias + derrotas] × 100). Participantes com a mesma taxa dividem a mesma posição;
          não existem critérios artificiais de desempate por saldo, nome ou saldo acumulado.
        </p>
      </header>

      {players.length === 0 ? (
        <div className="panel p-8 text-center space-y-4">
          <p className="text-muted">Nenhum jogador cadastrado nesta disputa ainda.</p>
          <button
            type="button"
            onClick={() => onSelectTab("apostar")}
            className="btn btn-primary"
          >
            Cadastrar Participantes
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <RankingTable final={isFinal} />
          {!isFinal ? (
            <p className="font-mono text-xs text-muted">
              * Nota: Classificação parcial da disputa. O ranking final definitivo será fixado após o término da 3ª rodada.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
