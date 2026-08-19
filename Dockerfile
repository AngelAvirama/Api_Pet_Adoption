FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --include=dev

COPY . .

RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "start"]