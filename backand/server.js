const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'noa-shop-secret-2026-change-me';

app.use(cors());
app.use(express.json());

// سرو کردن فایل‌های فرانت‌اند
app.use(express.static(path.join(__dirname, '../frontend')));

// ===== میدل‌ور احراز هویت =====
function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'توکن ارسال نشده' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'توکن نامعتبر' });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'دسترسی ندارید' });
  next();
}

// ==================== محصولات ====================
app.get('/api/products', (req, res) => {
  const { category, search, featured } = req.query;
  let sql = 'SELECT * FROM products WHERE 1=1';
  const params = [];

  if (category && category !== 'همه') {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (search) {
    sql += ' AND (name LIKE ? OR description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (featured === 'true') {
    sql += ' AND featured = 1';
  }
  sql += ' ORDER BY created_at DESC';

  res.json(db.prepare(sql).all(...params));
});

app.get('/api/products/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'محصول یافت نشد' });
  res.json(product);
});

app.post('/api/products', auth, adminOnly, (req, res) => {
  const { name, description, price, old_price, category, emoji, stock, featured } = req.body;
  const result = db.prepare(`
    INSERT INTO products (name, description, price, old_price, category, emoji, stock, featured)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, description, price, old_price, category, emoji || '📦', stock || 10, featured ? 1 : 0);
  res.json({ id: result.lastInsertRowid, ...req.body });
});

app.put('/api/products/:id', auth, adminOnly, (req, res) => {
  const { name, description, price, old_price, category, emoji, stock, featured } = req.body;
  db.prepare(`
    UPDATE products SET name=?, description=?, price=?, old_price=?, category=?, emoji=?, stock=?, featured=?
    WHERE id=?
  `).run(name, description, price, old_price, category, emoji, stock, featured ? 1 : 0, req.params.id);
  res.json({ success: true });
});

app.delete('/api/products/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ==================== احراز هویت ====================
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'همه فیلدها الزامی است' });
  if (password.length < 6) return res.status(400).json({ error: 'رمز عبور حداقل ۶ کاراکتر' });

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(400).json({ error: 'این ایمیل قبلاً ثبت شده' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)').run(name, email, hash);
  const user = { id: result.lastInsertRowid, name, email, role: 'user' };
  const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
  res.json({ user, token });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'ایمیل یا رمز عبور اشتباه است' });
  }
  const payload = { id: user.id, name: user.name, email: user.email, role: user.role };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  res.json({ user: payload, token });
});

app.get('/api/auth/me', auth, (req, res) => {
  res.json(req.user);
});

// ==================== سبد خرید ====================
app.get('/api/cart', auth, (req, res) => {
  const items = db.prepare(`
    SELECT c.id, c.quantity, p.id as product_id, p.name, p.price, p.emoji, p.stock
    FROM cart c JOIN products p ON c.product_id = p.id
    WHERE c.user_id = ?
  `).all(req.user.id);
  res.json(items);
});

app.post('/api/cart', auth, (req, res) => {
  const { product_id, quantity = 1 } = req.body;
  const existing = db.prepare('SELECT id, quantity FROM cart WHERE user_id = ? AND product_id = ?')
    .get(req.user.id, product_id);

  if (existing) {
    db.prepare('UPDATE cart SET quantity = quantity + ? WHERE id = ?').run(quantity, existing.id);
  } else {
    db.prepare('INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)')
      .run(req.user.id, product_id, quantity);
  }
  res.json({ success: true });
});

app.put('/api/cart/:id', auth, (req, res) => {
  const { quantity } = req.body;
  if (quantity <= 0) {
    db.prepare('DELETE FROM cart WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  } else {
    db.prepare('UPDATE cart SET quantity = ? WHERE id = ? AND user_id = ?')
      .run(quantity, req.params.id, req.user.id);
  }
  res.json({ success: true });
});

app.delete('/api/cart/:id', auth, (req, res) => {
  db.prepare('DELETE FROM cart WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// ==================== سفارش‌ها ====================
app.post('/api/orders', auth, (req, res) => {
  const { address, phone } = req.body;
  const cartItems = db.prepare(`
    SELECT c.quantity, p.id as product_id, p.price, p.stock, p.name
    FROM cart c JOIN products p ON c.product_id = p.id
    WHERE c.user_id = ?
  `).all(req.user.id);

  if (cartItems.length === 0) return res.status(400).json({ error: 'سبد خرید خالی است' });

  // چک موجودی
  for (const item of cartItems) {
    if (item.quantity > item.stock) {
      return res.status(400).json({ error: `موجودی «${item.name}» کافی نیست` });
    }
  }

  const total = cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const tx = db.transaction(() => {
    const order = db.prepare('INSERT INTO orders (user_id, total, address, phone, status) VALUES (?, ?, ?, ?, ?)')
      .run(req.user.id, total, address, phone, 'paid');

    const insertItem = db.prepare('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)');
    const decStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');

    for (const item of cartItems) {
      insertItem.run(order.lastInsertRowid, item.product_id, item.quantity, item.price);
      decStock.run(item.quantity, item.product_id);
    }

    db.prepare('DELETE FROM cart WHERE user_id = ?').run(req.user.id);
    return order.lastInsertRowid;
  });

  const orderId = tx();
  res.json({ orderId, total });
});

app.get('/api/orders', auth, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  const getItems = db.prepare(`
    SELECT oi.*, p.name, p.emoji
    FROM order_items oi JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `);
  orders.forEach(o => { o.items = getItems.all(o.id); });
  res.json(orders);
});

app.get('/api/admin/orders', auth, adminOnly, (req, res) => {
  const orders = db.prepare(`
    SELECT o.*, u.name as user_name, u.email as user_email
    FROM orders o JOIN users u ON o.user_id = u.id
    ORDER BY o.created_at DESC
  `).all();
  const getItems = db.prepare(`
    SELECT oi.*, p.name, p.emoji
    FROM order_items oi JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `);
  orders.forEach(o => { o.items = getItems.all(o.id); });
  res.json(orders);
});

app.listen(PORT, () => {
  console.log(`\n🚀 سرور روی http://localhost:${PORT} اجرا شد\n`);
});