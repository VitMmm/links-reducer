const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// Настройка CORS для работы с GitHub Pages
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:5502'];

app.use(cors({
  origin: function (origin, callback) {
    // Разрешаем запросы без origin (например, Postman) и из разрешенных источников
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Разрешаем все для упрощения, можно ужесточить
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Инициализация базы данных
// На Fly.io используем персистентный том для базы данных
// В локальной разработке используем links.db в корне проекта
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'links.db');
const db = new Database(dbPath);

// Создание таблицы, если её нет
db.exec(`
  CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    long_url TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Подготовленные запросы для оптимизации
const insertLink = db.prepare('INSERT INTO links (slug, long_url) VALUES (?, ?)');
const getLinkBySlug = db.prepare('SELECT long_url FROM links WHERE slug = ?');
const checkSlugExists = db.prepare('SELECT COUNT(*) as count FROM links WHERE slug = ?');

// API: Создание короткой ссылки
app.post('/api/links', (req, res) => {
  try {
    const { longUrl, slug } = req.body;

    if (!longUrl) {
      return res.status(400).json({ error: 'Длинная ссылка обязательна' });
    }

    // Валидация URL
    let processedUrl = longUrl.trim();
    if (!processedUrl.startsWith('http://') && !processedUrl.startsWith('https://')) {
      processedUrl = 'https://' + processedUrl;
    }

    try {
      new URL(processedUrl);
    } catch (e) {
      return res.status(400).json({ error: 'Некорректная ссылка' });
    }

    // Определяем slug
    let finalSlug = slug ? slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '') : null;

    if (finalSlug) {
      // Проверяем уникальность пользовательского slug
      const exists = checkSlugExists.get(finalSlug);
      if (exists.count > 0) {
        return res.status(400).json({ error: 'Такой суффикс уже используется' });
      }
    } else {
      // Генерируем случайный slug
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      do {
        finalSlug = '';
        for (let i = 0; i < 8; i++) {
          finalSlug += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const exists = checkSlugExists.get(finalSlug);
        if (exists.count === 0) break;
      } while (true);
    }

    // Сохраняем в базу данных
    try {
      insertLink.run(finalSlug, processedUrl);
      res.json({ 
        success: true, 
        slug: finalSlug, 
        shortUrl: `${req.protocol}://${req.get('host')}/#${finalSlug}`,
        longUrl: processedUrl
      });
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(400).json({ error: 'Такой суффикс уже используется' });
      }
      throw error;
    }
  } catch (error) {
    console.error('Ошибка при создании ссылки:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// API: Получение длинной ссылки по slug
app.get('/api/links/:slug', (req, res) => {
  try {
    const { slug } = req.params;
    const result = getLinkBySlug.get(slug);

    if (!result) {
      return res.status(404).json({ error: 'Ссылка не найдена' });
    }

    res.json({ 
      success: true, 
      slug: slug, 
      longUrl: result.long_url 
    });
  } catch (error) {
    console.error('Ошибка при получении ссылки:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Редирект по хешу в URL
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  console.log(`Откройте http://localhost:${PORT} в браузере`);
});
