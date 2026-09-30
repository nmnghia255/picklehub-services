FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN --mount=type=cache,id=global-npm-cache,sharing=locked,target=/root/.npm npm ci

COPY . .

RUN npx prisma generate

EXPOSE 8029

CMD ["npm", "run", "start:dev"]
