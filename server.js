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

// ─── Config ───────────────────────────────────────────────────────────────────
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_FILE_SIZE_BYTES = process.env.MAX_FILE_SIZE_BYTES
  ? Number(process.env.MAX_FILE_SIZE_BYTES)
  : 5 * 1024 * 1024;

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
if (!ADMIN_TOKEN) {
  console.error('FATAL: ADMIN_TOKEN is not set in .env. Server cannot start without it.');
  process.exit(1);
}
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
const PRODUCTS_FILE = path.join(__dirname, 'products.json');

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
      category TEXT NOT NULL DEFAULT 'Middle Eastern Perfumes',
      description TEXT NOT NULL DEFAULT '',
      images JSONB NOT NULL DEFAULT '[]'
    )
  `);
  console.log('Database table ready');
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const token = req.header('x-admin-token');
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ─── Product helpers ──────────────────────────────────────────────────────────
function normalizeProduct(p) {
  const safe = { ...p };
  safe.id = Number(safe.id);
  if (!Number.isFinite(safe.id)) safe.id = Date.now();
  safe.name = safe.name ? String(safe.name) : '';
  safe.size = safe.size ? String(safe.size) : '';
  safe.price = safe.price !== undefined && safe.price !== null ? String(safe.price) : '';
  safe.stock = safe.stock ? String(safe.stock) : 'in stock';
  safe.visibility = typeof safe.visibility === 'boolean' ? safe.visibility : true;
  safe.category = safe.category ? String(safe.category) : 'Middle Eastern Perfumes';
  safe.description = safe.description ? String(safe.description) : '';
  safe.images = Array.isArray(safe.images) ? safe.images.map(x => String(x)) : [];
  return safe;
}

// File-based fallback
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
  if (!useDatabase) return loadProductsFromFile();
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
    return products.find(p => p.id === Number(id)) || null;
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
    `INSERT INTO products (id, name, size, price, stock, visibility, category, description, images)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [p.id, p.name, p.size, p.price, p.stock, p.visibility, p.category, p.description, JSON.stringify(p.images)]
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
     category=$6, description=$7, images=$8 WHERE id=$9`,
    [updated.name, updated.size, updated.price, updated.stock, updated.visibility,
     updated.category, updated.description, JSON.stringify(updated.images), id]
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

app.use(helmet({
  contentSecurityPolicy: false // Disable CSP to avoid blocking your inline scripts
}));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { error: 'Too many requests, please try again later.' }
}));

// CORS removed - frontend is served from same origin
app.use(express.json());
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

// Auth check
app.get('/api/auth', requireAdmin, (req, res) => {
  res.json({ ok: true });
});

// Get all products (public)
app.get('/api/products', async (req, res) => {
  try {
    let products = await getAllProducts();
    const token = req.header('x-admin-token');
    if (!token || token !== ADMIN_TOKEN) {
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
    const product = await getProductById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    console.error('GET /api/products/:id error:', err);
    res.status(500).json({ error: 'Failed to load product' });
  }
});

// Create product (admin)
app.post('/api/products', requireAdmin, async (req, res) => {
  try {
    const uniqueId = Date.now() * 1000 + crypto.randomInt(1000);
    const newProduct = await createProduct({ id: uniqueId, ...req.body });
    res.json(newProduct);
  } catch (err) {
    console.error('POST /api/products error:', err);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Update product (admin)
app.put('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    const updated = await updateProduct(req.params.id, req.body);
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
    const deleted = await deleteProduct(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Product not found' });
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
        await fs.access(targetPath);
        // Duplicate exists, remove the freshly uploaded temp file
        await fs.unlink(absolutePath);
      } catch (err) {
        // Doesn't exist, rename it to the hashed name
        await fs.rename(absolutePath, targetPath);
      }
    }

    uploadedUrls.push(publicUrl);
  }

  res.json({ urls: uploadedUrls });
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
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
