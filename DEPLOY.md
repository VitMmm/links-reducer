# Инструкция по деплою

## Вариант 1: GitHub Pages (фронтенд) + Railway/Render (backend)

### Шаг 1: Деплой backend на Railway

1. Зарегистрируйтесь на [railway.app](https://railway.app)
2. Создайте новый проект
3. Подключите GitHub репозиторий
4. Railway автоматически определит Node.js и запустит сервер
5. Получите URL вашего backend (например: `https://reducer-backend.railway.app`)

### Шаг 2: Настройка фронтенда для GitHub Pages

1. В файле `index.html` найдите строку:
   ```javascript
   const API_BASE_URL = window.location.origin;
   ```

2. Замените на:
   ```javascript
   const API_BASE_URL = 'https://your-backend.railway.app'; // URL вашего backend
   ```

3. Закомментируйте или удалите строки с `server.js` из репозитория (они не нужны для GitHub Pages)

4. Включите GitHub Pages в настройках репозитория:
   - Settings → Pages
   - Source: `main` branch
   - Folder: `/ (root)`

5. Ваш сайт будет доступен по адресу: `https://ваш-username.github.io/reducer`

### Шаг 3: Настройка CORS на backend

Убедитесь, что в `server.js` включен CORS для вашего GitHub Pages домена:

```javascript
app.use(cors({
  origin: ['https://ваш-username.github.io', 'http://localhost:3000']
}));
```

## Вариант 2: Полный деплой на Railway (рекомендуется)

1. Зарегистрируйтесь на [railway.app](https://railway.app)
2. Создайте новый проект
3. Подключите GitHub репозиторий
4. Railway автоматически:
   - Определит Node.js
   - Установит зависимости
   - Запустит сервер
5. Получите домен вида: `https://reducer-production.railway.app`

**Преимущества:**
- Все в одном месте
- Автоматический деплой при пуше в GitHub
- Бесплатный план доступен

## Вариант 3: GitHub Actions + Railway

Используйте готовый workflow файл `.github/workflows/deploy.yml`

1. Получите Railway token:
   - Railway Dashboard → Account → Tokens
   - Создайте новый token

2. Добавьте token в GitHub Secrets:
   - Settings → Secrets and variables → Actions
   - New repository secret
   - Name: `RAILWAY_TOKEN`
   - Value: ваш Railway token

3. При каждом пуше в `main`/`master` автоматически произойдет деплой на Railway

## Структура для GitHub Pages

Если используете GitHub Pages, структура должна быть:

```
reducer/
├── index.html          # Главная страница
├── .gitignore
└── README.md
```

Файлы `server.js`, `package.json`, `links.db` не нужны для GitHub Pages (они используются только на backend сервере).
