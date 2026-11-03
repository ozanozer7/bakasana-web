// Trendyol satıcı panelinden indirilen ürün listesini (CSV) data/products.json ile eşitler.
// Kullanım: node src/import-trendyol.mjs trendyol-urunler.csv
//
// Barkoda göre eşleşen ürünlerde fiyat, fotoğraflar, stok durumu ve Trendyol linki güncellenir;
// sizin yazdığınız açıklama, özellikler, kategori ve Hepsiburada/Amazon linkleri korunur.
// Listede olup sitede olmayan ürünler taslak olarak eklenir (is_active: false) — açıklamasını
// yazıp is_active: true yapınca sitede görünür. Arşivlenen ürünler siteden kaldırılır.
// Ardından: node src/gen-seed.mjs  ->  supabase/seed.sql dosyasını Supabase'de çalıştırın.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = process.argv[2];
if (!file) { console.error('Kullanım: node src/import-trendyol.mjs <dosya.csv>'); process.exit(1); }

function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter(r => r.some(x => x.trim()));
  return body.map(r => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}
const slugify = s => s.toLocaleLowerCase('tr').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').replace(/^(.{0,80})(-.*)?$/, '$1');
const cleanUrl = u => u ? u.split('?')[0] : null;

const rows = parseCSV(await fs.readFile(file, 'utf8'));
const dbPath = path.join(ROOT, 'data/products.json');
const db = JSON.parse(await fs.readFile(dbPath, 'utf8'));
const byBarcode = new Map(db.products.filter(p => p.barcode).map(p => [p.barcode, p]));
let updated = 0, added = 0, removed = 0;

for (const r of rows) {
  const bc = r['Barkod']; if (!bc) continue;
  const durum = `${r['Durum'] || ''} ${r['Durum Açıklaması'] || ''}`;
  const archived = /arşiv|çoklanan/i.test(durum);
  const images = Object.keys(r).filter(k => /^Görsel \d+$/.test(k)).sort((a, b) => parseInt(a.split(' ')[1]) - parseInt(b.split(' ')[1])).map(k => r[k]).filter(Boolean);
  const price = Number(String(r['Piyasa Satış Fiyatı (KDV Dahil)'] || '').replace(',', '.')) || null;
  const p = byBarcode.get(bc);
  if (p) {
    if (archived) { if (p.is_active) { p.is_active = false; removed++; } continue; }
    Object.assign(p, { price, images, image_url: images[0] || null, in_stock: !/stok girmeniz/i.test(durum), trendyol_url: cleanUrl(r['Trendyol.com Linki']) || p.trendyol_url });
    updated++;
  } else if (!archived && price) {
    db.products.push({ slug: slugify(r['Ürün Adı']), barcode: bc, name: r['Ürün Adı'], brand: 'Bakasana', category_id: null,
      description: (r['Ürün Açıklaması'] || '').split(/;\s*/).filter(Boolean).join('\n\n'), features: [], price, list_price: null,
      image_url: images[0] || null, images, in_stock: !/stok girmeniz/i.test(durum), trendyol_url: cleanUrl(r['Trendyol.com Linki']),
      hepsiburada_url: null, amazon_url: null, rating: null, rating_count: null, rating_source: null, sort: db.products.length + 1, is_active: false });
    added++;
    console.log(`Yeni taslak: ${r['Ürün Adı']} (kategori ve açıklama ekleyip is_active: true yapın)`);
  }
}
await fs.writeFile(dbPath, JSON.stringify(db, null, 2));
console.log(`Güncellenen: ${updated}, yeni taslak: ${added}, siteden kaldırılan: ${removed}`);
