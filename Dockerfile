# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# PocketBase URL injetada durante o build do Vite
ARG VITE_POCKETBASE_URL="https://pb-casadolago.janagencia.com.br"
ENV VITE_POCKETBASE_URL=$VITE_POCKETBASE_URL

RUN npm run build

# Stage 2: Runtime Nginx
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
