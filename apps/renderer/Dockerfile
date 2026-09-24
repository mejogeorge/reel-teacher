# Renderer worker: Chromium + ffmpeg for Remotion. Build context = repo root.
FROM node:22-bookworm-slim

# Remotion / Chrome Headless Shell runtime deps + ffmpeg + fonts.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libdbus-1-3 libatk1.0-0 libgbm1 libasound2 libxrandr2 \
    libxkbcommon0 libxfixes3 libxcomposite1 libxdamage1 libatk-bridge2.0-0 \
    libpango-1.0-0 libcairo2 libcups2 libxrender1 libxext6 libx11-6 \
    fonts-liberation ca-certificates ffmpeg \
  && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /app
COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @wordcast/shared build \
 && pnpm --filter @wordcast/video build \
 && pnpm --filter @wordcast/renderer build

# Pre-download the headless browser so first render is fast.
RUN cd apps/renderer && pnpm exec remotion browser ensure

CMD ["node", "apps/renderer/dist/index.js"]
