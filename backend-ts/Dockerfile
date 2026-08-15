FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .

RUN npx prisma generate
RUN npm run build || true # Build if there is a build step, otherwise ignore

EXPOSE 3000

CMD ["npx", "tsx", "src/index.ts"]
