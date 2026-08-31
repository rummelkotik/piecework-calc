const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Отдаем файлы строго из той папки, где лежит этот index.js, и из родительской
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, '..')));

const db = new Database('./database.sqlite');

db.exec(`
    CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project TEXT DEFAULT 'MyProject',
        date TEXT NOT NULL,
        service_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        FOREIGN KEY (service_id) REFERENCES services(id)
    );
`);

try { db.exec("ALTER TABLE entries ADD COLUMN project TEXT DEFAULT 'MyProject'"); } catch(e) {}

app.get('/api/services', (req, res) => {
    res.json(db.prepare('SELECT * FROM services').all());
});

app.post('/api/services', (req, res) => {
    const { name, price } = req.body;
    const info = db.prepare('INSERT INTO services (name, price) VALUES (?, ?)').run(name, price);
    res.json({ id: info.lastInsertRowid, name, price });
});

app.delete('/api/services/:id', (req, res) => {
    db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

app.get('/api/entries', (req, res) => {
    const query = `
        SELECT entries.id, entries.project, entries.date, entries.quantity, services.name, services.price 
        FROM entries 
        JOIN services ON entries.service_id = services.id
        ORDER BY entries.date DESC
    `;
    res.json(db.prepare(query).all());
});

app.post('/api/entries', (req, res) => {
    const { project, date, service_id, quantity } = req.body;
    const info = db.prepare('INSERT INTO entries (project, date, service_id, quantity) VALUES (?, ?, ?, ?)').run(project || 'MyProject', date, service_id, quantity);
    res.json({ id: info.lastInsertRowid });
});

app.delete('/api/entries/:id', (req, res) => {
    db.prepare('DELETE FROM entries WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));