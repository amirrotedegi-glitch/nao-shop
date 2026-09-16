// ===== تنظیمات =====
const API = '/api';

// ===== ابزارها =====
const toPersian = (n) => n.toString().replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const formatPrice = (n) => toPersian(Number(n).toLocaleString('en-US'));

function getToken() { return localStorage.getItem('token'); }
function setToken(t) { localStorage.setItem('token', t); }
function clearToken() { localStorage.removeItem('token'); localStorage.removeItem('user'); }
function getUser() {
  try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
}
function setUser(u) { localStorage.setItem('user', JSON.stringify(u)); }

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(API + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'خطا در ارتباط با سرور');
  return data;
}

// ===== Toast =====
let toastTimer;
function toast(msg, type = 'success') {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.toggle('error', type === 'error');
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

// ===== هدر مشترک =====
async function renderHeader() {
  const user = getUser();
  const cartCountEl = document.getElementById('cartCount');
  const authArea = document.getElementById('authArea');

  // تعداد سبد
  if (user && cartCountEl) {
    try {
      const items = await api('/cart');
      const count = items.reduce((s, i) => s + i.quantity, 0);
      cartCountEl.textContent = toPersian(count);
    } catch { cartCountEl.textContent = '۰'; }
  }

  // ناحیه کاربر
  if (authArea) {
    if (user) {
      authArea.innerHTML = `
        <a href="orders.html" class="btn btn-outline btn-sm">سفارش‌های من</a>
        ${user.role === 'admin' ? '<a href="admin.html" class="btn btn-outline btn-sm">پنل ادمین</a>' : ''}
        <button class="btn btn-outline btn-sm" onclick="logout()">خروج (${user.name})</button>
      `;
    } else {
      authArea.innerHTML = `<a href="login.html" class="btn btn-primary btn-sm">ورود / ثبت‌نام</a>`;
    }
  }
}

function logout() {
  clearToken();
  toast('خارج شدید');
  setTimeout(() => location.href = 'index.html', 600);
}

function requireAuth() {
  if (!getToken()) {
    toast('ابتدا وارد شوید', 'error');
    setTimeout(() => location.href = 'login.html', 800);
    return false;
  }
  return true;
}

// اجرا در هر صفحه
document.addEventListener('DOMContentLoaded', renderHeader);