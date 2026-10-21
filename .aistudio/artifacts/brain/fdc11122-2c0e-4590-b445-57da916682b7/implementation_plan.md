# BalaBet — Plataforma de Simulação de Apostas Virtuais

Plano arquitetural e operacional para dar continuidade e concluir o desenvolvimento da **BalaBet**, aproveitando o código existente desenvolvido pelo Grok, alinhando as regras do **Prompt Mestre**, os requisitos do **Adendo Obrigatório (HTML, CSS, PHP e Java)** e as escolhas de interface do usuário.

---

## Decisões Confirmadas e Revisão do Usuário

> [!IMPORTANT]
> As decisões abaixo foram confirmadas pelo usuário na fase de alinhamento e guiarão a continuidade do desenvolvimento sem perda de regras de negócio.

- **Mecanismo de Liquidação Híbrido**: A liquidação opera com motor client-side de alta confiabilidade em TypeScript (com criptografia local para rolagens sem falha de rede), mantendo preservados e auditáveis na pasta `school/` os módulos reais em **Java 17** (`Engine.java`, `Main.java`) e **PHP** (`settle.php`), com bridge de API `/api/settle` no servidor Express.
- **Navegação SPA Instantânea por Abas**: As quatro áreas obrigatórias (**Início**, **Apostar**, **TOP** e **Como Jogar**) operarão em uma experiência SPA veloz e sem recarregar a tela, garantindo que o estado da disputa, os gráficos e os temporizadores nunca se percam ao navegar entre as seções.
- **Personalização Visual de Balas e Pirulitos**: Manutenção do recurso de upload/substituição de arte customizada para a bala e o pirulito raro (com suporte a SVG/PNG/JPG e armazenamento local `balabet-art-v1`), com fallback para as imagens oficiais em alta definição.

---

## 1. Visão Geral e Conceito Central

- **O que faz**: A BalaBet é uma simulação de trading/apostas com balas virtuais (sem dinheiro real), onde até 5 jogadores competem em disputas de exatamente 3 rodadas controladas pelo operador. Cada rodada conta com contagem regressiva de 3 segundos, animação de gráfico de linhas contínuas por 15 segundos, determinação da direção do último segmento (SUBIR, CAIR, AUTOMÁTICO), cálculo de saldos (pesos 28, 28, 22, 11, 6 para prêmios de 1 a 5 balas), sorteio independente de 5% para o pirulito raro, painel de resultados com quadrinhos simultâneos persistentes até o clique em SAIR, ranking final e botão de reset global.
- **Público-alvo**: Estudantes, avaliadores de projetos técnicos e entusiastas de simulações interativas que buscam diversão sem risco financeiro.
- **Valor central**: Integridade contábil estrita (nenhum saldo negativo, nenhuma aposta processada duas vezes, nenhuma quarta rodada), aliada a uma interface escura inspirada em terminais financeiros profissionais.

---

## 2. Experiência do Usuário e Design Visual

### 2.1 Fluxo do Usuário
1. **Cadastro**: Cadastro de 1 a 5 participantes com nomes exclusivos e saldo inicial de no mínimo 1 bala.
2. **Preparação de Rodada (1/3)**: Cada jogador seleciona seu modo (SUBIR, CAIR ou AUTOMÁTICO) e define a quantidade de balas apostadas (entre 1 e seu saldo atual).
3. **Bloqueio e Contagem**: Clique em "COMEÇAR RODADA" valida as apostas, bloqueia alterações e inicia contagem regressiva de 3 segundos com som e feedback visual.
4. **Gráfico em Ação (15s)**: Linhas independentes desenhadas em tempo real na grade do gráfico com oscilações anguladas e marcações verticais (0%, 10%, 30%, 50%, 80%, 100%).
5. **Congelamento e Resultados**: Ao completar 15 segundos, o gráfico congela no último ponto. Os resultados são liquidados simultaneamente e os quadrinhos de todos os jogadores abrem juntos na tela.
6. **Permanência e Transição**: O painel de resultados fica aberto até o clique em "SAIR".
   - Após Rodada 1 e Rodada 2: clicar em "SAIR" restaura o gráfico ao ponto inicial e libera a reconfiguração das apostas. A próxima rodada **nunca inicia sozinha**; requer novo clique em "COMEÇAR RODADA".
   - Após Rodada 3: clicar em "SAIR" encerra a disputa e exibe o **Ranking Final**. O botão de nova rodada é permanentemente desabilitado.
7. **Reset**: Disponível em qualquer momento (com diálogo modal de confirmação) para zerar a disputa e retornar ao cadastro.

### 2.2 Identidade Visual e Estética
- **Paleta de Cores**:
  - Fundo principal: Canvas escuro profundo (`#0b0f19` / `#050811`).
  - Painéis e cartões: Superfícies sutis em ardósia escura (`#111827`, `#1f2937`) com bordas finas de 1px (`rgba(255,255,255,0.08)`).
  - Cores dos participantes: 5 cores vibrantes e contrastantes (Ciano `#06b6d4`, Esmeralda `#10b981`, Âmbar `#f59e0b`, Violeta `#8b5cf6`, Rosa `#ec4899`).
  - Vitórias e Prêmios: Verde esmeralda brilhante (`#10b981`) e Dourado para o pirulito raro (`#f59e0b`).
  - Derrotas: Vermelho carmim (`#ef4444`) com animação de balas perdidas subindo e desaparecendo.
  - Empates: Amarelo suave neutro (`#eab308`).
- **Tipografia**:
  - Fontes modernas e limpas com números tabulares (`font-mono tabular-nums`) em tabelas, saldos e contadores para alinhamento vertical perfeito.
  - Hierarquia clara: títulos expressivos, subtítulos nítidos e metadados discretos sem poluição de pílulas desnecessárias.
- **Contrato de Barra Superior**:
  - Marca: "BalaBet" com indicador sutil da disputa.
  - Links de navegação: Início, Apostar, TOP, Como Jogar.
  - Ação primária: Botão de "Resetar Dados" ou status da rodada atual.

---

## 3. Decisões Técnicas e Arquitetura

### 3.1 Fonte Única da Verdade e Motor de Regras
- Os cálculos e validações do jogo seguem a especificação matemática estrita do Prompt Mestre:
  - Pesos de prêmio de vitória: `[28, 28, 22, 11, 6]` (soma 95) correspondendo a 1, 2, 3, 4 ou 5 balas.
  - Pirulito raro: 5% de chance independente em caso de vitória (95% de chance de não receber).
  - Taxa de sucesso: `vitórias ÷ (vitórias + derrotas) × 100` (empates excluídos; exibe "—" se 0 decisões).
  - Sorteios com `crypto.getRandomValues` para distribuição criptograficamente uniforme.

### 3.2 Integração das Quatro Tecnologias (HTML, CSS, PHP, Java)
- **HTML**: Marcação semântica dos componentes, acessibilidade de formulários, tabelas e modais.
- **CSS**: Estilos escuros, layout flexbox/grid responsivo, grade do gráfico SVG/Canvas e animações de vitória/derrota/pirulito.
- **Java**: Módulos em `school/java/src/com/balabet/Engine.java` e `Main.java` compiláveis com `javac` e executáveis via linha de comando para autoteste (`selftest`).
- **PHP**: Script `school/php/settle.php` estruturado para receber requisições de liquidação via JSON e encaminhar para validação de regras de negócio.
- **Node.js/Express Server**: Servidor de aplicação que serve o frontend e expõe a rota `POST /api/settle`, executando a ponte de liquidação e fornecendo fallback transparente no cliente.

---

## 4. Diagrama de Arquitetura e Estrutura de Componentes

```
┌────────────────────────────────────────────────────────────────────────┐
│                        BalaBet Frontend (React SPA)                    │
│                                                                        │
│  ┌───────────────────────┐  ┌──────────────────────────────────────┐   │
│  │     TopBar Header     │  │  Abas: Início | Apostar | TOP | Regras│   │
│  └───────────────────────┘  └──────────────────────────────────────┘   │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      Área Principal (Apostar)                    │  │
│  │                                                                  │  │
│  │  ┌────────────────────────┐  ┌────────────────────────────────┐  │  │
│  │  │   Cadastro / Jogadores │  │ Gráfico SVG/Canvas Dinâmico    │  │  │
│  │  │   Controles de Aposta  │  │ (Linhas, Eixos %, Timer 15s)   │  │  │
│  │  └────────────────────────┘  └────────────────────────────────┘  │  │
│  │                                                                  │  │
│  │  ┌────────────────────────┐  ┌────────────────────────────────┐  │  │
│  │  │  Tabela Estatística    │  │  Modal de Resultados           │  │  │
│  │  │  (Vit, Der, %, Saldo)  │  │  (Quadrinhos, Balas, Pirulito) │  │  │
│  │  └────────────────────────┘  └────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (POST /api/settle ou Local Engine)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          Backend & Módulos                             │
│                                                                        │
│  ┌─────────────────────────────┐    ┌───────────────────────────────┐  │
│  │  TypeScript Game Engine     │    │  Express Server (server.ts)   │  │
│  │  (engine.ts, store.ts)      │    │  /api/settle endpoint         │  │
│  └──────────────┬──────────────┘    └──────────────┬────────────────┘  │
│                 │                                  │                   │
│                 ▼                                  ▼                   │
│  ┌─────────────────────────────┐    ┌───────────────────────────────┐  │
│  │  PHP Bridge (settle.php)    │───▶│  Java 17 Engine (Engine.java) │  │
│  │  school/php/settle.php      │    │  school/java/src/com/balabet/ │  │
│  └─────────────────────────────┘    └───────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Plano de Execução por Etapas

1. **Extração e Preservação dos Recursos do Grok**:
   - Extrair e organizar os componentes de `ZRggoQ3soYSpCyny-grok-workspace_5e08f5e6.zip` no projeto.
   - Preservar a pasta `school/` intacta com os códigos Java, PHP e a documentação `ARQUITETURA.md`.
   - Preservar os ativos gráficos `bala.jpg` e `pirulito.jpg` em `public/assets/`.
2. **Estruturação da Aplicação Full-Stack**:
   - Configurar `server.ts` com Express e integração com Vite para servir a aplicação e a rota `/api/settle`.
   - Configurar `metadata.json` com nome "BalaBet" e descrição oficial.
   - Ajustar `index.html` com título e meta-tags corretas.
3. **Refinamento do Shell e Navegação**:
   - Conectar as 4 abas (**Início**, **Apostar**, **TOP**, **Como Jogar**) ao store reativo com persistência em `localStorage`.
   - Garantir que a navegação entre abas não interrompa contagens ou gráficos em andamento.
4. **Validação do Ciclo Completo de 3 Rodadas**:
   - Testar o fluxo de cadastro (até 5 jogadores, nomes únicos, validação de inteiros).
   - Testar bloqueio de apostas, contagem de 3s e gráfico de 15s.
   - Testar quadrinhos de resultados simultâneos e o botão SAIR.
   - Garantir que Rodada 2 e Rodada 3 aguardam configuração de aposta e novo clique em COMEÇAR RODADA.
   - Garantir bloqueio estrito de uma quarta rodada e exibição do Ranking Final.
5. **Verificação dos Módulos Escolares e Testes Unitários**:
   - Verificar testes do motor de liquidação, cálculo de porcentagem de sucesso e distribuição de prêmios.
   - Testar reset com diálogo modal e interrupção completa de temporizadores.
6. **Compilação e Verificação Final**:
   - Executar `compile_applet` e conferir integridade de build.
