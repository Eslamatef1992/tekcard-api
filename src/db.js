const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const dataDir = path.resolve(__dirname, '..', process.env.DATA_DIR || 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'cards.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  title TEXT DEFAULT '',
  company TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  banner TEXT DEFAULT '',
  avatar TEXT DEFAULT '',
  theme_color TEXT DEFAULT '#0f172a',
  is_active INTEGER DEFAULT 1,
  views INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  label TEXT DEFAULT '',
  value TEXT NOT NULL,
  url TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_links_card ON links(card_id);
`);

// migrations
if (!db.prepare('PRAGMA table_info(cards)').all().some((c) => c.name === 'wallet_enabled')) {
  db.exec('ALTER TABLE cards ADD COLUMN wallet_enabled INTEGER DEFAULT 0');
}
if (!db.prepare('PRAGMA table_info(links)').all().some((c) => c.name === 'label_ar')) {
  db.exec("ALTER TABLE links ADD COLUMN label_ar TEXT DEFAULT ''");
}

// Seed the first admin from .env if none exists
function seedAdmin() {
  const count = db.prepare('SELECT COUNT(*) c FROM admins').get().c;
  if (count === 0) {
    const email = process.env.ADMIN_EMAIL || 'admin@teknulugycard.com';
    const pass = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
    db.prepare('INSERT INTO admins (email, password_hash) VALUES (?, ?)').run(email, bcrypt.hashSync(pass, 10));
    console.log(`[seed] admin created: ${email}`);
  }
}

module.exports = { db, seedAdmin };
