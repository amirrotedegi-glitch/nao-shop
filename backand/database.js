const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const db = new Database(path.join(__dirname, 'shop.db'));
db.pragma('journal_mode = WAL');

// ===== ساخت جداول =====
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL,
    old_price INTEGER,
    category TEXT,
    emoji TEXT DEFAULT '📦',
    stock INTEGER DEFAULT 10,
    featured INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cart (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    product_id INTEGER,
    quantity INTEGER DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    total INTEGER,
    status TEXT DEFAULT 'pending',
    address TEXT,
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    product_id INTEGER,
    quantity INTEGER,
    price INTEGER,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );
`);

// ===== داده اولیه =====
const productCount = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
if (productCount === 0) {
  const insert = db.prepare(`
    INSERT INTO products (name, description, price, old_price, category, emoji, stock, featured)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const products = [
    ['شمع معطر وانیل', 'شمع دست‌ساز با رایحه وانیل و صندل، مناسب برای فضای آرام', 195000, 280000, 'دکور', '🕯', 15, 1],
    ['گلدان سرامیکی', 'گلدان سرامیکی دست‌ساز با طراحی مینیمال', 320000, null, 'دکور', '🏺', 8, 0],
    ['عطر چوبی مردانه', 'عطر با نت‌های چوبی، ماندگاری بالا', 890000, 1100000, 'عطر', '🧴', 12, 1],
    ['جعبه هدیه لوکس', 'جعبه هدیه با روکش مخملی، مناسب هر مناسبت', 450000, null, 'هدیه', '🎁', 20, 0],
    ['چراغ رومیزی مینیمال', 'چراغ رومیزی با نور گرم و طراحی مدرن', 680000, 800000, 'دکور', '💡', 6, 0],
    ['عطر گل رز زنانه', 'عطر زنانه با رایحه گل رز و یاس', 750000, null, 'عطر', '🌸', 10, 1],
    ['دفتر یادداشت چرمی', 'دفتر با جلد چرم طبیعی، ۲۰۰ صفحه', 280000, null, 'هدیه', '📔', 25, 0],
    ['آینه رومیزی گرد', 'آینه با قاب برنجی و طراحی رترو', 540000, 620000, 'دکور', '🪞', 7, 0],
    ['شمعدان برنزی', 'شمعدان برنزی دست‌ساز با طراحی کلاسیک', 420000, null, 'دکور', '🕯', 9, 0],
    ['ست عطر مینیاتوری', 'ست ۳ عددی عطرهای مینیاتوری برای سفر', 620000, 750000, 'عطر', '🎀', 14, 1],
    ['کیف دستی چرمی', 'کیف دستی چرم طبیعی با دوخت دست', 1250000, null, 'هدیه', '👝', 5, 0],
    ['گلدان آویز مکرمه', 'گلدان آویز با گره‌های مکرمه دست‌بافت', 380000, null, 'دکور', '🌿', 11, 0],
  ];

  products.forEach(p => insert.run(...p));
}

// ===== کاربر ادمین پیش‌فرض =====
const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@noa.com');
if (!adminExists) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)')
    .run('مدیر', 'admin@noa.com', hash, 'admin');
  console.log('✅ کاربر ادمین ساخته شد: admin@noa.com / admin123');
}

module.exports = db;