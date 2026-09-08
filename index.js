const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const port = Number(process.env.PORT) || 3000;

// CORS: в проде задавайте ALLOWED_ORIGIN=https://your.domain
const allowedOrigin = process.env.ALLOWED_ORIGIN;
app.use(cors(allowedOrigin ? { origin: allowedOrigin.split(',').map(s => s.trim()) } : undefined));
app.use(express.json({ limit: '1mb' }));

const db = new Database('./database.sqlite');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// id — TEXT: фронт генерирует строковые id ('srv_...', 'fixed_container_3')
db.exec(`
    CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        price REAL NOT NULL CHECK (price >= 0),
        category TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        project TEXT DEFAULT '',
        service_id TEXT NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
        quantity REAL NOT NULL CHECK (quantity > 0)
    );
    CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);
    CREATE INDEX IF NOT EXISTS idx_entries_service ON entries(service_id);
`);

// ---------- Валидация ----------
const genId = (prefix) => prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);

const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

function validateServiceBody(body, partial = false) {
    const errors = [];
    if (!partial || body.name !== undefined) {
        if (typeof body.name !== 'string' || !body.name.trim()) errors.push('name обязателен');
    }
    if (body.price !== undefined) {
        const price = Number(body.price);
        if (!Number.isFinite(price) || price < 0) errors.push('price должен быть числом >= 0');
    } else if (!partial) {
        errors.push('price обязателен');
    }
    if (body.category !== undefined && typeof body.category !== 'string') errors.push('category должен быть строкой');
    return errors;
}

// Обёртка: better-sqlite3 синхронный, любое исключение -> 500, а не зависший запрос
const h = (fn) => (req, res) => {
    try {
        fn(req, res);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
};

// ---------- API: услуги ----------
app.get('/api/services', h((req, res) => {
    res.json(db.prepare('SELECT * FROM services ORDER BY category, name').all());
}));

app.post('/api/services', h((req, res) => {
    const errors = validateServiceBody(req.body || {});
    if (errors.length) return res.status(400).json({ error: errors.join('; ') });

    const id = genId('srv');
    const { name, category } = req.body;
    const price = Number(req.body.price);
    db.prepare('INSERT INTO services (id, name, price, category) VALUES (?, ?, ?, ?)')
        .run(id, name.trim(), price, category || '');
    res.status(201).json(db.prepare('SELECT * FROM services WHERE id = ?').get(id));
}));

app.put('/api/services/:id', h((req, res) => {
    const errors = validateServiceBody(req.body || {}, true);
    if (errors.length) return res.status(400).json({ error: errors.join('; ') });
    if (!Object.keys(req.body || {}).length) return res.status(400).json({ error: 'Нет данных для обновления' });

    const updates = [];
    const values = [];
    if (req.body.name !== undefined) { updates.push('name = ?'); values.push(String(req.body.name).trim()); }
    if (req.body.price !== undefined) { updates.push('price = ?'); values.push(Number(req.body.price)); }
    if (req.body.category !== undefined) { updates.push('category = ?'); values.push(String(req.body.category)); }
    values.push(req.params.id);

    const info = db.prepare(`UPDATE services SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    if (info.changes === 0) return res.status(404).json({ error: 'Услуга не найдена' });
    res.json(db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id));
}));

app.delete('/api/services/:id', h((req, res) => {
    try {
        const info = db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id);
        if (info.changes === 0) return res.status(404).json({ error: 'Услуга не найдена' });
        res.json({ message: 'Удалено' });
    } catch (err) {
        // FK RESTRICT: у услуги есть записи
        if (String(err.code).startsWith('SQLITE_CONSTRAINT')) {
            return res.status(409).json({ error: 'Нельзя удалить услугу: есть связанные записи' });
        }
        throw err;
    }
}));

// ---------- API: записи ----------
app.get('/api/entries', h((req, res) => {
    res.json(db.prepare('SELECT * FROM entries ORDER BY date DESC').all());
}));

app.post('/api/entries', h((req, res) => {
    const { date, project, service_id, quantity } = req.body || {};
    if (!isDate(date)) return res.status(400).json({ error: 'date обязателен (YYYY-MM-DD)' });
    if (service_id === undefined || service_id === null) return res.status(400).json({ error: 'service_id обязателен' });
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ error: 'quantity должен быть числом > 0' });

    const service = db.prepare('SELECT id FROM services WHERE id = ?').get(String(service_id));
    if (!service) return res.status(400).json({ error: 'Услуга с таким ID не найдена' });

    const id = genId('entry');
    db.prepare('INSERT INTO entries (id, date, project, service_id, quantity) VALUES (?, ?, ?, ?, ?)')
        .run(id, date, project || '', String(service_id), qty);
    res.status(201).json(db.prepare('SELECT * FROM entries WHERE id = ?').get(id));
}));

app.put('/api/entries/:id', h((req, res) => {
    const { date, project, service_id, quantity } = req.body || {};
    if (!isDate(date)) return res.status(400).json({ error: 'date обязателен (YYYY-MM-DD)' });
    if (service_id === undefined || service_id === null) return res.status(400).json({ error: 'service_id обязателен' });
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ error: 'quantity должен быть числом > 0' });

    const service = db.prepare('SELECT id FROM services WHERE id = ?').get(String(service_id));
    if (!service) return res.status(400).json({ error: 'Услуга с таким ID не найдена' });

    const info = db.prepare('UPDATE entries SET date = ?, project = ?, service_id = ?, quantity = ? WHERE id = ?')
        .run(date, project || '', String(service_id), qty, req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: 'Запись не найдена' });
    res.json(db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id));
}));

app.delete('/api/entries/:id', h((req, res) => {
    const info = db.prepare('DELETE FROM entries WHERE id = ?').run(req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: 'Запись не найдена' });
    res.json({ message: 'Удалено' });
}));

// ---------- Статика и SPA-fallback ----------
app.use(express.static(__dirname));

// Работает и в Express 4, и в Express 5 (в отличие от app.get('*', ...))
app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Graceful shutdown
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
function shutdown(signal) {
    console.log(`Получен ${signal}, завершаем работу...`);
    server.close(() => {
        db.close();
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 3000).unref();
}

const server = app.listen(port, () => {
    console.log(`Сервер запущен на порту ${port}`);
});
