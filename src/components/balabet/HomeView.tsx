import type { NavTab } from "./shell";
import { useDispute, phaseLabel } from "@/lib/balabet/store";
import { formatBalas } from "@/lib/balabet/engine";

export function HomeView({ onSelectTab }: { onSelectTab: (tab: NavTab) => void }) {
  const phase = useDispute((state) => state.phase);
  const roundIndex = useDispute((state) => state.roundIndex);
  const players = useDispute((state) => state.players);

  return (
    <div className="space-y-8">
      <section className="panel overflow-hidden p-6 sm:p-10 relative">
        <div className="relative z-10">
          <p className="font-mono text-xs tracking-[0.2em] text-gold font-semibold uppercase">
            SIMULAÇÃO OFICIAL · BALAS VIRTUAIS
          </p>
          <h1 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-5xl text-fg leading-tight">
            Três rodadas. Linhas independentes. Nenhum dinheiro real.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
            A BalaBet é uma plataforma fechada de simulação para até cinco pessoas. Cada participante entra com seu
            saldo individual de balas virtuais, define sua estratégia escolhendo <strong>SUBIR</strong>,{" "}
            <strong>CAIR</strong> ou <strong>AUTOMÁTICO</strong> e acompanha a oscilação gráfica em tempo real por 15 segundos.
            O último segmento real da sua linha decide a vitória, derrota ou empate.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onSelectTab("apostar")}
              className="btn btn-primary shadow-lg shadow-gold/20"
            >
              Ir para as apostas
            </button>
            <button
              type="button"
              onClick={() => onSelectTab("como-jogar")}
              className="btn btn-ghost"
            >
              Como jogar (Regras)
            </button>
            <button
              type="button"
              onClick={() => onSelectTab("top")}
              className="btn btn-ghost"
            >
              Ver Ranking (TOP)
            </button>
          </div>
        </div>

        {/* Status card if players are already enrolled */}
        {players.length > 0 ? (
          <div className="mt-8 rounded-xl border border-line/80 bg-surface/80 p-4 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="font-mono text-xs text-gold font-semibold uppercase">Status da Disputa:</span>
                <p className="text-sm font-semibold text-fg">
                  {phaseLabel(phase, roundIndex)} · {players.length} participante(s)
                </p>
              </div>
              <div className="flex items-center gap-2">
                {players.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs"
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{ background: `var(--color-player-${p.colorIndex + 1})` }}
                    />
                    {p.name}: <strong className="font-mono">{formatBalas(p.balance)}</strong>
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          [
            "01",
            "Cadastro & Saldos",
            "Nomes únicos e saldo inicial individual para até cinco participantes. A disputa só começa com pelo menos um jogador válido.",
          ],
          [
            "02",
            "Ciclo de 3 Rodadas",
            "Contagem regressiva de 3s, gráfico por 15s e resultados simultâneos em quadrinhos. A rodada seguinte só inicia após clique em COMEÇAR RODADA.",
          ],
          [
            "03",
            "Fechamento & Ranking",
            "Após a terceira rodada, é apresentado o Ranking Final e a 4ª rodada é bloqueada. O reset limpa os dados para uma nova disputa.",
          ],
        ].map(([step, title, copy]) => (
          <article key={step} className="panel p-6 flex flex-col justify-between">
            <div>
              <p className="font-mono text-sm font-bold text-gold">{step}</p>
              <h2 className="mt-2 text-lg font-semibold text-fg">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{copy}</p>
            </div>
          </article>
        ))}
      </section>

      {/* Responsabilidade e Tecnologia */}
      <section className="panel p-6 border-line/60">
        <h2 className="text-base font-semibold text-fg">Arquitetura Integrada e Finalidade Educacional</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Este software cumpre integralmente os requisitos do projeto escolar com integração de <strong>HTML semântico</strong>,{" "}
          <strong>CSS escuro profissional</strong>, <strong>PHP</strong> de validação de requisições e motor <strong>Java 17</strong>{" "}
          para processamento da tabela de pesos e sorteio independente do pirulito raro de 5%.
        </p>
      </section>
    </div>
  );
}
