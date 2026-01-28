# Используем официальный Node.js образ
FROM node:18-alpine

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci --only=production

# Копируем остальные файлы
COPY . .

# Создаем директорию для базы данных (если том не подключен)
RUN mkdir -p /data

# Открываем порт
EXPOSE 3000

# Запускаем приложение
CMD ["node", "server.js"]
