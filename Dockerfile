# DraftVersus — Coolify / VPS imajı
FROM node:20-alpine

WORKDIR /app

# Önce sadece bağımlılıklar (katman cache için)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Uygulama dosyaları
COPY . .

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
