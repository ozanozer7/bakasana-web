// data/products.json dosyasından supabase/seed.sql üretir.
// Kullanım: node src/gen-seed.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { categories, products } = JSON.parse(await fs.readFile(path.join(ROOT, 'data/products.json'), 'utf8'));

const q = v => v === null || v === undefined ? 'null'
  : typeof v === 'number' ? String(v)
  : typeof v === 'boolean' ? String(v)
  : Array.isArray(v) ? `array[${v.map(q).join(', ')}]::text[]`
  : `'${String(v).replace(/'/g, "''")}'`;

const catCols = ['id', 'name', 'description', 'sort'];
const prodCols = ['slug', 'barcode', 'name', 'brand', 'category_id', 'description', 'features', 'price', 'list_price', 'image_url', 'images', 'in_stock',
  'trendyol_url', 'hepsiburada_url', 'amazon_url', 'rating', 'rating_count', 'rating_source', 'sort', 'is_active'];

let sql = '-- Otomatik üretildi: node src/gen-seed.mjs\n\n';
sql += `insert into public.categories (${catCols.join(', ')}) values\n`;
sql += categories.map(c => `  (${catCols.map(k => q(c[k])).join(', ')})`).join(',\n');
sql += `\non conflict (id) do update set ${catCols.slice(1).map(k => `${k} = excluded.${k}`).join(', ')};\n\n`;
sql += `insert into public.products (${prodCols.join(', ')}) values\n`;
sql += products.map(p => `  (${prodCols.map(k => q(p[k] ?? (k === 'features' || k === 'images' ? [] : null))).join(', ')})`).join(',\n');
sql += `\non conflict (slug) do update set ${prodCols.slice(1).map(k => `${k} = excluded.${k}`).join(', ')};\n`;

await fs.writeFile(path.join(ROOT, 'supabase/seed.sql'), sql);
console.log(`seed.sql: ${categories.length} kategori, ${products.length} ürün`);
