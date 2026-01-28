# Деплой на собственный сервер (VPS)

## Требования

- Сервер с Linux (Ubuntu/Debian рекомендуется)
- Доступ по SSH
- Node.js 18+ (или установим)
- Домен (опционально, но рекомендуется)

## Шаг 1: Подключение к серверу

```bash
ssh user@your-server-ip
```

## Шаг 2: Установка Node.js (если не установлен)

### Для Ubuntu/Debian:

```bash
# Обновляем систему
sudo apt update && sudo apt upgrade -y

# Устанавливаем Node.js через NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Проверяем версию
node --version
npm --version
```

### Для CentOS/RHEL:

```bash
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
```

## Шаг 3: Клонирование репозитория

```bash
# Переходим в домашнюю директорию или создаем папку для проектов
cd ~
mkdir -p projects
cd projects

# Клонируем репозиторий (замените на ваш URL)
git clone https://github.com/your-username/reducer.git
cd reducer

# Или загрузите файлы через SCP:
# scp -r /local/path/to/reducer user@server:/home/user/projects/
```

## Шаг 4: Установка зависимостей

```bash
cd ~/projects/reducer
npm install
```

## Шаг 5: Настройка переменных окружения (опционально)

```bash
# Создаем файл .env
nano .env
```

Добавьте (если нужно):
```
PORT=3000
ALLOWED_ORIGINS=https://yourdomain.com,http://localhost:3000
```

## Шаг 6: Тестовый запуск

```bash
npm start
```

Проверьте, что сервер запустился. Нажмите `Ctrl+C` для остановки.

## Шаг 7: Установка PM2 для автозапуска

PM2 - это менеджер процессов для Node.js, который обеспечит автозапуск и перезапуск при сбоях.

```bash
# Устанавливаем PM2 глобально
sudo npm install -g pm2

# Запускаем приложение через PM2
cd ~/projects/reducer
pm2 start server.js --name reducer

# Сохраняем конфигурацию для автозапуска
pm2 save
pm2 startup

# Выполните команду, которую покажет pm2 startup (обычно что-то вроде):
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u your-username --hp /home/your-username
```

### Полезные команды PM2:

```bash
pm2 list              # Список процессов
pm2 logs reducer       # Логи приложения
pm2 restart reducer    # Перезапуск
pm2 stop reducer       # Остановка
pm2 delete reducer     # Удаление из PM2
pm2 monit              # Мониторинг в реальном времени
```

## Шаг 8: Настройка Nginx (опционально, но рекомендуется)

Если у вас есть домен и вы хотите использовать его вместо IP:порт.

### Установка Nginx:

```bash
sudo apt install nginx -y
```

### Создание конфигурации:

```bash
sudo nano /etc/nginx/sites-available/reducer
```

Добавьте конфигурацию:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Активация конфигурации:

```bash
# Создаем символическую ссылку
sudo ln -s /etc/nginx/sites-available/reducer /etc/nginx/sites-enabled/

# Проверяем конфигурацию
sudo nginx -t

# Перезапускаем Nginx
sudo systemctl restart nginx
```

### Настройка SSL (HTTPS) через Let's Encrypt:

```bash
# Устанавливаем Certbot
sudo apt install certbot python3-certbot-nginx -y

# Получаем SSL сертификат
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Certbot автоматически обновит конфигурацию Nginx
# Сертификат будет автоматически обновляться
```

## Шаг 9: Настройка файрвола

```bash
# Разрешаем HTTP и HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Если используете напрямую порт 3000 (без Nginx)
sudo ufw allow 3000/tcp

# Включаем файрвол
sudo ufw enable
```

## Шаг 10: Проверка работы

1. Если используете Nginx: откройте `http://yourdomain.com` или `https://yourdomain.com`
2. Если без Nginx: откройте `http://your-server-ip:3000`

## Обновление приложения

Когда нужно обновить код:

```bash
cd ~/projects/reducer

# Получаем последние изменения
git pull

# Или загружаете новые файлы через SCP

# Устанавливаем новые зависимости (если есть)
npm install

# Перезапускаем через PM2
pm2 restart reducer
```

## Резервное копирование базы данных

База данных находится в файле `links.db`. Рекомендуется настроить автоматическое резервное копирование:

```bash
# Создаем скрипт для бэкапа
nano ~/backup-reducer.sh
```

Добавьте:

```bash
#!/bin/bash
BACKUP_DIR="/home/your-username/backups"
PROJECT_DIR="/home/your-username/projects/reducer"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
cp $PROJECT_DIR/links.db $BACKUP_DIR/links_$DATE.db

# Удаляем старые бэкапы (старше 30 дней)
find $BACKUP_DIR -name "links_*.db" -mtime +30 -delete
```

Сделайте исполняемым:

```bash
chmod +x ~/backup-reducer.sh
```

Добавьте в crontab для автоматического бэкапа:

```bash
crontab -e
```

Добавьте строку (бэкап каждый день в 3:00):

```
0 3 * * * /home/your-username/backup-reducer.sh
```

## Мониторинг и логи

```bash
# Логи PM2
pm2 logs reducer

# Логи Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Системные логи
journalctl -u nginx -f
```

## Устранение проблем

### Приложение не запускается:

```bash
# Проверьте логи
pm2 logs reducer

# Проверьте, что порт свободен
sudo netstat -tulpn | grep 3000

# Проверьте права доступа к файлам
ls -la ~/projects/reducer
```

### Nginx не работает:

```bash
# Проверьте статус
sudo systemctl status nginx

# Проверьте конфигурацию
sudo nginx -t

# Проверьте логи
sudo tail -f /var/log/nginx/error.log
```

### База данных не создается:

```bash
# Проверьте права на запись в директории
ls -la ~/projects/reducer
chmod 755 ~/projects/reducer
```

## Быстрая установка (одной командой)

Если у вас уже установлены Node.js и PM2:

```bash
cd ~ && \
git clone https://github.com/your-username/reducer.git projects/reducer && \
cd projects/reducer && \
npm install && \
pm2 start server.js --name reducer && \
pm2 save && \
pm2 startup
```

## Готово! 🎉

Ваше приложение должно работать на вашем сервере. Если возникнут проблемы, проверьте логи через `pm2 logs reducer`.
