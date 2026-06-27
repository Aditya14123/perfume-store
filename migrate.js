require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Please configure it in .env before running migrations.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  const PRODUCTS_FILE = path.join(__dirname, 'products.json');
  if (!fs.existsSync(PRODUCTS_FILE)) {
    console.log('No products.json found, nothing to migrate');
    process.exit(0);
  }

  const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE));
  console.log(`Migrating ${products.length} products...`);

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

  for (const p of products) {
    await pool.query(
      `INSERT INTO products (id, name, size, price, stock, visibility, category, description, images)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         name=$2, size=$3, price=$4, stock=$5,
         visibility=$6, category=$7, description=$8, images=$9`,
      [Number(p.id), p.name || '', p.size || '', String(p.price || ''),
       p.stock || 'in stock', p.visibility !== false,
       p.category || 'Middle Eastern Perfumes',
       p.description || '', JSON.stringify(p.images || [])]
    );
    console.log(`✓ Migrated: ${p.name}`);
  }

  console.log('Migration complete!');
  await pool.end();
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});