import { formatPercent, rankPlayers, successRatio } from "@/lib/balabet/engine";
import { useDispute } from "@/lib/balabet/store";

export function StatsTable() {
  const players = useDispute((state) => state.players);
  return (
    <section className="panel overflow-x-auto p-4" aria-label="Estatísticas">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted">ESTATÍSTICAS</h2>
      <table className="w-full min-w-[28rem] text-left text-sm">
        <thead className="text-muted">
          <tr>
            <th className="py-2 font-medium">Nome</th>
            <th className="py-2 font-medium">Vitórias</th>
            <th className="py-2 font-medium">Derrotas</th>
            <th className="py-2 font-medium">Porcentagem de sucesso</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr key={player.id} className="border-t border-line">
              <td className="py-3">{player.name}</td>
              <td className="py-3 font-mono">{player.wins}</td>
              <td className="py-3 font-mono">{player.losses}</td>
              <td className="py-3 font-mono">{formatPercent(successRatio(player.wins, player.losses))}</td>
            </tr>
          ))}
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
      <p className="mb-3 text-sm text-gold">{final ? "Ranking final" : "Classificação parcial"}</p>
      <table className="w-full min-w-[32rem] text-left text-sm">
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
              <td className="py-3">{player.name}</td>
              <td className="py-3 font-mono">{player.wins}</td>
              <td className="py-3 font-mono">{player.losses}</td>
              <td className="py-3 font-mono">{formatPercent(player.percent)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-muted">
        A porcentagem é vitórias ÷ (vitórias + derrotas). Empates ficam de fora e não desempata ninguém.
      </p>
    </div>
  );
}
