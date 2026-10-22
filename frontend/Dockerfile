FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install -g npm@latest && npm install

COPY . .

EXPOSE 5173

# A flag --host expõe o servidor do Vite para fora do container Docker
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]