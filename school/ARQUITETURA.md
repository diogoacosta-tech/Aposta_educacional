# BalaBet — arquitetura

Simulação local de apostas com balas virtuais. Não há dinheiro, cadastro de usuários, nem disputa entre aparelhos diferentes.

## Onde cada tecnologia atua

- **HTML semântico** sai das páginas da aplicação: cadastro, apostas, gráfico, tabela, ranking, quadrinhos e regras.
- **CSS** está em `src/styles.css`: paleta escura, painéis, botões e animações de vitória, derrota e pirulito.
- **PHP** (`school/php/settle.php`) recebe o JSON da rodada, valida jogadores, modos, direções e inteiros, e só então chama o Java. Não sorteia prêmio nem mexe em saldo sozinho.
- **Java** (`school/java`) é o motor da liquidação: direção do último segmento, pesos 28/28/22/11/6, pirulito de 5% e saldo final. O gráfico não entra nessa conta.

O navegador desenha o gráfico e mede os 3 e os 15 segundos com o relógio real. Quando o tempo acaba, envia a direção já visível de cada linha para `POST /api/settle`. Esse caminho executa o PHP, que executa o Java. O resultado só é aplicado se a mesma conta, repetida no cliente com as rolagens devolvidas pelo Java, bater. Se o PHP ou o Java não estiverem disponíveis (por exemplo num ambiente sem esses binários), a mesma fórmula roda no navegador para a disputa não travar. Uma rodada liquidada não é aplicada de novo.

## Estado

A disputa fica na memória do navegador e em `localStorage` (`balabet-dispute-v1`). Não há banco. Atualizar a página no meio da contagem ou do gráfico volta para a preparação daquela rodada, porque o saldo ainda não foi debitado. O reset apaga a disputa e não apaga a imagem personalizada da bala ou do pirulito (`balabet-art-v1`).

## Como executar os módulos escolares

Java 17:

```
javac -encoding UTF-8 -d school/java/build school/java/src/com/balabet/*.java
java -cp school/java/build com.balabet.Main selftest
```

PHP, a partir da pasta do projeto, com o binário em `school/bin/php`:

```
printf '%s' '{"players":[{"id":"joao","balance":2,"stake":1,"mode":"subir","direction":"up","prizeRoll":56,"lollipopRoll":0}]}' | school/bin/php school/php/settle.php
```

A interface sobe com o servidor web do projeto. O script `startup.sh` compila o Java se ainda não houver classes e inicia a aplicação.

## Limitações

- Uma disputa por navegador. Não é multijogador em rede.
- O binário de PHP acompanha o projeto porque o sistema não tinha PHP instalado.
- Fora deste ambiente, se `java` ou o PHP não puderem ser executados, a liquidação usa a fórmula equivalente no navegador.
- Perdas muito grandes desenham até 4000 ícones; o número anunciado continua sendo o valor inteiro perdido.
