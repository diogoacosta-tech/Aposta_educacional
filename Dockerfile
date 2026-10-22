
FROM node:22-bookworm-slim

WORKDIR /app

# Instala PHP CLI e Java para o motor escolar
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       php-cli \
       openjdk-17-jdk-headless \
    && rm -rf /var/lib/apt/lists/*

# Copia o projeto
COPY . .

# Instala dependências JavaScript
RUN npm install


# Compila o motor Java usando UTF-8
RUN mkdir -p school/java/build \
    && javac -encoding UTF-8 -d school/java/build school/java/src/com/balabet/*.java


# Compila a interface
RUN npm run build

# Configura o servidor em produção
ENV NODE_ENV=production
ENV BALABET_PHP=/usr/bin/php

EXPOSE 10000

CMD ["node", "--experimental-strip-types", "server.ts"]
