# Usa la imagen base de Node.js
FROM node:16-alpine

# Crear y establecer el directorio de trabajo en el contenedor
WORKDIR /usr/src/app

# Copiar el package.json y package-lock.json (o pnpm-lock.yaml si usas pnpm)
COPY package*.json ./
# Si usas pnpm, también copia pnpm-lock.yaml
# COPY pnpm-lock.yaml ./

# Instalar las dependencias
RUN npm install
# Si usas pnpm, puedes usar RUN pnpm install

# Copiar el código fuente de la aplicación al contenedor
COPY . .

# Exponer el puerto en el que la app corre
EXPOSE 3000

# Comando para iniciar la aplicación
CMD ["npm", "start"]
