const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const db = new Database('./database.sqlite');

db.exec(`
    CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        category TEXT
    );
    CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        project TEXT,
        service_id INTEGER NOT NULL,
        quantity REAL NOT NULL,
        FOREIGN KEY (service_id) REFERENCES services(id)
    );
`);

// API для услуг
app.get('/api/services', (req, res) => {
    const stmt = db.prepare('SELECT * FROM services');
    res.json(stmt.all());
});

app.post('/api/services', (req, res) => {
    const { name, price, category } = req.body;
    if (!name || price == null) return res.status(400).json({ error: 'Название и цена обязательны' });
    const stmt = db.prepare('INSERT INTO services (name, price, category) VALUES (?, ?, ?)');
    const info = stmt.run(name, parseFloat(price), category || '');
    const newService = db.prepare('SELECT * FROM services WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(newService);
});

app.put('/api/services/:id', (req, res) => {
    const { id } = req.params;
    const { name, price, category } = req.body;
    // Проверяем, что передан хоть какой-то параметр
    if (name === undefined && price === undefined && category === undefined) {
        return res.status(400).json({ error: 'Нет данных для обновления' });
    }
    // Собираем поля для обновления
    let updates = [];
    let values = [];
    if (name !== undefined) {
        updates.push('name = ?');
        values.push(name);
    }
    if (price !== undefined) {
        updates.push('price = ?');
        values.push(parseFloat(price));
    }
    if (category !== undefined) {
        updates.push('category = ?');
        values.push(category);
    }
    values.push(id);
    const stmt = db.prepare(`UPDATE services SET ${updates.join(', ')} WHERE id = ?`);
    const info = stmt.run(...values);
    if (info.changes === 0) {
        return res.status(404).json({ error: 'Услуга не найдена' });
    }
    const updated = db.prepare('SELECT * FROM services WHERE id = ?').get(id);
    res.json(updated);
});

app.delete('/api/services/:id', (req, res) => {
    const { id } = req.params;
    const stmt = db.prepare('DELETE FROM services WHERE id = ?');
    const info = stmt.run(id);
    if (info.changes === 0) return res.status(404).json({ error: 'Не найдено' });
    res.json({ message: 'Удалено' });
});

// API для записей
app.get('/api/entries', (req, res) => {
    const stmt = db.prepare('SELECT * FROM entries ORDER BY date DESC');
    res.json(stmt.all());
});

app.post('/api/entries', (req, res) => {
    const { date, project, service_id, quantity } = req.body;
    if (!date || !service_id || quantity == null) {
        return res.status(400).json({ error: 'Не все поля' });
    }
    // Проверяем, существует ли услуга
    const service = db.prepare('SELECT id FROM services WHERE id = ?').get(parseInt(service_id));
    if (!service) {
        return res.status(400).json({ error: 'Услуга с таким ID не найдена' });
    }
    const id = Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const stmt = db.prepare('INSERT INTO entries (id, date, project, service_id, quantity) VALUES (?, ?, ?, ?, ?)');
    stmt.run(id, date, project || '', parseInt(service_id), parseFloat(quantity));
    res.status(201).json(db.prepare('SELECT * FROM entries WHERE id = ?').get(id));
});

app.put('/api/entries/:id', (req, res) => {
    const { id } = req.params;
    const { date, project, service_id, quantity } = req.body;
    if (!date || !service_id || quantity == null) return res.status(400).json({ error: 'Не все поля' });
    const stmt = db.prepare('UPDATE entries SET date = ?, project = ?, service_id = ?, quantity = ? WHERE id = ?');
    const info = stmt.run(date, project || '', parseInt(service_id), parseFloat(quantity), id);
    if (info.changes === 0) return res.status(404).json({ error: 'Не найдено' });
    res.json(db.prepare('SELECT * FROM entries WHERE id = ?').get(id));
});

app.delete('/api/entries/:id', (req, res) => {
    const { id } = req.params;
    const stmt = db.prepare('DELETE FROM entries WHERE id = ?');
    const info = stmt.run(id);
    if (info.changes === 0) return res.status(404).json({ error: 'Не найдено' });
    res.json({ message: 'Удалено' });
});

// Статика
app.use(express.static(__dirname));

// Все остальные маршруты — отдаём index.html (для SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`🚀 Сервер запущен на порту ${port}`);
});