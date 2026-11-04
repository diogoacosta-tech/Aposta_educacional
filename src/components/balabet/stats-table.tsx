import { formatBalas, formatPercent, rankPlayers, successRatio } from "@/lib/balabet/engine";
import { useDispute } from "@/lib/balabet/store";

export function StatsTable() {
  const players = useDispute((state) => state.players);
  return (
    <section className="panel overflow-x-auto p-4" aria-label="Estatísticas dos Jogadores">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">ESTATÍSTICAS INDIVIDUAIS</h2>
        <span className="font-mono text-xs text-muted">Histórico e saldos preservados</span>
      </div>
      <table className="w-full min-w-[36rem] text-left text-sm">
        <thead className="text-muted">
          <tr>
            <th className="py-2 font-medium">Nome</th>
            <th className="py-2 font-medium">Situação</th>
            <th className="py-2 font-medium">Saldo</th>
            <th className="py-2 font-medium">Vitórias</th>
            <th className="py-2 font-medium">Derrotas</th>
            <th className="py-2 font-medium">Porcentagem de sucesso</th>
            <th className="py-2 font-medium">Recargas Adm</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => {
            const totalRecharge = (player.recharges ?? []).reduce(
              (acc, r) => acc + r.amount,
              0
            );
            return (
              <tr key={player.id} className="border-t border-line">
                <td className="py-3 font-medium text-fg">{player.name}</td>
                <td className="py-3">
                  {player.eliminated ? (
                    <span className="rounded bg-loss/15 px-2 py-0.5 font-mono text-xs font-semibold text-loss border border-loss/30">
                      ELIMINADO
                    </span>
                  ) : player.balance === 0 ? (
                    <span className="rounded bg-amber-500/20 px-2 py-0.5 font-mono text-xs font-semibold text-amber-400 border border-amber-500/30">
                      SEM SALDO
                    </span>
                  ) : (
                    <span className="rounded bg-win/15 px-2 py-0.5 font-mono text-xs font-semibold text-win border border-win/30">
                      ATIVO
                    </span>
                  )}
                </td>
                <td className="py-3 font-mono text-gold">{formatBalas(player.balance)} balas</td>
                <td className="py-3 font-mono">{player.wins}</td>
                <td className="py-3 font-mono">{player.losses}</td>
                <td className="py-3 font-mono">{formatPercent(successRatio(player.wins, player.losses))}</td>
                <td className="py-3 font-mono text-muted">
                  {totalRecharge > 0 ? (
                    <span className="text-gold-2">+{formatBalas(totalRecharge)} balas</span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

export function RankingTable({ final }: { final: boolean }) {
  const players = useDispute((state) => state.players);
  const ranked = rankPlayers(players);
  if (ranked.length === 0) {
    return <p className="text-muted">Nenhum jogador cadastrado nesta disputa.</p>;
  }
  return (
    <div className="panel overflow-x-auto p-4">
      <p className="mb-3 text-sm text-gold font-semibold">{final ? "Ranking final da disputa" : "Classificação parcial"}</p>
      <table className="w-full min-w-[34rem] text-left text-sm">
        <thead className="text-muted">
          <tr>
            <th className="py-2 font-medium">Posição</th>
            <th className="py-2 font-medium">Nome</th>
            <th className="py-2 font-medium">Vitórias</th>
            <th className="py-2 font-medium">Derrotas</th>
            <th className="py-2 font-medium">Porcentagem de sucesso</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((player) => (
            <tr key={player.id} className="border-t border-line">
              <td className="py-3 font-mono">
                {player.rank}
                {player.tied ? <span className="ml-2 text-xs text-gold">empate</span> : null}
              </td>
              <td className="py-3 flex items-center gap-2">
                <span className="font-medium text-fg">{player.name}</span>
                {player.eliminated ? (
                  <span className="rounded bg-loss/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-loss border border-loss/30">
                    ELIMINADO
                  </span>
                ) : null}
              </td>
              <td className="py-3 font-mono">{player.wins}</td>
              <td className="py-3 font-mono">{player.losses}</td>
              <td className="py-3 font-mono">{formatPercent(player.percent)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-muted">
        A porcentagem é vitórias ÷ (vitórias + derrotas). Empates e eliminações não geram derrotas artificiais; posições e estatísticas anteriores permanecem preservadas.
      </p>
    </div>
  );
}
