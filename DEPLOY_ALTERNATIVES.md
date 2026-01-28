# Варианты деплоя (без Fly.io)

Все способы запустить приложение на сервере с GitHub. Fly.io не обязателен.

---

## 1. Railway — самый простой

**Плюсы:** Подключил репозиторий → всё само задеплоилось. Не нужен CLI, только браузер.

1. Зайти на [railway.app](https://railway.app) и войти через GitHub.
2. **New Project** → **Deploy from GitHub repo** → выбрать репозиторий `reducer`.
3. Railway сам определит Node.js, сделает `npm install` и `npm start`.
4. В настройках сервиса: **Settings** → **Generate Domain** → получите URL вида `https://reducer-production.up.railway.app`.

Никаких `fly.toml`, Dockerfile и токенов — только GitHub + Railway в браузере.

**Документация:** [DEPLOY.md](./DEPLOY.md)

---

## 2. Render

**Плюсы:** Бесплатный план, деплой из GitHub, не нужен CLI.

1. Зайти на [render.com](https://render.com), войти через GitHub.
2. **New** → **Web Service**.
3. Подключить репозиторий `reducer`.
4. Указать:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** добавить переменную `PORT` = `3000` (если попросит).
5. Создать сервис — Render выдаст URL.

**Документация:** в [README.md](./README.md) есть краткий пункт про Render.

---

## 3. Собственный сервер (VPS)

**Плюсы:** Полный контроль, свой домен, нет ограничений бесплатных планов.

1. Арендовать VPS (DigitalOcean, Timeweb, Selectel и т.п.).
2. Подключиться по SSH и выполнить шаги из инструкции.

**Документация:** [DEPLOY_VPS.md](./DEPLOY_VPS.md) — установка Node.js, PM2, Nginx, SSL.

Кратко:
```bash
git clone https://github.com/ваш-username/reducer.git
cd reducer
npm install
npm install -g pm2
pm2 start server.js --name reducer
pm2 save && pm2 startup
```

---

## 4. GitHub Pages + отдельный backend

Фронтенд (HTML/JS) на GitHub Pages, API — на любом сервере (Railway, Render, VPS).

1. Задеплоить backend на Railway или Render (как в п.1 или п.2).
2. В `index.html` заменить:
   ```javascript
   const API_BASE_URL = 'https://ваш-backend.railway.app';  // или URL с Render
   ```
3. Включить GitHub Pages в репозитории: **Settings** → **Pages** → источник `main` branch.

Сайт будет на `https://ваш-username.github.io/reducer`, запросы уйдут на ваш backend.

**Документация:** [DEPLOY.md](./DEPLOY.md) (гибридный вариант).

---

## Сравнение

| Вариант           | Сложность | Нужен CLI | Бесплатно | Автодеплой с GitHub |
|-------------------|-----------|-----------|-----------|----------------------|
| **Railway**       | Низкая    | Нет       | Да*       | Да                   |
| **Render**        | Низкая    | Нет       | Да*       | Да                   |
| **Свой VPS**      | Выше      | SSH       | Зависит   | Настраивается        |
| **GitHub Pages + backend** | Средняя | Нет   | Да        | Да                   |

\* У Railway и Render есть лимиты бесплатного плана.

---

## Что выбрать

- **Хочу минимум действий** → Railway: репо в GitHub + один раз нажать Deploy в браузере.
- **Не хочу Fly.io** → Railway или Render.
- **Есть свой сервер** → [DEPLOY_VPS.md](./DEPLOY_VPS.md).
- **Нужен свой домен** → VPS или настройка домена в Railway/Render.

Файлы для Fly.io (`fly.toml`, `Dockerfile`, workflow для Fly) можно не трогать — они не мешают деплою на Railway или Render.
