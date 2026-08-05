require('dotenv').config();
const express = require('express');
const fsSync = require('fs');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs').promises;
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// ─── Config ───────────────────────────────────────────────────────────────────
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_FILE_SIZE_BYTES = process.env.MAX_FILE_SIZE_BYTES
  ? Number(process.env.MAX_FILE_SIZE_BYTES)
  : 5 * 1024 * 1024;

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password123';
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set in .env. Server cannot start without it.');
  process.exit(1);
}
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
const PRODUCTS_FILE = path.join(__dirname, 'products.json');
const USERS_FILE = path.join(__dirname, 'users.json');

// ─── Database ─────────────────────────────────────────────────────────────────
let pool = null;
let useDatabase = false;

if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  useDatabase = true;
  console.log('Using PostgreSQL database');

  // Bug #17 fix: prevent unhandled pool errors from crashing the process
  pool.on('error', (err) => {
    console.error('Unexpected PostgreSQL pool error:', err.message);
  });
} else {
  console.log('No DATABASE_URL found - using products.json fallback');
}

// Initialize database table
async function initDB() {
  if (!useDatabase) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id BIGINT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      size TEXT NOT NULL DEFAULT '',
      price TEXT NOT NULL DEFAULT '',
      stock TEXT NOT NULL DEFAULT 'in stock',
      visibility BOOLEAN NOT NULL DEFAULT true,
      is_bestseller BOOLEAN NOT NULL DEFAULT false,
      category TEXT NOT NULL DEFAULT 'Middle Eastern Perfumes',
      description TEXT NOT NULL DEFAULT '',
      images JSONB NOT NULL DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  await pool.query(`
    CREATE TABLE IF NOT EXISTS carts (
      session_id TEXT PRIMARY KEY,
      items JSONB NOT NULL DEFAULT '[]',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('Database tables ready');
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const token = req.header('x-admin-token');
  if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' });
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') throw new Error('Invalid role');
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
}

function requireUser(req, res, next) {
  const token = req.header('x-user-token');
  if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' });
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.userId) throw new Error('Invalid user token');
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  };
}

function validateProductData(data) {
  if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') return 'Product name is required';
  if (!data.size || typeof data.size !== 'string' || data.size.trim() === '') return 'Product size is required';
  
  // Basic price check (can contain currency symbols, but must have numbers)
  if (!data.price || typeof data.price !== 'string' || !/\d/.test(data.price)) return 'Product price must contain numbers';
  
  // XSS protection on image URLs
  if (data.images && Array.isArray(data.images)) {
    for (const url of data.images) {
      if (typeof url === 'string') {
        const lowerUrl = url.trim().toLowerCase();
        if (lowerUrl.startsWith('javascript:') || lowerUrl.startsWith('data:text/html')) {
          return 'Invalid image URL scheme';
        }
      }
    }
  }
  
  const validCategories = ['Middle Eastern Perfumes', 'Indian Perfumes', 'Attars', 'Deodorants'];
  if (data.category && !validCategories.includes(data.category)) return 'Invalid category';

  return null;
}

// ─── File-based helpers (Fallback) ──────────────────────────────────────────────────────────
function normalizeProduct(p) {
  const safe = { ...p };
  safe.id = Number(safe.id);
  if (!Number.isFinite(safe.id)) safe.id = Date.now();
  safe.name = safe.name ? String(safe.name) : '';
  safe.size = safe.size ? String(safe.size) : '';
  safe.price = safe.price !== undefined && safe.price !== null ? String(safe.price) : '';
  safe.stock = String(p.stock || 'in stock');
  safe.visibility = p.visibility !== false; // default true
  safe.is_bestseller = p.is_bestseller === true; // default false
  safe.category = String(p.category || 'Middle Eastern Perfumes');
  safe.description = safe.description ? String(safe.description) : '';
  safe.images = Array.isArray(safe.images) ? safe.images.map(x => String(x)) : [];
  return safe;
}

// File-based fallback

// ─── User Helpers ─────────────────────────────────────────────────────────────
function loadUsersFromFile() {
  if (!fsSync.existsSync(USERS_FILE)) return [];
  try {
    return JSON.parse(fsSync.readFileSync(USERS_FILE, 'utf-8'));
  } catch (e) {
    return [];
  }
}

function saveUsersToFile(users) {
  fsSync.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

async function getUserByUsername(username) {
  if (!useDatabase) {
    const users = loadUsersFromFile();
    return users.find(u => u.username === username || u.email === username) || null;
  }
  const result = await pool.query('SELECT * FROM users WHERE username = $1 OR email = $1', [username]);
  return result.rows.length ? result.rows[0] : null;
}

async function createUser(user) {
  if (!useDatabase) {
    const users = loadUsersFromFile();
    const newUser = { id: Date.now(), ...user };
    users.push(newUser);
    saveUsersToFile(users);
    return newUser;
  }
  const result = await pool.query(
    'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING *',
    [user.username, user.email, user.password_hash]
  );
  return result.rows[0];
}

async function getUserById(id) {
  if (!useDatabase) {
    const users = loadUsersFromFile();
    return users.find(u => String(u.id) === String(id)) || null;
  }
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows.length ? result.rows[0] : null;
}

function loadProductsFromFile() {
  if (!fsSync.existsSync(PRODUCTS_FILE)) {
    fsSync.writeFileSync(PRODUCTS_FILE, JSON.stringify([]));
  }
  return JSON.parse(fsSync.readFileSync(PRODUCTS_FILE));
}

function saveProductsToFile(products) {
  fsSync.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
}

// DB-based helpers
async function getAllProducts() {
  if (!useDatabase) return loadProductsFromFile().map(normalizeProduct);
  const result = await pool.query('SELECT * FROM products ORDER BY id ASC');
  return result.rows.map(row => ({
    ...row,
    id: Number(row.id),
    images: Array.isArray(row.images) ? row.images : JSON.parse(row.images || '[]')
  }));
}

async function getProductById(id) {
  if (!useDatabase) {
    const products = loadProductsFromFile();
    const found = products.find(p => p.id === Number(id)) || null;
    return found ? normalizeProduct(found) : null;
  }
  const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    ...row,
    id: Number(row.id),
    images: Array.isArray(row.images) ? row.images : JSON.parse(row.images || '[]')
  };
}

async function createProduct(product) {
  const p = normalizeProduct(product);
  if (!useDatabase) {
    const products = loadProductsFromFile();
    products.push(p);
    saveProductsToFile(products);
    return p;
  }
  await pool.query(
    `INSERT INTO products (id, name, size, price, stock, visibility, is_bestseller, category, description, images)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [p.id, p.name, p.size, p.price, p.stock, p.visibility, p.is_bestseller, p.category, p.description, JSON.stringify(p.images)]
  );
  return p;
}

async function updateProduct(id, updates) {
  if (!useDatabase) {
    const products = loadProductsFromFile();
    const index = products.findIndex(p => p.id === Number(id));
    if (index === -1) return null;
    const updated = normalizeProduct({ ...products[index], ...updates, id: products[index].id });
    products[index] = updated;
    saveProductsToFile(products);
    return updated;
  }
  const existing = await getProductById(id);
  if (!existing) return null;
  const updated = normalizeProduct({ ...existing, ...updates, id: existing.id });
  await pool.query(
    `UPDATE products SET name=$1, size=$2, price=$3, stock=$4, visibility=$5,
     is_bestseller=$6, category=$7, description=$8, images=$9 WHERE id=$10`,
    [updated.name, updated.size, updated.price, updated.stock, updated.visibility,
     updated.is_bestseller, updated.category, updated.description, JSON.stringify(updated.images), id]
  );
  return updated;
}

async function deleteProduct(id) {
  if (!useDatabase) {
    const products = loadProductsFromFile();
    const len = products.length;
    const filtered = products.filter(p => p.id !== Number(id));
    saveProductsToFile(filtered);
    return filtered.length < len;
  }
  const result = await pool.query('DELETE FROM products WHERE id = $1', [id]);
  return result.rowCount > 0;
}

// ─── App setup ────────────────────────────────────────────────────────────────
const app = express();
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false // Disable CSP to avoid blocking your inline scripts
}));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { error: 'Too many requests, please try again later.' }
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many authentication attempts, please try again later.' }
});

// CORS removed - frontend is served from same origin
app.use(express.json({ limit: '2mb' }));
app.use(express.static('public'));

// Ensure upload directory exists
if (!fsSync.existsSync(UPLOAD_DIR)) {
  fsSync.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ─── Multer ───────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const rawProductId = req.body.productId || 'temp';
    const productId = String(rawProductId).replace(/[^a-zA-Z0-9_-]/g, '');
    const dir = path.join(__dirname, 'public', 'uploads', 'products', productId);
    try {
      await fs.mkdir(dir, { recursive: true });
      cb(null, dir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    cb(null, `${base}_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) return cb(new Error('Invalid file type'));
    cb(null, true);
  }
});

// ─── Routes ───────────────────────────────────────────────────────────────────
// ─── User Auth Routes ─────────────────────────────────────────────────────────

async function mergeCarts(guestId, userId) {
  if (!guestId || !userId) return;
  const userSessionId = `user_${userId}`;
  try {
    if (useDatabase) {
      const guestRes = await pool.query('SELECT items FROM carts WHERE session_id = $1', [guestId]);
      if (guestRes.rows.length === 0) return;
      const guestItems = guestRes.rows[0].items || [];
      
      const userRes = await pool.query('SELECT items FROM carts WHERE session_id = $1', [userSessionId]);
      let userItems = userRes.rows.length > 0 ? userRes.rows[0].items || [] : [];
      
      guestItems.forEach(gItem => {
        const existing = userItems.find(uItem => String(uItem.productId) === String(gItem.productId));
        if (existing) existing.quantity = (existing.quantity || 1) + (gItem.quantity || 1);
        else userItems.push(gItem);
      });
      
      await pool.query(
        'INSERT INTO carts (session_id, items) VALUES ($1, $2) ON CONFLICT (session_id) DO UPDATE SET items = $2, updated_at = CURRENT_TIMESTAMP',
        [userSessionId, JSON.stringify(userItems)]
      );
      await pool.query('DELETE FROM carts WHERE session_id = $1', [guestId]);
    } else {
      const guestItems = memoryCarts[guestId] || [];
      if (guestItems.length === 0) return;
      let userItems = memoryCarts[userSessionId] || [];
      guestItems.forEach(gItem => {
        const existing = userItems.find(uItem => String(uItem.productId) === String(gItem.productId));
        if (existing) existing.quantity = (existing.quantity || 1) + (gItem.quantity || 1);
        else userItems.push(gItem);
      });
      memoryCarts[userSessionId] = userItems;
      delete memoryCarts[guestId];
    }
  } catch (err) {
    console.error('Cart merge failed:', err);
  }
}

app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { username, email, password, guest_id } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'Missing fields' });
    
    if (username.includes('@')) return res.status(400).json({ error: 'Username cannot contain @ symbol' });
    
    // Bug 8: Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email format' });
    
    // Bug 9: Password length validation
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    
    const existing = await getUserByUsername(username) || await getUserByUsername(email);
    if (existing) return res.status(400).json({ error: 'Username or email already exists' });
    
    const password_hash = await bcrypt.hash(password, 10);
    const user = await createUser({ username, email, password_hash });
    
    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    if (guest_id) await mergeCarts(guest_id, user.id);
    res.json({ success: true, token, username: user.username });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Failed to register' });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { username, password, guest_id } = req.body;
    const user = await getUserByUsername(username);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });
    
    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    if (guest_id) await mergeCarts(guest_id, user.id);
    res.json({ success: true, token, username: user.username });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Get current user info
app.get('/api/auth/me', requireUser, async (req, res) => {
  try {
    const user = await getUserById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user.id, username: user.username, email: user.email, created_at: user.created_at });
  } catch (err) {
    console.error('GET /api/auth/me error:', err);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

app.post('/api/admin/login', authLimiter, (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token });
  } else {
    res.status(401).json({ error: 'Invalid username or password' });
  }
});

// Auth check
app.get('/api/auth', requireAdmin, (req, res) => {
  res.json({ ok: true });
});

// Get all products (public)
app.get('/api/products', async (req, res) => {
  try {
    let products = await getAllProducts();
    const token = req.header('x-admin-token');
    let isAdmin = false;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role === 'admin') isAdmin = true;
      } catch (e) {}
    }
    if (!isAdmin) {
      // Filter out hidden products for public requests
      products = products.filter(p => p.visibility);
    }
    res.json(products);
  } catch (err) {
    console.error('GET /api/products error:', err);
    res.status(500).json({ error: 'Failed to load products' });
  }
});

// Get single product (public)
app.get('/api/products/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid product ID' });
    const product = await getProductById(id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    
    // Check admin token to allow viewing hidden products
    const token = req.header('x-admin-token');
    let isAdmin = false;
    if (token) {
      try { isAdmin = (jwt.verify(token, JWT_SECRET).role === 'admin'); } catch {}
    }
    
    if (!isAdmin && !product.visibility) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(product);
  } catch (err) {
    console.error('GET /api/products/:id error:', err);
    res.status(500).json({ error: 'Failed to load product' });
  }
});

// Create product (admin)
app.post('/api/products', requireAdmin, async (req, res) => {
  try {
    const error = validateProductData(req.body);
    if (error) return res.status(400).json({ error });

    const uniqueId = Date.now() * 1000 + crypto.randomInt(1000);
    const newProduct = await createProduct({ ...req.body, id: uniqueId });
    res.json(newProduct);
  } catch (err) {
    console.error('POST /api/products error:', err);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Update product (admin)
app.put('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid product ID' });

    const error = validateProductData(req.body);
    if (error) return res.status(400).json({ error });

    const updated = await updateProduct(id, req.body);
    if (!updated) return res.status(404).json({ error: 'Product not found' });
    res.json(updated);
  } catch (err) {
    console.error('PUT /api/products error:', err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Delete product (admin)
app.delete('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid product ID' });

    const deleted = await deleteProduct(id);
    if (!deleted) return res.status(404).json({ error: 'Product not found' });

    // Clean up uploaded images for this product
    const productUploadDir = path.join(UPLOAD_DIR, 'products', String(req.params.id));
    try {
      await fs.rm(productUploadDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      // Non-fatal: log but don't fail the response if folder didn't exist
      console.warn(`Could not remove upload dir for product ${req.params.id}:`, cleanupErr.message);
    }

    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('DELETE /api/products error:', err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// Image upload (admin)
app.post('/api/upload', requireAdmin, upload.array('images', 10), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const rawProductId = req.body.productId || 'temp';
  const productId = String(rawProductId).replace(/[^a-zA-Z0-9_-]/g, '');
  const uploadedUrls = [];

  for (const file of req.files) {
    const absolutePath = file.path;
    const fileBuffer = await fs.readFile(absolutePath);
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    
    // Use the hash as the new filename for O(1) deduplication
    const newFilename = `${hash}${ext}`;
    const prodDir = path.join(__dirname, 'public', 'uploads', 'products', productId);
    const targetPath = path.join(prodDir, newFilename);
    const publicUrl = `/uploads/products/${productId}/${newFilename}`;

    if (absolutePath !== targetPath) {
      try {
        await fs.rename(absolutePath, targetPath);
      } catch (err) {
        console.error('Rename failed:', err);
      }
    }

    uploadedUrls.push(publicUrl);
  }

  res.json({ urls: uploadedUrls });
});

// ─── Cart Routes ──────────────────────────────────────────────────────────────
function getSessionId(req) {
  // Check for logged in user token
  const userToken = req.headers['x-user-token'];
  if (userToken) {
    try {
      const decoded = jwt.verify(userToken, JWT_SECRET);
      if (decoded && decoded.userId) return `user_${decoded.userId}`;
    } catch (e) {} // Fall through to guest id if invalid
  }

  // Check cookie or header for guest_id
  const headerGuestId = req.headers['x-guest-id'];
  if (headerGuestId) return headerGuestId;
  
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [name, ...rest] = cookie.split('=');
      if (name) acc[name.trim()] = decodeURIComponent(rest.join('='));
      return acc;
    }, {});
    if (cookies.guest_id) return cookies.guest_id;
  }
  return null;
}

// Memory fallback if DB is not used
const memoryCarts = {};

app.get('/api/cart', async (req, res) => {
  const guestId = getSessionId(req);
  if (!guestId) return res.json([]);
  
  try {
    if (useDatabase) {
      const result = await pool.query('SELECT items FROM carts WHERE session_id = $1', [guestId]);
      if (result.rows.length > 0) {
        return res.json(result.rows[0].items || []);
      }
      return res.json([]);
    } else {
      return res.json(memoryCarts[guestId] || []);
    }
  } catch (err) {
    console.error('Failed to get cart', err);
    res.status(500).json({ error: 'Failed to get cart' });
  }
});

app.post('/api/cart', async (req, res) => {
  const guestId = getSessionId(req);
  if (!guestId) return res.status(400).json({ error: 'Missing guest_id' });
  
  const { productId, name, price, size, image } = req.body;
  if (!productId) return res.status(400).json({ error: 'Missing productId' });
  
  try {
    let items = [];
    if (useDatabase) {
      const result = await pool.query('SELECT items FROM carts WHERE session_id = $1', [guestId]);
      if (result.rows.length > 0) {
        items = result.rows[0].items || [];
      }
      
      const existingItem = items.find(i => String(i.productId) === String(productId));
      if (existingItem) {
        existingItem.quantity = (existingItem.quantity || 1) + 1;
      } else {
        items.push({ productId: String(productId), name, price, size, image, quantity: 1 });
      }
      await pool.query(
        'INSERT INTO carts (session_id, items) VALUES ($1, $2) ON CONFLICT (session_id) DO UPDATE SET items = $2, updated_at = CURRENT_TIMESTAMP',
        [guestId, JSON.stringify(items)]
      );
    } else {
      items = memoryCarts[guestId] || [];
      const existingItem = items.find(i => String(i.productId) === String(productId));
      if (existingItem) {
        existingItem.quantity = (existingItem.quantity || 1) + 1;
      } else {
        items.push({ productId: String(productId), name, price, size, image, quantity: 1 });
      }
      memoryCarts[guestId] = items;
    }
    res.json(items);
  } catch (err) {
    console.error('Failed to add to cart', err);
    res.status(500).json({ error: 'Failed to add to cart' });
  }
});

app.put('/api/cart/:productId', async (req, res) => {
  const guestId = getSessionId(req);
  if (!guestId) return res.status(400).json({ error: 'Missing guest_id' });
  
  const { quantity } = req.body;
  const productId = req.params.productId;
  
  try {
    let items = [];
    if (useDatabase) {
      const result = await pool.query('SELECT items FROM carts WHERE session_id = $1', [guestId]);
      if (result.rows.length > 0) {
        items = result.rows[0].items || [];
        const item = items.find(i => String(i.productId) === String(productId));
        if (item) {
          item.quantity = Math.max(1, parseInt(quantity) || 1);
          await pool.query('UPDATE carts SET items = $1, updated_at = CURRENT_TIMESTAMP WHERE session_id = $2', [JSON.stringify(items), guestId]);
        }
      }
    } else {
      items = memoryCarts[guestId] || [];
      const item = items.find(i => String(i.productId) === String(productId));
      if (item) {
        item.quantity = Math.max(1, parseInt(quantity) || 1);
        memoryCarts[guestId] = items;
      }
    }
    res.json(items);
  } catch (err) {
    console.error('Failed to update cart', err);
    res.status(500).json({ error: 'Failed to update cart' });
  }
});

app.delete('/api/cart/:productId', async (req, res) => {
  const guestId = getSessionId(req);
  if (!guestId) return res.status(400).json({ error: 'Missing guest_id' });
  const productId = req.params.productId;
  
  try {
    let items = [];
    if (useDatabase) {
      const result = await pool.query('SELECT items FROM carts WHERE session_id = $1', [guestId]);
      if (result.rows.length > 0) {
        items = result.rows[0].items || [];
        items = items.filter(i => String(i.productId) !== String(productId));
        await pool.query('UPDATE carts SET items = $1, updated_at = CURRENT_TIMESTAMP WHERE session_id = $2', [JSON.stringify(items), guestId]);
      }
    } else {
      if (memoryCarts[guestId]) {
        memoryCarts[guestId] = memoryCarts[guestId].filter(i => String(i.productId) !== String(productId));
        items = memoryCarts[guestId];
      }
    }
    res.json(items);
  } catch (err) {
    console.error('Failed to remove from cart', err);
    res.status(500).json({ error: 'Failed to remove from cart' });
  }
});

app.delete('/api/cart', async (req, res) => {
  const guestId = getSessionId(req);
  if (!guestId) return res.status(400).json({ error: 'Missing guest_id' });
  
  try {
    if (useDatabase) {
      await pool.query('DELETE FROM carts WHERE session_id = $1', [guestId]);
    } else {
      delete memoryCarts[guestId];
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to clear cart', err);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
});

// ─── Page routes ──────────────────────────────────────────────────────────────
const pub = (file) => path.join(__dirname, 'public', file);
app.get('/', (req, res) => res.sendFile(pub('index.html')));
app.get('/products', (req, res) => res.sendFile(pub('products.html')));
app.get('/product/:id', (req, res) => res.sendFile(pub('product-detail.html')));
app.get('/how-it-works', (req, res) => res.sendFile(pub('how-it-works.html')));
app.get('/delivery-payment', (req, res) => res.sendFile(pub('delivery-payment.html')));
app.get('/contact', (req, res) => res.sendFile(pub('contact.html')));
app.get('/admin', (req, res) => res.sendFile(pub('admin.html')));
app.get('/account', (req, res) => res.sendFile(pub('account.html')));

// ─── Error Handling ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds the 5MB limit.' });
    }
    return res.status(400).json({ error: err.message });
  } else if (err) {
    console.error('Unhandled server error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error.' });
  }
  next();
});

// ─── Start ────────────────────────────────────────────────────────────────────
async function start() {
  await initDB();
  const server = app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

  // Bug #16 fix: graceful shutdown — drain connections before process exits
  async function shutdown(signal) {
    console.log(`\n${signal} received. Shutting down gracefully…`);
    server.close(async () => {
      console.log('HTTP server closed.');
      if (pool) {
        try {
          await pool.end();
          console.log('PostgreSQL pool drained.');
        } catch (err) {
          console.error('Error closing DB pool:', err.message);
        }
      }
      process.exit(0);
    });

    // Force exit if shutdown takes too long
    setTimeout(() => {
      console.error('Shutdown timed out. Forcing exit.');
      process.exit(1);
    }, 8000);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
