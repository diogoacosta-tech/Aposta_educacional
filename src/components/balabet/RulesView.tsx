import { useState } from "react";
import { useArt } from "@/lib/balabet/art";

const SECTIONS = [
  {
    title: "1. Cadastro e Saldos Individuais",
    body: "O responsável adiciona de 1 até cinco jogadores, cada um com nome único e saldo inicial de no mínimo 1 bala. Os saldos são 100% independentes. Nomes vazios, repetidos (ignorando maiúsculas e espaços extras) ou um sexto jogador são estritamente rejeitados pelo sistema. Uma vez iniciada a disputa, novos participantes não podem ser inseridos até o reset.",
  },
  {
    title: "2. Apostas e Modos de Operação",
    body: "Antes de cada uma das três rodadas, cada pessoa escolhe SUBIR, CAIR ou AUTOMÁTICO e define a quantidade de balas apostadas (mínimo de 1 e máximo correspondente ao saldo disponível). A aposta anterior não é obrigatória para a rodada seguinte e pode ser alterada livremente.",
  },
  {
    title: "3. Definição dos Modos (SUBIR, CAIR, AUTOMÁTICO)",
    body: "SUBIR: vence se o último segmento visível da sua linha for ascendente (subir), perde se for descendente (cair) e empata se não houver deslocamento. CAIR: vence na descida, perde na subida e empata sem movimento. AUTOMÁTICO: vence na subida, perde na descida e empata sem movimento (possui exatamente as mesmas regras e prêmios dos demais).",
  },
  {
    title: "4. Contagem Regressiva e Gráfico em Tempo Real",
    body: "Ao clicar em COMEÇAR RODADA, todas as apostas são bloqueadas e uma contagem regressiva de 3 segundos se inicia. Em seguida, as linhas retas e anguladas dos jogadores se movem por 15 segundos baseados no relógio de alta precisão. Passar o cursor sobre uma linha destaca a cor daquele participante sem interferir nos cálculos.",
  },
  {
    title: "5. Avaliação do Último Segmento",
    body: "Ao final exato dos 15 segundos, o gráfico congela. Qualquer subida mínima conta como alta; qualquer queda mínima conta como baixa; ausência de deslocamento é empate. O resultado considera estritamente o estado real do gráfico no momento do encerramento.",
  },
  {
    title: "6. Regras de Saldo, Prêmios e Empates",
    body: "Na vitória, o valor apostado é devolvido integralmente e o participante recebe um prêmio adicional de 1 a 5 balas. Na derrota, desconta-se exclusivamente o valor apostado. No empate, a aposta é devolvida sem prêmio. É impossível gerar saldo negativo ou processar cobranças repetidas.",
  },
  {
    title: "7. Probabilidades dos Prêmios em Balas",
    body: "Toda vitória aciona um sorteio independente utilizando os pesos inteiros 28, 28, 22, 11 e 6 (soma 95), garantindo a distribuição normalizada proporcional para os prêmios de 1 a 5 balas, independente do gráfico ou da aposta.",
  },
  {
    title: "8. Pirulito Raro (5% de Chance Independente)",
    body: "O pirulito é um brinde virtual exclusivo, não uma moeda de aposta. Ele não pode ser apostado nem comprado com balas. Ele só pode sair em caso de vitória, através de um sorteio separado com 5% de chance (95% de chance de não sair). Derrotas e empates nunca concedem o pirulito.",
  },
  {
    title: "9. Painel de Resultados, Botão SAIR e Rodadas Seguintes",
    body: "Os quadrinhos de resultados de todos os participantes aparecem simultaneamente ao final da rodada e permanecem na tela até o responsável clicar em SAIR. Ao clicar em SAIR na Rodada 1 ou 2, o gráfico é restaurado ao ponto inicial e as apostas voltam a ser editáveis. A rodada seguinte NUNCA inicia automaticamente — requer um novo clique voluntário em COMEÇAR RODADA. Após a Rodada 3, SAIR exibe o Ranking Final e encerra a disputa permanentemente.",
  },
  {
    title: "10. Estatísticas, TOP e Reset Global",
    body: "A taxa de sucesso é calculada por vitórias ÷ (vitórias + derrotas) × 100 (empates não entram no cálculo). O botão RESETAR TODOS OS DADOS está disponível em qualquer etapa da aplicação com caixa de diálogo de confirmação.",
  },
];

export function RulesView() {
  const art = useArt();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <header className="border-b border-line pb-4">
        <p className="font-mono text-xs tracking-wide text-gold font-semibold uppercase">
          MANUAL COMPLETO DO JOGO
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-fg">Como Jogar — Regras da BalaBet</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Compreenda o funcionamento detalhado das regras, cálculos estatísticos, probabilidades dos sorteios e mecânica das três rodadas.
        </p>
      </header>

      {/* Regras detalhadas em acordeão / cards */}
      <div className="grid gap-4">
        {SECTIONS.map((section) => (
          <section key={section.title} className="panel p-5">
            <h2 className="text-base font-semibold text-fg">{section.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{section.body}</p>
          </section>
        ))}
      </div>

      {/* Tabela de Probabilidades */}
      <section className="panel overflow-x-auto p-5 border-line/80">
        <h2 className="text-base font-semibold text-fg">Tabela de Probabilidades do Prêmio Adicional</h2>
        <p className="mt-1 text-xs text-muted">
          Pesos matemáticos originais normalizados para sorteio independente a cada vitória.
        </p>
        <table className="mt-3 w-full min-w-[20rem] text-left text-sm">
          <thead className="text-muted border-b border-line">
            <tr>
              <th className="py-2.5 font-medium">Prêmio Adicional</th>
              <th className="py-2.5 font-medium">Peso Inteiro</th>
              <th className="py-2.5 font-medium">Probabilidade Normalizada</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["1 bala adicional", "28", "29,47%"],
              ["2 balas adicionais", "28", "29,47%"],
              ["3 balas adicionais", "22", "23,16%"],
              ["4 balas adicionais", "11", "11,58%"],
              ["5 balas adicionais", "6", "6,32%"],
            ].map(([prize, weight, chance]) => (
              <tr key={prize} className="border-t border-line/60">
                <td className="py-2.5 font-medium text-fg">{prize}</td>
                <td className="py-2.5 font-mono text-gold">{weight}</td>
                <td className="py-2.5 font-mono text-win">{chance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Aviso de Jogo Responsável */}
      <section className="panel border-gold/40 p-6 bg-surface/80">
        <h2 className="text-base font-semibold text-gold">Aviso de Responsabilidade e Consciência</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          A <strong>BalaBet</strong> é uma simulação educacional e lúdica que utiliza exclusivamente balas virtuais, sem nenhum dinheiro real, pagamentos, depósitos ou saques.
          Apostas em plataformas reais com dinheiro de verdade podem resultar em perdas financeiras severas e prejuízos pessoais e familiares.
          Incentivamos a diversão consciente: nunca utilize recursos destinados a necessidades essenciais e jamais tente recuperar perdas financeiras apostando.
        </p>
      </section>

      {/* Personalização Visual de Bala e Pirulito */}
      <section className="panel p-6 border-line">
        <h2 className="text-base font-semibold text-fg">Personalização da Arte das Balas e do Pirulito</h2>
        <p className="mt-1 text-sm text-muted">
          A personalização visual afeta somente a imagem exibida na interface. Ela não altera saldos, probabilidades, pesos ou qualquer regra do jogo.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <img
              src={art.candy}
              alt="Bala virtual"
              className="size-16 rounded-full object-cover ring-2 ring-gold/40"
            />
            <div>
              <p className="text-sm font-semibold text-fg">Bala Virtual</p>
              <p className="text-xs text-muted">Usada nas apostas</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <img
              src={art.lollipop}
              alt="Pirulito raro"
              className="size-16 rounded-full object-cover ring-2 ring-gold/40"
            />
            <div>
              <p className="text-sm font-semibold text-fg">Pirulito Raro</p>
              <p className="text-xs text-muted">Brinde de 5% de chance</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            <span className="font-medium text-fg">Substituir imagem da Bala (JPG/PNG)</span>
            <input
              className="field mt-1.5 text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:bg-surface-2 file:text-fg"
              type="file"
              accept="image/*"
              onChange={async (event) => {
                const file = event.target.files?.[0] ?? null;
                setMessage(await art.setFile("candy", file));
              }}
            />
          </label>

          <label className="text-sm">
            <span className="font-medium text-fg">Substituir imagem do Pirulito Raro (JPG/PNG)</span>
            <input
              className="field mt-1.5 text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:bg-surface-2 file:text-fg"
              type="file"
              accept="image/*"
              onChange={async (event) => {
                const file = event.target.files?.[0] ?? null;
                setMessage(await art.setFile("lollipop", file));
              }}
            />
          </label>
        </div>

        {message ? <p className="mt-2 text-sm text-loss">{message}</p> : null}

        <div className="mt-4 pt-3 border-t border-line/60 flex items-center justify-between">
          <button
            type="button"
            className="btn btn-ghost text-xs"
            onClick={() => art.resetArt()}
          >
            Restaurar imagens originais do projeto
          </button>
          {art.customized ? (
            <span className="text-xs text-gold">Imagens customizadas salvas localmente</span>
          ) : null}
        </div>
      </section>
    </div>
  );
}
