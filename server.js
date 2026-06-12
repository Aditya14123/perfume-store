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
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'a8f3c9e2-b4d1-4f7a-9e2c-8b5a3d7f9e1c';
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
    return products.find(p => p.id == id) || null;
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
    const index = products.findIndex(p => p.id == id);
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
    const filtered = products.filter(p => p.id != id);
    saveProductsToFile(filtered);
    return true;
  }
  await pool.query('DELETE FROM products WHERE id = $1', [id]);
  return true;
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

app.use(cors());
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
    const products = await getAllProducts();
    res.json(products);
  } catch (err) {
    console.error('GET /api/products error:', err);
    res.status(500).json({ error: 'Failed to load products' });
  }
});

// Create product (admin)
app.post('/api/products', requireAdmin, async (req, res) => {
  try {
    const newProduct = await createProduct({ id: Date.now(), ...req.body });
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
    await deleteProduct(req.params.id);
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
    let existingPath = null;

    // Check flat /uploads
    try {
      const flatDir = path.join(__dirname, 'public', 'uploads');
      if (fsSync.existsSync(flatDir)) {
        const flatFiles = await fs.readdir(flatDir);
        for (const f of flatFiles) {
          const p = path.join(flatDir, f);
          if (fsSync.lstatSync(p).isFile()) {
            const buf = await fs.readFile(p);
            const h = crypto.createHash('sha256').update(buf).digest('hex');
            if (h === hash) { existingPath = `/uploads/${f}`; break; }
          }
        }
      }
    } catch (_) {}

    // Check structured product folder
    if (!existingPath) {
      try {
        const prodDir = path.join(__dirname, 'public', 'uploads', 'products', productId);
        const files = await fs.readdir(prodDir);
        for (const f of files) {
          const p = path.join(prodDir, f);
          const buf = await fs.readFile(p);
          const h = crypto.createHash('sha256').update(buf).digest('hex');
          if (h === hash) { existingPath = `/uploads/products/${productId}/${f}`; break; }
        }
      } catch (_) {}
    }

    if (existingPath) {
      await fs.unlink(absolutePath);
      uploadedUrls.push(existingPath);
    } else {
      uploadedUrls.push(`/uploads/products/${productId}/${file.filename}`);
    }
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

// ─── Start ────────────────────────────────────────────────────────────────────
async function start() {
  await initDB();
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});


// const express = require('express');
// const fsSync = require('fs');
// const path = require('path');
// const cors = require('cors');
// const multer = require('multer');
// const crypto = require('crypto');
// const fs = require('fs').promises; // For async file operations

// // Limit basic upload types/size for safer deployments
// const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
// const MAX_FILE_SIZE_BYTES = process.env.MAX_FILE_SIZE_BYTES
//   ? Number(process.env.MAX_FILE_SIZE_BYTES)
//   : 5 * 1024 * 1024; // 5MB default


// const app = express();
// const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
// const PRODUCTS_FILE = path.join(__dirname, 'products.json');
// const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');

// // Admin auth (production-friendly): JWT-like shared secret via header
// // Configure via env vars on deploy.
// const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'a8f3c9e2-b4d1-4f7a-9e2c-8b5a3d7f9e1c';
// function requireAdmin(req, res, next) {
//   if (!ADMIN_TOKEN) {
//     return res.status(500).json({ error: 'Server misconfigured: ADMIN_TOKEN is not set' });
//   }
//   const token = req.header('x-admin-token');
//   if (!token || token !== ADMIN_TOKEN) {
//     return res.status(401).json({ error: 'Unauthorized' });
//   }
//   next();
// }


// // Ensure upload directory exists
// if (!fsSync.existsSync(UPLOAD_DIR)) {
//   fs.mkdirSync(UPLOAD_DIR, { recursive: true });
// }

// // Multer setup for image uploads
// const storage = multer.diskStorage({
//   destination: async (req, file, cb) => {

//     const rawProductId = req.body.productId || 'temp';
//     const productId = String(rawProductId).replace(/[^a-zA-Z0-9_-]/g, '');
//     const dir = path.join(__dirname, 'public', 'uploads', 'products', productId);

//     try {
//       await fs.mkdir(dir, { recursive: true });
//       cb(null, dir);
//     } catch (err) {
//       cb(err);
//     }
//   },
//   filename: (req, file, cb) => {
//     const ext = path.extname(file.originalname).toLowerCase();
//     const base = path
//       .basename(file.originalname, ext)
//       .replace(/[^a-zA-Z0-9]/g, '_')
//       .toLowerCase();

//     cb(null, `${base}_${Date.now()}${ext}`);
//   }
// });
// const upload = multer({
//   storage,
//   limits: {
//     fileSize: MAX_FILE_SIZE_BYTES
//   },
//   fileFilter: (req, file, cb) => {
//     // Basic type allowlist
//     const isAllowed = ALLOWED_MIME.has(file.mimetype);
//     if (!isAllowed) return cb(new Error('Invalid file type'));
//     cb(null, true);
//   }
// });


// // Middleware
// app.use(cors());
// app.use(express.json());
// app.use(express.static('public'));

// // Load products from JSON
// function loadProducts() {
//   if (!fsSync.existsSync(PRODUCTS_FILE)) {
//     fsSync.writeFileSync(PRODUCTS_FILE, JSON.stringify([]));
//   }
//   return JSON.parse(fsSync.readFileSync(PRODUCTS_FILE));
// }

// // Save products to JSON
// function saveProducts(products) {
//   fsSync.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
// }

// // API Routes (public read)
// app.get('/api/products', (req, res) => {
//   res.json(loadProducts());
// });

// // API Routes (admin write)
// app.post('/api/products', requireAdmin, (req, res) => {
//   const products = loadProducts();
//   const newProduct = normalizeProduct({ id: Date.now(), ...req.body });
//   products.push(newProduct);
//   saveProducts(products);
//   res.json(newProduct);
// });

// app.put('/api/products/:id', requireAdmin, (req, res) => {
//   const products = loadProducts();
//   const index = products.findIndex(p => p.id == req.params.id);
//   if (index !== -1) {
//     const updated = normalizeProduct({ ...products[index], ...req.body, id: products[index].id });
//     products[index] = updated;
//     saveProducts(products);
//     res.json(updated);
//   } else {
//     res.status(404).json({ error: 'Product not found' });
//   }
// });

// app.delete('/api/products/:id', requireAdmin, (req, res) => {
//   const products = loadProducts();
//   const filtered = products.filter(p => p.id != req.params.id);
//   saveProducts(filtered);
//   res.json({ message: 'Deleted' });
// });


// // Normalize product to keep schema consistent
// function normalizeProduct(p) {
//   const safe = { ...p };

//   safe.id = Number(safe.id);
//   if (!Number.isFinite(safe.id)) safe.id = Date.now();

//   safe.name = safe.name ? String(safe.name) : '';
//   safe.size = safe.size ? String(safe.size) : '';
//   safe.price = safe.price !== undefined && safe.price !== null ? String(safe.price) : '';

//   // Accept both legacy and consistent stock values
//   const stock = safe.stock ? String(safe.stock) : 'in stock';
//   safe.stock = stock;

//   safe.visibility = typeof safe.visibility === 'boolean' ? safe.visibility : true;
//   safe.category = safe.category ? String(safe.category) : 'Middle Eastern Perfumes';
//   safe.description = safe.description ? String(safe.description) : '';

//   safe.images = Array.isArray(safe.images) ? safe.images.map(x => String(x)) : [];

//   return safe;
// }

// // Image upload route (multi-file + deduplication)
// app.post('/api/upload', requireAdmin, upload.array('images', 10), async (req, res) => {
//   if (!req.files || req.files.length === 0) {
//     return res.status(400).json({ error: 'No files uploaded' });
//   }

//   const rawProductId = req.body.productId || 'temp';
//   const productId = String(rawProductId).replace(/[^a-zA-Z0-9_-]/g, '');
//   const uploadedUrls = [];


//   for (const file of req.files) {
//     const absolutePath = file.path;
//     const fileBuffer = await fs.readFile(absolutePath);
//     const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

//     let existingPath = null;

//     // 1️⃣ Check flat /uploads (backward compatibility)
//     try {
//       const flatDir = path.join(__dirname, 'public', 'uploads');
//       if (fsSync.existsSync(flatDir)) {
//         const flatFiles = await fs.readdir(flatDir);
//         for (const f of flatFiles) {
//           const p = path.join(flatDir, f);
//           if (fsSync.lstatSync(p).isFile()) {
//             const buf = await fs.readFile(p);
//             const h = crypto.createHash('sha256').update(buf).digest('hex');
//             if (h === hash) {
//               existingPath = `/uploads/${f}`;
//               break;
//             }
//           }
//         }
//       }
//     } catch (_) {}

//     // 2️⃣ Check structured product folder
//     if (!existingPath) {
//       try {
//         const prodDir = path.join(__dirname, 'public', 'uploads', 'products', productId);
//         const files = await fs.readdir(prodDir);
//         for (const f of files) {
//           const p = path.join(prodDir, f);
//           const buf = await fs.readFile(p);
//           const h = crypto.createHash('sha256').update(buf).digest('hex');
//           if (h === hash) {
//             existingPath = `/uploads/products/${productId}/${f}`;
//             break;
//           }
//         }
//       } catch (_) {}
//     }

//     if (existingPath) {
//       // Duplicate found → remove newly uploaded file
//       await fs.unlink(absolutePath);
//       uploadedUrls.push(existingPath);
//     } else {
//       // New image → keep it
//       uploadedUrls.push(`/uploads/products/${productId}/${file.filename}`);
//     }
//   }

//   res.json({ urls: uploadedUrls });
// });

// // Serve HTML files
// app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
// app.get('/products', (req, res) => res.sendFile(path.join(__dirname, 'public', 'products.html')));
// app.get('/product/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'product-detail.html')));
// app.get('/how-it-works', (req, res) => res.sendFile(path.join(__dirname, 'public', 'how-it-works.html')));
// app.get('/delivery-payment', (req, res) => res.sendFile(path.join(__dirname, 'public', 'delivery-payment.html')));
// app.get('/contact', (req, res) => res.sendFile(path.join(__dirname, 'public', 'contact.html')));
// app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
// // Auth check route - protected
// app.get('/api/auth', requireAdmin, (req, res) => {
//   res.json({ ok: true });
// });

// app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));