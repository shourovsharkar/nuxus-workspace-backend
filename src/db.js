const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

const dbFile = path.resolve(process.env.DATABASE_FILE || "./data/nexus.sqlite");
fs.mkdirSync(path.dirname(dbFile), { recursive: true });
const db = new Database(dbFile);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'client' CHECK(role IN ('admin','employee','client')),
 is_verified INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS otps (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 email TEXT NOT NULL COLLATE NOCASE,
 code_hash TEXT NOT NULL,
 purpose TEXT NOT NULL CHECK(purpose IN ('verify','reset')),
 expires_at INTEGER NOT NULL,
 consumed_at INTEGER,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_otps_email_purpose ON otps(email,purpose);
CREATE TABLE IF NOT EXISTS projects (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT DEFAULT '',
 status TEXT NOT NULL DEFAULT 'planning', progress INTEGER NOT NULL DEFAULT 0,
 client_id INTEGER, due_date TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(client_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS orders (
 id INTEGER PRIMARY KEY AUTOINCREMENT, order_code TEXT NOT NULL UNIQUE,
 client_id INTEGER, service TEXT NOT NULL, amount REAL NOT NULL DEFAULT 0,
 currency TEXT NOT NULL DEFAULT 'USD', status TEXT NOT NULL DEFAULT 'pending',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(client_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS products (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category TEXT DEFAULT '',
 description TEXT DEFAULT '', price REAL NOT NULL DEFAULT 0,
 active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tasks (
 id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT DEFAULT '',
 project_id INTEGER, assigned_to INTEGER, status TEXT NOT NULL DEFAULT 'todo',
 due_date TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL,
 FOREIGN KEY(assigned_to) REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS invoices (
 id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_code TEXT NOT NULL UNIQUE,
 client_id INTEGER, order_id INTEGER, amount REAL NOT NULL DEFAULT 0,
 currency TEXT NOT NULL DEFAULT 'USD', status TEXT NOT NULL DEFAULT 'draft',
 due_date TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(client_id) REFERENCES users(id) ON DELETE SET NULL,
 FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE SET NULL
);
`);
function ensureAdmin() {
 const email = (process.env.ADMIN_EMAIL || "admin@freelancerjakaria.com").toLowerCase();
 const existing = db.prepare("SELECT id FROM users WHERE email=?").get(email);
 if (!existing) {
   const password = process.env.ADMIN_PASSWORD || "ChangeThisAdminPassword123!";
   const hash = bcrypt.hashSync(password, 12);
   db.prepare("INSERT INTO users(name,email,password_hash,role,is_verified) VALUES(?,?,?,'admin',1)")
     .run(process.env.ADMIN_NAME || "Jakaria", email, hash);
   console.log(`Seeded admin account: ${email}`);
 }
}
ensureAdmin();
module.exports = db;
