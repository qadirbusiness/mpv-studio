const sqlite3 = require('sqlite3').verbose();
const dbFile = process.env.DATABASE_FILE || './mpv.sqlite';
const db = new sqlite3.Database(dbFile);

const init = async () => {
  db.serialize(() => {
    db.run(`PRAGMA foreign_keys = ON;`);

    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'client',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`);

    db.run(`CREATE TABLE IF NOT EXISTS artists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      bio TEXT,
      skills TEXT,
      rating REAL DEFAULT 0,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );`);

    db.run(`CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      description TEXT,
      price INTEGER
    );`);

    db.run(`CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT,
      service_id INTEGER,
      client_id INTEGER,
      artist_id INTEGER,
      price INTEGER,
      status TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(service_id) REFERENCES services(id),
      FOREIGN KEY(client_id) REFERENCES users(id),
      FOREIGN KEY(artist_id) REFERENCES artists(id)
    );`);

    db.run(`CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      txn_id TEXT,
      user_id INTEGER,
      amount INTEGER,
      type TEXT,
      status TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );`);

    // seed some basic services and a demo user
    db.run(`INSERT OR IGNORE INTO services (id, title, description, price) VALUES
      (1,'Music Production','Full music production package',2000),
      (2,'Mixing & Mastering','Professional mixing and mastering',2500),
      (3,'Video Editing','Video editing per minute',566);
    `);

    db.run(`INSERT OR IGNORE INTO users (id, name, email, password, role) VALUES
      (1,'Demo Admin','admin@mpv.com','', 'admin');
    `, [], (err) => {
      if (err) console.log('seed user error', err.message);
    });

    console.log('Migration complete. DB file:', dbFile);
    db.close();
  });
};

init();