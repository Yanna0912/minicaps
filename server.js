const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Initialize SQLite Database (creates database.sqlite file)
const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) console.error('Database opening error:', err.message);
  else console.log('Connected to the SQLite database.');
});

// Create tables for key-value or structured data storage
db.run(`CREATE TABLE IF NOT EXISTS storage (
  key TEXT PRIMARY KEY,
  value TEXT
)`);

// GET endpoint to load JSON data by key
app.get('/api/:key', (req, res) => {
  const { key } = req.params;
  db.get(`SELECT value FROM storage WHERE key = ?`, [key], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (row) {
      res.json(JSON.parse(row.value));
    } else {
      res.json(null); // Return null if key doesn't exist yet
    }
  });
});

// POST endpoint to save or update JSON data by key
app.post('/api/:key', (req, res) => {
  const { key } = req.params;
  const value = JSON.stringify(req.body);

  db.run(
    `INSERT INTO storage (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?`,
    [key, value, value],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ success: true });
      }
    }
  );
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});