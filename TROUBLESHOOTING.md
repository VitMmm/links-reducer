# Решение проблем

## Проблемы с деплоем на Fly.io

### Ошибка: "Volume reducer_data not found"

**Решение:**
Создайте том перед деплоем:
```bash
flyctl volumes create reducer_data --size 1 --region iad
```
Замените `iad` на ваш регион.

### Ошибка: "Cannot connect to database"

**Решение:**
1. Убедитесь, что том создан и подключен:
   ```bash
   flyctl volumes list
   ```

2. Проверьте, что в `fly.toml` есть секция `[[mounts]]`:
   ```toml
   [[mounts]]
     source = "reducer_data"
     destination = "/data"
   ```

3. Проверьте переменную окружения:
   ```bash
   flyctl secrets list
   ```
   Должна быть: `DATABASE_PATH=/data/links.db`

### Ошибка при сборке Docker образа

**Решение:**
1. Проверьте локально:
   ```bash
   docker build -t reducer-test .
   docker run -p 3000:3000 reducer-test
   ```

2. Проверьте логи сборки:
   ```bash
   flyctl deploy --verbose
   ```

### Ошибка: "App reducer-link not found"

**Решение:**
1. Создайте приложение:
   ```bash
   flyctl launch
   ```

2. Или измените название в `fly.toml` на существующее приложение

### GitHub Actions не деплоит

**Решение:**
1. Проверьте, что токен добавлен в Secrets:
   - Settings → Secrets and variables → Actions
   - Должен быть `FLY_API_TOKEN`

2. Проверьте логи GitHub Actions:
   - Перейдите в раздел "Actions"
   - Откройте последний workflow run
   - Посмотрите ошибки

3. Создайте новый токен:
   ```bash
   flyctl tokens create deploy -x 999999h
   ```

## Проблемы с локальным запуском

### Ошибка: "Cannot find module"

**Решение:**
```bash
npm install
```

### Ошибка: "Port 3000 already in use"

**Решение:**
1. Измените порт:
   ```bash
   PORT=3001 npm start
   ```

2. Или остановите процесс на порту 3000:
   ```bash
   # macOS/Linux
   lsof -ti:3000 | xargs kill
   
   # Windows
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F
   ```

### База данных не создается

**Решение:**
1. Проверьте права на запись:
   ```bash
   ls -la
   chmod 755 .
   ```

2. Проверьте путь в `server.js`:
   ```javascript
   const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'links.db');
   ```

## Проблемы с базой данных

### База данных не сохраняется между перезапусками

**Решение:**
1. На Fly.io убедитесь, что том подключен:
   ```bash
   flyctl volumes list
   ```

2. Проверьте, что путь правильный:
   ```bash
   flyctl ssh console
   ls -la /data
   ```

### Ошибка: "SQLITE_CANTOPEN"

**Решение:**
1. Проверьте права на директорию:
   ```bash
   flyctl ssh console
   ls -la /data
   chmod 755 /data
   ```

2. Убедитесь, что директория существует

## Проблемы с API

### CORS ошибки

**Решение:**
В `server.js` уже настроен CORS для всех источников. Если нужно ограничить:
```javascript
app.use(cors({
  origin: ['https://yourdomain.com', 'http://localhost:3000']
}));
```

### API не отвечает

**Решение:**
1. Проверьте логи:
   ```bash
   flyctl logs
   ```

2. Проверьте статус:
   ```bash
   flyctl status
   ```

3. Проверьте, что порт правильный:
   ```bash
   flyctl config show
   ```

## Общие проблемы

### Приложение не запускается

**Решение:**
1. Проверьте логи:
   ```bash
   # Локально
   npm start
   
   # На Fly.io
   flyctl logs
   ```

2. Проверьте зависимости:
   ```bash
   npm install
   ```

3. Проверьте версию Node.js:
   ```bash
   node --version  # Должна быть 18+
   ```

### Как получить помощь

1. Проверьте логи:
   ```bash
   flyctl logs
   ```

2. Проверьте статус:
   ```bash
   flyctl status
   ```

3. Проверьте конфигурацию:
   ```bash
   flyctl config show
   ```

4. Опишите проблему:
   - Какая команда вызвала ошибку?
   - Какой текст ошибки?
   - Что вы уже пробовали?

## Частые ошибки и решения

### "Error: spawn ENOENT"
- Проблема: Не установлены зависимости
- Решение: `npm install`

### "Error: listen EADDRINUSE"
- Проблема: Порт занят
- Решение: Измените порт или остановите процесс

### "Database locked"
- Проблема: База данных используется другим процессом
- Решение: Перезапустите приложение

### "Cannot read property 'x' of undefined"
- Проблема: Ошибка в коде
- Решение: Проверьте логи и исправьте код
