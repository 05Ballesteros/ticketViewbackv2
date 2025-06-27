# Etapa de build
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm config set registry https://registry.npmmirror.com && npm install

COPY . .
RUN npm run build

# Etapa final
FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm config set registry https://registry.npmmirror.com && npm install --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/*.json .

EXPOSE 4200
CMD ["node", "dist/main"]
