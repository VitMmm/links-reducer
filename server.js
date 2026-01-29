// Простой backend для Railway
require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const fs = require('fs');

const PORT = process.env.PORT || 3000;
const SQLITE_FILE = process.env.SQLITE_FILE || path.join(__dirname, 'data.db');

// Конфиг Cloudinary (подхватит CLOUDINARY_URL автоматически)
if (process.env.CLOUDINARY_URL) {
  cloudinary.config({ cloudinary_url: process.env.CLOUDINARY_URL });
} else {
  // если используется набор переменных
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }
}

const app = express();

// Инициализация БД (SQLite)
const db = new sqlite3.Database(SQLITE_FILE, (err) => {
  if (err) {
    console.error('Не удалось открыть БД:', err);
    process.exit(1);
  }
});

db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS links (
      slug TEXT PRIMARY KEY,
      longUrl TEXT NOT NULL,
      imageUrl TEXT,
      createdAt INTEGER NOT NULL
    )`
  );
});

// Утилиты
function generateSlug() {
  return crypto.randomBytes(3).toString('hex'); // 6 hex chars
}

function normalizeSlug(slug) {
  if (!slug) return null;
  return String(slug).trim().toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-');
}

function ensureUniqueSlug(proposed) {
  return new Promise((resolve, reject) => {
    const trySlug = (s) => {
      db.get('SELECT slug FROM links WHERE slug = ?', [s], (err, row) => {
        if (err) return reject(err);
        if (row) {
          // collision -> new random
          trySlug(generateSlug());
        } else {
          resolve(s);
        }
      });
    };
    trySlug(proposed || generateSlug());
  });
}

// Мидлвары
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Статические файлы (фронтенд находится в корне проекта)
app.use(express.static(path.join(__dirname)));

// Загрузка файлов в Cloudinary
const upload = multer({ storage: multer.memoryStorage() });
// Поддержка двух режимов загрузки:
// 1) Cloudinary — если настроен через CLOUDINARY_URL или CLOUDINARY_*
// 2) Локальное сохранение в /uploads — если Cloudinary не настроен (временно, подходит для быстрой деплоя на Railway)
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  } catch (err) {
    console.error('Не удалось создать папку uploads:', err);
  }
}

app.post('/api/uploads', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    // Если Cloudinary настроен — используем его
    if (cloudinary.config().cloud_name) {
      const streamifier = require('streamifier');
      const stream = cloudinary.uploader.upload_stream({ folder: 'reducer' }, (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          return res.status(500).json({ error: 'Upload failed' });
        }
        res.json({ url: result.secure_url });
      });
      streamifier.createReadStream(req.file.buffer).pipe(stream);
      return;
    }

    // Иначе сохраняем файл локально в /uploads и возвращаем публичный URL
    const ext = path.extname(req.file.originalname) || '';
    const filename = Date.now() + '-' + crypto.randomBytes(4).toString('hex') + ext;
    const filepath = path.join(UPLOAD_DIR, filename);
    await fs.promises.writeFile(filepath, req.file.buffer);

    const publicUrl = `${req.protocol}://${req.get('host')}/uploads/${encodeURIComponent(filename)}`;
    console.warn('Cloudinary not configured — using local uploads. Uploaded file available at', publicUrl);
    return res.json({ url: publicUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload error' });
  }
});

// Создать короткую ссылку
app.post('/api/links', async (req, res) => {
  try {
    const { longUrl, slug, imageUrl } = req.body || {};
    if (!longUrl) return res.status(400).json({ error: 'longUrl is required' });

    const normalized = normalizeSlug(slug) || null;
    const chosenSlug = await ensureUniqueSlug(normalized || generateSlug());

    const createdAt = Date.now();
    db.run(
      'INSERT INTO links (slug, longUrl, imageUrl, createdAt) VALUES (?, ?, ?, ?)',
      [chosenSlug, longUrl, imageUrl || null, createdAt],
      function (err) {
        if (err) {
          console.error('DB insert error:', err);
          return res.status(500).json({ error: 'DB error' });
        }
        res.json({ slug: chosenSlug, imageUrl: imageUrl || null });
      }
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Получить данные ссылки по slug (JSON)
app.get('/api/links/:slug', (req, res) => {
  const slug = req.params.slug;
  db.get('SELECT longUrl, imageUrl FROM links WHERE slug = ?', [slug], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'DB error' });
    }
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json({ longUrl: row.longUrl, imageUrl: row.imageUrl || null });
  });
});

// Универсальный обработчик для /:slug — отдаёт HTML с OG meta и редиректом (важно для social preview)
app.get('/:slug', (req, res, next) => {
  const slug = req.params.slug;
  // пропускаем запросы к реальным файлам (index.html и т.д.)
  if (!slug || slug.indexOf('.') !== -1) return next();

  db.get('SELECT longUrl, imageUrl FROM links WHERE slug = ?', [slug], (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Server error');
    }
    if (!row) return res.status(404).send('Not found');

    const longUrl = row.longUrl;
    const imageUrl = row.imageUrl || '';

    const html = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Redirecting…</title>
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Перейти по ссылке" />
    <meta property="og:description" content="Переход по короткой ссылке" />
    ${imageUrl ? `<meta property="og:image" content="${imageUrl}" />` : ''}
    <meta http-equiv="refresh" content="0;url=${longUrl}">
    <script>window.location.replace(${JSON.stringify(longUrl)});</script>
  </head>
  <body>
    <p>Redirecting to <a href="${longUrl}">${longUrl}</a></p>
  </body>
</html>`;

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  });
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});

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
