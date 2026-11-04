FROM node:22-alpine
WORKDIR /app
COPY backend/package.json backend/package-lock.json* ./
RUN npm install --omit=dev
COPY backend ./
COPY config.json /app/config.json
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "src/server.js"]
