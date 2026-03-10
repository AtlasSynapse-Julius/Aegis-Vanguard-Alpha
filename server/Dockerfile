# Aegis Vanguard — Node + Python API (runs from project root)
FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Server
COPY server/package*.json server/tsconfig.json server/
RUN cd server && npm install
COPY server/src server/src
RUN cd server && npm run build

# Client build (so API can serve it in production)
COPY client/package*.json client/tsconfig.json client/tsconfig.node.json client/index.html client/
COPY client/vite.config.ts client/postcss.config.js client/tailwind.config.js client/
COPY client/src client/src
RUN cd client && npm install && npm i --save-dev @types/node && npm run build

# Python / DeepTeam (project root) — install so scanner can import deepteam
COPY pyproject.toml poetry.lock README.md ./
COPY deepteam deepteam
RUN PIP_BREAK_SYSTEM_PACKAGES=1 pip3 install --no-cache-dir --break-system-packages poetry && \
    poetry config virtualenvs.create false && \
    (export PIP_BREAK_SYSTEM_PACKAGES=1 && poetry install --no-interaction --without dev --no-root) && \
    pip3 install --no-cache-dir --break-system-packages -e .
COPY scanner scanner
RUN pip3 install --no-cache-dir --break-system-packages -r scanner/requirements.txt

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

# Run from project root so scanner and deepteam are in path
CMD ["node", "server/dist/index.js"]
