# Imagem base do Node.js
FROM node:20-alpine

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package.json package-lock.json ./

# Instalar dependências
RUN npm ci

# Copiar o restante dos arquivos do projeto
COPY . .

# Expor a porta que o Vite usa (internamente)
EXPOSE 3000

# Comando para iniciar o servidor de desenvolvimento
CMD ["npm", "run", "dev"]
