// Bakasana katalog sitesi üreticisi
// Veriyi Supabase'den (yoksa data/products.json'dan) okur, dist/ klasörüne
// arama motoru dostu statik HTML, sitemap.xml ve robots.txt yazar.
//
// Ortam değişkenleri:
//   SUPABASE_URL, SUPABASE_ANON_KEY  -> veritabanı bağlantısı
//   SITE_URL                         -> sitenin gerçek adresi (site.config.json'u ezer)
//   PREVIEW=1                        -> tek sayfalık önizleme (ürün sayfası linkleri kapalı)
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(await fs.readFile(path.join(ROOT, 'site.config.json'), 'utf8'));
const SITE_URL = (process.env.SITE_URL || cfg.siteUrl).replace(/\/$/, '');
const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_ANON_KEY || '';
const PREVIEW = process.env.PREVIEW === '1';
const OUT = path.join(ROOT, process.env.OUT_DIR || 'dist');
const TODAY = new Date().toISOString().slice(0, 10);
const ASSET_DIR = path.join(ROOT, 'assets');
const ASSETS = {};
for (const f of await fs.readdir(ASSET_DIR)) {
  const mime = f.endsWith('.png') ? 'image/png' : f.endsWith('.jpg') ? 'image/jpeg' : f.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream';
  // Önizlemede her şey tek dosyada olmalı: görseller gömülür. Gerçek sitede /assets/ klasöründen sunulur.
  ASSETS[f] = PREVIEW ? `data:${mime};base64,${(await fs.readFile(path.join(ASSET_DIR, f))).toString('base64')}` : `/assets/${f}`;
}
const asset = f => ASSETS[f];
// Logodaki origami kuş, vektör olarak (assets/mark.svg)
const BIRD = (await fs.readFile(path.join(ASSET_DIR, 'mark.svg'), 'utf8')).match(/points="([^"]+)"/)[1];
const birdSvg = cls => `<svg class="${cls}" viewBox="0 0 648 520" aria-hidden="true" focusable="false"><polygon points="${BIRD}" fill="var(--coral)"/></svg>`;
const absAsset = f => SITE_URL + '/assets/' + f;
const logoImgs = `<img class="logo logo-l" src="${asset('logo.png')}" alt="Bakasana" width="381" height="130"><img class="logo logo-d" src="${asset('logo-dark.png')}" alt="Bakasana" width="381" height="130">`;

// ---------- Veri ----------
async function loadData() {
  if (SB_URL && SB_KEY) {
    const headers = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };
    const get = async q => {
      const r = await fetch(`${SB_URL}/rest/v1/${q}`, { headers });
      if (!r.ok) throw new Error(`Supabase isteği başarısız (${q}): ${r.status} ${await r.text()}`);
      return r.json();
    };
    const [categories, products] = await Promise.all([
      get('categories?select=*&order=sort'),
      get('products?select=*&is_active=eq.true&order=sort'),
    ]);
    console.log(`Veritabanından okundu: ${products.length} ürün, ${categories.length} kategori`);
    return { categories, products };
  }
  console.warn('SUPABASE_URL / SUPABASE_ANON_KEY tanımlı değil: data/products.json kullanılıyor.');
  const j = JSON.parse(await fs.readFile(path.join(ROOT, 'data/products.json'), 'utf8'));
  return { categories: j.categories, products: j.products.filter(p => p.is_active !== false) };
}

// ---------- Yardımcılar ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => n == null ? '' : new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(Number(n)) + ' TL';
const productPath = p => `/urun/${p.slug}/`;
const abs = p => SITE_URL + p;
const CHANNELS = [
  ['trendyol', 'Trendyol'],
  ['hepsiburada', 'Hepsiburada'],
  ['amazon', 'Amazon'],
];
const channelsOf = p => CHANNELS.filter(([k]) => p[`${k}_url`]).map(([k, label]) => ({ key: k, label, url: p[`${k}_url`] }));
const clip = (s, n) => (s = String(s || '').trim()).length <= n ? s : s.slice(0, s.lastIndexOf(' ', n - 1)) + '…';

// Görseli olmayan ürünler için ürüne özgü (adından türetilen) ağaç halkası çizimi
function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function rings(seed, { label = '', hidden = false } = {}) {
  const r = rng(hash(seed));
  const cx = 150 + (r() - 0.5) * 110, cy = 150 + (r() - 0.5) * 90;
  const n = 12 + Math.floor(r() * 7);
  const p1 = r() * 6.28, p2 = r() * 6.28;
  let d = '';
  let R = 4;
  for (let i = 0; i < n; i++) {
    R += (230 / n) * (0.6 + r() * 0.8);
    const amp = R * 0.035;
    const pts = [];
    for (let k = 0; k < 72; k++) {
      const a = (k / 72) * Math.PI * 2;
      const rr = R + amp * Math.sin(3 * a + p1 + i * 0.35) + amp * 0.6 * Math.sin(5 * a + p2 - i * 0.2);
      pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a) * 0.9).toFixed(1)}`);
    }
    const late = r() < 0.3;
    d += `<path d="M${pts.join('L')}Z" stroke-width="${late ? (2 + r() * 2.2).toFixed(2) : (0.7 + r() * 1).toFixed(2)}" opacity="${(0.45 + r() * 0.5).toFixed(2)}"/>`;
  }
  const ang = r() * Math.PI * 2, len = 60 + r() * 90;
  const crack = `<path d="M${(cx + 18 * Math.cos(ang)).toFixed(1)} ${(cy + 18 * Math.sin(ang)).toFixed(1)}L${(cx + len * Math.cos(ang + 0.05)).toFixed(1)} ${(cy + len * Math.sin(ang + 0.05)).toFixed(1)}" class="ring-crack"/>`;
  return `<svg viewBox="0 0 300 300" preserveAspectRatio="xMidYMid slice" ${hidden ? 'aria-hidden="true"' : `role="img" aria-label="${esc(label)}"`}><rect width="300" height="300" class="ring-bg"/><g fill="none" class="ring-lines">${d}</g>${crack}<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="3.5" class="ring-pith"/></svg>`;
}
// Fotoğraflar: MIRROR_IMAGES=1 ise yayında kendi alan adınıza kopyalanır (bkz. mirrorImages)
const IMG = new Map();
const img = u => IMG.get(u) || u;
const absImg = u => { const v = img(u); return v.startsWith('/') ? SITE_URL + v : v; };
const photosOf = p => (p.images && p.images.length) ? p.images : (p.image_url ? [p.image_url] : []);
// Ürün fotoğrafı alanı. Pazar yeri fotoğrafları dikey (2:3) ve beyaz zeminli olduğu için
// kutu sabit 3:4 oranında, fotoğraf KIRPILMADAN (contain) yerleşir. Ahşap halka çizimi yalnızca
// fotoğraf yoksa ya da yüklenemezse görünür (has-photo / noimg sınıfları).
const mediaClass = p => photosOf(p).length ? 'media has-photo' : 'media';
const media = (p, eager = false) => {
  const first = photosOf(p)[0];
  const ph = rings(p.slug, { label: `${p.name} için görsel yer tutucusu`, hidden: !!first }).replace('<svg ', '<svg class="ph" ');
  if (!first) return ph;
  return `${ph}<img class="photo" src="${esc(img(first))}" alt="${esc(p.name)}" width="600" height="900" ${eager ? 'fetchpriority="high" id="ana-foto"' : 'loading="lazy"'} decoding="async" onerror="this.parentNode.classList.add('noimg');this.remove()">`;
};
const paragraphs = t => String(t || '').split(/\n\s*\n/).map(x => x.trim()).filter(Boolean).map(x => `<p>${esc(x)}</p>`).join('');

// ---------- Stil ----------
const CSS = `
/* ---- Tasarım belirteçleri (renkler logodan: mercan kuş + kömür grisi yazı) ---- */
:root{
  --bg:#FAF7F4;--surface:#FFFFFF;--mat:#F3EFEA;--ink:#2B2B2D;--muted:#625C57;--line:#E8E2DB;--line-strong:#D6CEC5;
  --accent:#C7403B;--accent-ink:#FFFFFF;--accent-soft:#FCEBE9;--coral:#EE5B56;
  --oak:#B98447;--oak-deep:#7A5328;--ring-bg:#EBD9BC;
  --shadow:0 1px 2px rgba(43,43,45,.06),0 8px 24px -12px rgba(43,43,45,.18);
  --r-lg:18px;--r-md:12px;--r-sm:10px;
  --display:"Oswald","Arial Narrow","Roboto Condensed",sans-serif;
  --sans:"Nunito Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  --head-h:64px;
  color-scheme:light;
  box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --bg:#151413;--surface:#1E1C1A;--mat:#EEEAE5;--ink:#EEEAE6;--muted:#ABA49D;--line:#2F2C29;--line-strong:#46413C;
  --accent:#F07A74;--accent-ink:#1C1112;--accent-soft:#3A2322;--coral:#F06A64;
  --oak:#D2A06A;--oak-deep:#E6C08F;--ring-bg:#3A2D1E;--shadow:0 1px 2px rgba(0,0,0,.4),0 10px 28px -14px rgba(0,0,0,.7);color-scheme:dark}}
:root[data-theme="dark"]{
  --bg:#151413;--surface:#1E1C1A;--mat:#EEEAE5;--ink:#EEEAE6;--muted:#ABA49D;--line:#2F2C29;--line-strong:#46413C;
  --accent:#F07A74;--accent-ink:#1C1112;--accent-soft:#3A2322;--coral:#F06A64;
  --oak:#D2A06A;--oak-deep:#E6C08F;--ring-bg:#3A2D1E;--shadow:0 1px 2px rgba(0,0,0,.4),0 10px 28px -14px rgba(0,0,0,.7);color-scheme:dark}
.logo-d{display:none}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .logo-l{display:none}:root:not([data-theme="light"]) .logo-d{display:block}}
:root[data-theme="dark"] .logo-l{display:none}:root[data-theme="dark"] .logo-d{display:block}

/* ---- Temel ---- */
*,*::before,*::after{box-sizing:inherit}
html{scroll-padding-top:calc(env(safe-area-inset-top,0px) + var(--head-h) + 64px);-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:400 1rem/1.6 var(--sans);-webkit-font-smoothing:antialiased}
img,svg{max-width:100%;display:block}
a{color:inherit}
button{font:inherit;color:inherit}
:focus-visible{outline:3px solid var(--coral);outline-offset:3px;border-radius:6px}
.wrap{width:min(1200px,100% - 2rem);margin-inline:auto}
@media (min-width:720px){.wrap{width:min(1200px,100% - 3rem)}}
.skip{position:absolute;left:-999px}.skip:focus{left:1rem;top:1rem;z-index:30;background:var(--surface);padding:.5rem 1rem}
main{overflow-x:clip}
h1,h2{font-family:var(--display);font-weight:300;letter-spacing:.01em;text-wrap:balance}
h2{font-size:clamp(1.8rem,3.4vw,2.6rem);line-height:1.12;margin:0 0 .5rem}
.lead{color:var(--muted);max-width:42em;margin:0}

/* ---- Başlık ---- */
.top{position:sticky;top:env(safe-area-inset-top,0px);z-index:20;background:color-mix(in srgb,var(--bg) 90%,transparent);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
body::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:20;background:var(--bg)}
.top .wrap{display:flex;align-items:center;justify-content:space-between;gap:1rem;height:var(--head-h)}
.brand{display:flex;align-items:center;text-decoration:none}
.logo{height:38px;width:auto}
.nav{display:flex;gap:.25rem;font-size:.95rem;font-weight:600}
.nav a{text-decoration:none;color:var(--muted);padding:.6rem .8rem;border-radius:999px;min-height:44px;display:inline-flex;align-items:center;transition:color .2s,background-color .2s}
.nav a:hover{color:var(--ink);background:var(--line)}
@media (max-width:560px){.nav a:not(:first-child){display:none}}

/* ---- Hero ---- */
.hero{display:grid;grid-template-columns:1.1fr .9fr;gap:clamp(1.5rem,5vw,4.5rem);align-items:center;padding:clamp(2rem,5vw,4rem) 0 clamp(2rem,4vw,3rem)}
.hero h1{font-size:clamp(2.4rem,5.4vw,4.4rem);line-height:1.04;margin:0 0 1.1rem}
.hero p{max-width:34em;color:var(--muted);font-size:1.1rem;margin:0 0 1.6rem}
.hero-fig{position:relative;justify-self:center;width:min(100%,440px)}
.hero-art{aspect-ratio:1;border-radius:50%;overflow:hidden;box-shadow:inset 0 0 0 10px color-mix(in srgb,var(--oak-deep) 50%,transparent),0 30px 60px -30px color-mix(in srgb,var(--oak-deep) 70%,transparent)}
.hero-art svg{width:100%;height:100%}
.hero-bird{position:absolute;width:44%;height:auto;right:-6%;top:-6%;filter:drop-shadow(0 14px 16px rgba(60,20,15,.22));animation:land 1.4s .3s cubic-bezier(.2,.8,.2,1) both}
@keyframes land{from{transform:translate(18%,-22%) rotate(-8deg);opacity:0}to{transform:none;opacity:1}}
.hero-art .ring-lines{animation:grow 1.6s cubic-bezier(.2,.7,.2,1) both;transform-origin:50% 50%}
@keyframes grow{from{transform:scale(.55);opacity:0}to{transform:none;opacity:1}}
@media (max-width:820px){.hero{grid-template-columns:1fr}.hero-fig{order:-1;width:min(62%,300px)}}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;min-height:48px;padding:.7rem 1.4rem;border-radius:999px;font:700 .98rem/1.1 var(--sans);text-decoration:none;border:1.5px solid var(--accent);color:var(--accent);background:transparent;cursor:pointer;transition:background-color .2s,filter .2s}
.btn:hover{background:var(--accent-soft)}
.btn.solid{background:var(--accent);color:var(--accent-ink)}.btn.solid:hover{filter:brightness(1.08)}
.row{display:flex;flex-wrap:wrap;gap:.6rem}

/* ---- Mağazalar ---- */
.stores{display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem}
.store{padding:1.1rem 1.25rem;text-decoration:none;display:flex;flex-direction:column;gap:.15rem;background:var(--surface);border:1px solid var(--line);border-radius:var(--r-md);transition:border-color .2s,box-shadow .2s}
.store strong{font:400 1.3rem/1.2 var(--display)}
.store span{color:var(--muted);font-size:.9rem}
.store:hover{border-color:var(--line-strong);box-shadow:var(--shadow)}
@media (max-width:640px){.stores{grid-template-columns:1fr}}

/* ---- Katalog ---- */
section{padding:clamp(2.5rem,6vw,4.5rem) 0}
.cat-head{display:flex;flex-wrap:wrap;align-items:end;justify-content:space-between;gap:.5rem 1.5rem;margin-bottom:1.25rem}
.filter{position:sticky;top:calc(env(safe-area-inset-top,0px) + var(--head-h));z-index:10;background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);margin:0 0 1.5rem;padding:.6rem 0;border-bottom:1px solid var(--line)}
.chips{display:flex;gap:.5rem;margin:0;padding:0 1px;list-style:none;overflow-x:auto;scroll-snap-type:x proximity;scrollbar-width:none;overscroll-behavior-x:contain}
.chips::-webkit-scrollbar{display:none}
.chips li{flex:none;scroll-snap-align:start}
@media (min-width:1060px){.chips{flex-wrap:wrap;overflow:visible}}
.chip{min-height:44px;padding:.5rem 1rem;border-radius:999px;border:1px solid var(--line-strong);background:var(--surface);font:600 .92rem/1 var(--sans);cursor:pointer;white-space:nowrap;transition:background-color .2s,border-color .2s,color .2s}
.chip:hover{border-color:var(--ink)}
.chip[aria-pressed="true"]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.chip .n{color:var(--muted);margin-left:.4rem;font-variant-numeric:tabular-nums;font-weight:400}
.chip[aria-pressed="true"] .n{color:inherit;opacity:.75}
.count{color:var(--muted);font-size:.95rem;margin:0}

.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
@media (min-width:720px){.grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}}
@media (min-width:1060px){.grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:24px}}

/* ---- Ürün fotoğrafı alanı (kartlar, galeri, küçük resimler için tek bileşen) ---- */
.media{position:relative;display:block;aspect-ratio:3/4;overflow:hidden;background:var(--mat);isolation:isolate}
.media>.ph{position:absolute;inset:0;width:100%;height:100%}
.media.has-photo:not(.noimg)>.ph{display:none}
.media .photo{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:center;
  /* Beyaz zeminli pazar yeri fotoğrafları kutunun ton zeminine karışır; kenar boşlukları görünmez */
  mix-blend-mode:multiply;transition:transform .35s cubic-bezier(.2,.7,.2,1),filter .2s}
.badge{position:absolute;z-index:1;top:.6rem;left:.6rem;font:700 .75rem/1 var(--sans);padding:.4rem .6rem;border-radius:999px;background:#2B2B2D;color:#FFFFFF;margin:0;letter-spacing:.01em}
/* Etiketler her zaman açık renkli fotoğraf zemininin üstünde: temadan bağımsız sabit renk */
.badge.sale{left:auto;right:.6rem;background:#C7403B}

/* ---- Ürün kartı ---- */
.card{position:relative;display:flex;flex-direction:column;background:var(--surface);border:1px solid var(--line);border-radius:var(--r-lg);overflow:hidden;transition:box-shadow .25s,border-color .25s}
.card[hidden]{display:none}
.card:hover{box-shadow:var(--shadow);border-color:var(--line-strong)}
.card:not(.oos):hover .photo{transform:scale(1.04)}
.oos .photo{filter:grayscale(.9) opacity(.75)}
.card-body{display:flex;flex-direction:column;gap:.3rem;padding:.8rem .85rem .9rem;flex:1}
@media (min-width:720px){.card-body{padding:1rem 1.1rem 1.1rem}}
.cat{color:var(--accent);font-size:.78rem;font-weight:700;margin:0}
.card h3{font:600 .9rem/1.35 var(--sans);margin:0;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;min-height:5.4em}
@media (min-width:720px){.card h3{font-size:1rem;-webkit-line-clamp:3;min-height:4.05em}}
.card h3 a{text-decoration:none}.card h3 a:hover{text-decoration:underline;text-underline-offset:3px}
.price{font:400 1.25rem/1.2 var(--display);margin:.15rem 0 .1rem;font-variant-numeric:tabular-nums}
.price s{font:400 .85rem var(--sans);color:var(--muted);margin-left:.4rem}
.price .none{font:400 .9rem var(--sans);color:var(--muted)}
.rating{display:flex;align-items:center;gap:.3rem;font-size:.8rem;color:var(--muted);margin:0}
.rating svg{width:14px;height:14px;fill:#E8A33D;flex:none}
.buy{margin-top:auto;padding-top:.6rem;display:flex;flex-direction:column;gap:.4rem}
.ch{display:flex;align-items:center;justify-content:center;min-height:44px;padding:.45rem .6rem;border-radius:var(--r-sm);font:700 .85rem/1.15 var(--sans);text-align:center;text-decoration:none;border:1px solid var(--line-strong);background:transparent;transition:background-color .2s,border-color .2s,filter .2s}
.ch:first-child{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.ch:first-child:hover{filter:brightness(1.08)}
.ch:not(:first-child):hover{border-color:var(--ink)}
.oos .ch:first-child{background:transparent;color:var(--ink);border-color:var(--line-strong)}

/* ---- Ürün sayfası ---- */
.crumbs{font-size:.88rem;color:var(--muted);padding-top:1.25rem}
.crumbs ol{list-style:none;display:flex;flex-wrap:wrap;gap:.4rem;margin:0;padding:0}
.crumbs li+li::before{content:"/";margin-right:.4rem;opacity:.6}
.crumbs a{text-decoration:none}.crumbs a:hover{text-decoration:underline}
.pd{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);gap:clamp(1.5rem,4vw,3.5rem);padding:1.25rem 0 3rem;align-items:start}
@media (max-width:860px){.pd{grid-template-columns:minmax(0,1fr)}}
.gallery{display:grid;gap:.75rem}
@media (min-width:861px){.gallery{position:sticky;top:calc(env(safe-area-inset-top,0px) + var(--head-h) + 1rem);grid-template-columns:72px minmax(0,1fr);align-items:start}.gallery .thumbs{order:-1;flex-direction:column;max-height:min(78vh,700px);overflow-y:auto;overflow-x:hidden}.gallery .thumbs .thumb{flex:none;width:64px}}
.gallery .main{border-radius:var(--r-lg);aspect-ratio:4/5;max-height:min(78vh,760px);width:100%}
.thumbs{display:flex;gap:.5rem;overflow-x:auto;padding:2px;scrollbar-width:thin}
.thumb{flex:0 0 64px;padding:0;border:2px solid transparent;border-radius:var(--r-sm);overflow:hidden;cursor:pointer;background:none;transition:border-color .2s}
.thumb .media{aspect-ratio:3/4}
.thumb:hover{border-color:var(--line-strong)}
.thumb[aria-pressed="true"]{border-color:var(--accent)}
.pd-text h1{font-size:clamp(1.8rem,3.4vw,2.6rem);line-height:1.15;margin:.35rem 0 .9rem}
.buybox{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-lg);padding:1.1rem 1.2rem 1.2rem;margin:0 0 1.75rem}
.buybox .price{font-size:2rem;margin:0}
.buybox .stock{display:inline-block;margin:.5rem 0 0;font-size:.85rem;font-weight:700;padding:.3rem .65rem;border-radius:999px;background:var(--line);color:var(--ink)}
.buybox .rating{margin-top:.5rem;font-size:.88rem}
.buybox .buy{padding-top:1rem;gap:.5rem}
.buybox .ch{min-height:52px;font-size:1rem}
.note{font-size:.85rem;color:var(--muted);margin:.85rem 0 0}
.pd-text .desc p{margin:0 0 .9rem;max-width:36em}
.pd-text h2{font-size:1.35rem;margin:1.75rem 0 .6rem}
.features{padding-left:1.15rem;margin:0}
.features li{margin:.3rem 0}
.features li::marker{color:var(--coral)}

/* ---- Hakkında ve alt bilgi ---- */
.about{display:grid;grid-template-columns:1fr 1.4fr;gap:clamp(1.5rem,4vw,4rem);border-top:1px solid var(--line);padding-top:clamp(2rem,5vw,3.5rem)}
.about p{margin:0 0 1rem;max-width:38em}
@media (max-width:820px){.about{grid-template-columns:1fr}}
footer{border-top:1px solid var(--line);padding:2.5rem 0 3rem;color:var(--muted);font-size:.95rem}
footer .wrap{display:flex;flex-wrap:wrap;justify-content:space-between;gap:1.5rem}
footer .logo{height:42px}
footer nav{display:flex;flex-wrap:wrap;gap:.25rem 1.25rem}
footer nav a{min-height:44px;display:inline-flex;align-items:center}
footer a{text-decoration:none}footer a:hover{color:var(--ink);text-decoration:underline}

.ring-bg{fill:var(--ring-bg)}.ring-lines{stroke:var(--oak-deep)}.ring-crack{stroke:var(--oak-deep);stroke-width:1.6;opacity:.55;fill:none}.ring-pith{fill:var(--oak-deep)}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
`;


// ---------- Ortak sayfa iskeleti ----------
function layout({ title, description, canonical, body, jsonld = [], ogImage, type = 'website', noindex = false }) {
  const trackingCfg = (!PREVIEW && SB_URL && SB_KEY) ? JSON.stringify({ url: SB_URL, key: SB_KEY }) : 'null';
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${esc(canonical)}">`}
<meta name="theme-color" content="#FAF7F4" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#151413" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="${esc(cfg.name)}">
<meta property="og:locale" content="tr_TR">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(ogImage || absAsset('og-image.jpg'))}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" sizes="48x48" href="${asset('favicon-48.png')}">
${PREVIEW ? '' : `<link rel="icon" type="image/svg+xml" href="${asset('mark.svg')}">\n<link rel="icon" type="image/png" sizes="512x512" href="${asset('favicon-512.png')}">
<link rel="apple-touch-icon" href="${asset('apple-touch-icon.png')}">`}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Nunito+Sans:opsz,wght@6..12,400;6..12,600;6..12,700&family=Oswald:wght@300;400;500&display=swap" rel="stylesheet">
<style>${CSS.replace(/\s*\n\s*/g, '')}</style>
${jsonld.map(j => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head>
<body>
<a class="skip" href="#icerik">İçeriğe geç</a>
<header class="top"><div class="wrap">
<a class="brand" href="${PREVIEW ? '#' : '/'}" aria-label="Bakasana ana sayfa">${logoImgs}</a>
<nav class="nav" aria-label="Ana menü"><a href="${PREVIEW ? '' : '/'}#urunler">Ürünler</a><a href="${PREVIEW ? '' : '/'}#hakkimizda">Hakkımızda</a><a href="${PREVIEW ? '' : '/'}#magazalar">Mağazalarımız</a></nav>
</div></header>
<main id="icerik">
${body}
</main>
<footer><div class="wrap">
<div>${logoImgs}<p style="margin:.6rem 0 0">${esc(cfg.tagline)}<br><a href="mailto:${esc(cfg.email)}">${esc(cfg.email)}</a></p></div>
<nav aria-label="Satış kanalları">${Object.entries(cfg.stores).map(([k, s]) => `<a href="${esc(s.url)}" target="_blank" rel="noopener" data-channel="${k}" data-slug="">${esc(s.label)} mağazamız</a>`).join('')}</nav>
<div>© ${new Date().getFullYear()} ${esc(cfg.name)}</div>
</div></footer>
<script>
(function(){
  var SB=${trackingCfg};
  // Mağaza butonu tıklamalarını veritabanına kaydet
  document.addEventListener('click',function(e){
    var a=e.target.closest&&e.target.closest('a[data-channel]');
    if(!a||!SB)return;
    try{fetch(SB.url+'/rest/v1/clicks',{method:'POST',keepalive:true,headers:{'apikey':SB.key,'Authorization':'Bearer '+SB.key,'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify({product_slug:a.getAttribute('data-slug')||null,channel:a.getAttribute('data-channel'),page:location.pathname})}).catch(function(){});}catch(_){}
  });
  // Yüklenemeyen fotoğrafları kaldır (alttaki çizim görünsün)
  document.querySelectorAll('img.photo').forEach(function(i){if(i.complete&&i.naturalWidth===0){i.parentNode.classList.add('noimg');i.remove();}});
  // Ürün galerisi
  document.querySelectorAll('.thumb').forEach(function(t){t.addEventListener('click',function(){
    var main=document.getElementById('ana-foto');if(!main)return;
    main.src=t.getAttribute('data-src');
    document.querySelectorAll('.thumb').forEach(function(x){x.setAttribute('aria-pressed',String(x===t))});
  })});
  // Kategori filtresi
  var chips=document.querySelectorAll('.chip[data-filter]');
  chips.forEach(function(c){c.addEventListener('click',function(){
    var f=c.getAttribute('data-filter'),n=0;
    chips.forEach(function(x){x.setAttribute('aria-pressed',String(x===c))});
    document.querySelectorAll('#urunler .card[data-cat]').forEach(function(card){var on=f==='all'||card.getAttribute('data-cat')===f;card.hidden=!on;if(on)n++;});
    var out=document.getElementById('sonuc');if(out)out.textContent=n+' ürün';
  })});
})();
</script>
</body>
</html>`;
}

// ---------- Parçalar ----------
function priceHtml(p) {
  if (p.price == null) return `<p class="price"><span class="none">Fiyat için mağazaya bakın</span></p>`;
  const old = p.list_price && Number(p.list_price) > Number(p.price) ? `<s>${money(p.list_price)}</s>` : '';
  return `<p class="price">${money(p.price)}${old}</p>`;
}
// Türkçe bulunma eki: Trendyol’da, Hepsiburada’da, Amazon’da
const suffix = label => {
  const w = label.toLocaleLowerCase('tr');
  const back = /[aıou]/.test((w.match(/[aeıioöuü]/g) || ['a']).pop());
  const hard = /[fstkçşhp]$/.test(w);
  return '’' + (hard ? 't' : 'd') + (back ? 'a' : 'e');
};
function buyButtons(p) {
  const ch = channelsOf(p);
  const verb = p.in_stock === false ? 'gör' : 'al';
  return ch.map(c => `<a class="ch" href="${esc(c.url)}" target="_blank" rel="noopener" data-channel="${c.key}" data-slug="${esc(p.slug)}" aria-label="${esc(p.name)}: ${c.label}${suffix(c.label)} ${verb}">${c.label}${suffix(c.label)} ${verb}</a>`).join('');
}
const STAR = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z"/></svg>';
const ratingHtml = (p, long = false) => p.rating ? `<p class="rating" aria-label="5 üzerinden ${String(p.rating).replace('.', ',')} puan, ${p.rating_count} değerlendirme">${STAR}<span><strong>${String(p.rating).replace('.', ',')}</strong> (${p.rating_count})${long && p.rating_source ? ` · ${esc(p.rating_source)} değerlendirmeleri` : ''}</span></p>` : '';
const discount = p => p.list_price && p.price && Number(p.list_price) > Number(p.price) ? Math.round((1 - p.price / p.list_price) * 100) : 0;
const badges = p => (p.in_stock === false ? `<p class="badge">Stokta yok</p>` : '') + (discount(p) ? `<p class="badge sale">%${discount(p)} indirim</p>` : '');
function card(p, catName) {
  const link = PREVIEW ? null : productPath(p);
  const title = link ? `<a href="${link}">${esc(p.name)}</a>` : esc(p.name);
  return `<article class="card${p.in_stock === false ? ' oos' : ''}" data-cat="${esc(p.category_id || '')}">
${link ? `<a class="${mediaClass(p)}" href="${link}" tabindex="-1" aria-hidden="true">${media(p)}${badges(p)}</a>` : `<div class="${mediaClass(p)}">${media(p)}${badges(p)}</div>`}
<div class="card-body">
<p class="cat">${esc(catName || '')}</p>
<h3 title="${esc(p.name)}">${title}</h3>
${priceHtml(p)}
${ratingHtml(p)}
<div class="buy">${buyButtons(p)}</div>
</div></article>`;
}

// ---------- Yapılandırılmış veri (schema.org) ----------
const orgLd = () => ({
  '@context': 'https://schema.org', '@type': 'Organization', '@id': SITE_URL + '/#org',
  name: cfg.name, url: SITE_URL + '/', email: cfg.email, logo: absAsset('logo.png'),
  sameAs: Object.values(cfg.stores).map(s => s.url),
});
const productLd = (p, catName) => {
  const ld = {
    '@context': 'https://schema.org', '@type': 'Product',
    name: p.name, description: p.description, sku: p.slug,
    brand: { '@type': 'Brand', name: p.brand || cfg.name },
    category: catName, url: abs(productPath(p)),
  };
  if (photosOf(p).length) ld.image = photosOf(p).map(absImg);
  if (p.price != null) ld.offers = {
    '@type': 'Offer', url: abs(productPath(p)), priceCurrency: 'TRY', price: Number(p.price).toFixed(2),
    availability: p.in_stock === false ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock', itemCondition: 'https://schema.org/NewCondition',
    seller: { '@id': SITE_URL + '/#org' },
  };
  return ld;
};

// ---------- Sayfalar ----------
function homePage({ categories, products }) {
  const catName = Object.fromEntries(categories.map(c => [c.id, c.name]));
  const count = id => products.filter(p => p.category_id === id).length;
  const usedCats = categories.filter(c => count(c.id) > 0);
  const hb = cfg.stores.hepsiburada;
  const body = `
<div class="wrap">
<div class="hero">
<div>
<h1>El yapımı ahşap ev ve mutfak ürünleri</h1>
<p>Kağıt havluluktan baharatlığa, damacana standından askılara, ahşap avizeden şınav barına kadar Bakasana ürünlerinin hepsi burada. Beğendiğiniz ürünü seçin, Trendyol, Hepsiburada ya da Amazon’dan size uygun olanla sipariş verin.</p>
<div class="row"><a class="btn solid" href="#urunler">Ürünleri gör</a><a class="btn" href="#magazalar">Mağazalarımız</a></div>
</div>
<div class="hero-fig"><div class="hero-art">${rings('bakasana-hero-masif-ahsap', { label: 'Ahşap kütük kesitindeki yıllık halkalar' })}</div>${birdSvg('hero-bird')}</div>
</div>
</div>

<div class="wrap" id="magazalar">
<div class="stores">
${Object.entries(cfg.stores).map(([k, s]) => `<a class="store" href="${esc(s.url)}" target="_blank" rel="noopener" data-channel="${k}" data-slug=""><strong>${esc(s.label)}</strong><span>${esc(s.note || 'Bakasana mağazasını aç')}</span></a>`).join('')}
</div>
</div>

<section id="urunler"><div class="wrap">
<div class="cat-head"><div><h2>Ürünlerimiz</h2><p class="lead">Her ürünün altında, onu satın alabileceğiniz mağazalar yer alıyor.</p></div><p class="count" id="sonuc" aria-live="polite">${products.length} ürün</p></div>
<div class="filter">
<ul class="chips" aria-label="Kategoriye göre filtrele">
<li><button class="chip" type="button" data-filter="all" aria-pressed="true">Tümü<span class="n">${products.length}</span></button></li>
${usedCats.map(c => `<li><button class="chip" type="button" data-filter="${esc(c.id)}" aria-pressed="false">${esc(c.name)}<span class="n">${count(c.id)}</span></button></li>`).join('')}
</ul>
</div>
<div class="grid">
${products.map(p => card(p, catName[p.category_id])).join('\n')}
</div>
</div></section>

<section id="hakkimizda"><div class="wrap about">
<h2>Bakasana hakkında</h2>
<div>
<p>Bakasana, mutfağı ve evi düzenli tutmaya yardım eden ürünler hazırlayan küçük bir markadır. Kağıt havluluk, baharatlık ve taşıma standı gibi ürünlerimizi masif ahşaptan, elde yapıyoruz.</p>
<p>Ürünlerimizi ${Object.values(cfg.stores).map(s => s.label).join(', ').replace(/, ([^,]*)$/, ' ve $1')} mağazalarımızdan satın alabilirsiniz. Sorularınız için <a href="mailto:${esc(cfg.email)}">${esc(cfg.email)}</a> adresine yazın.</p>
</div>
</div></section>`;

  return layout({
    title: `${cfg.name} | ${cfg.tagline}`,
    description: clip(cfg.description, 158),
    canonical: SITE_URL + '/',
    body,
    jsonld: [
      orgLd(),
      { '@context': 'https://schema.org', '@type': 'WebSite', name: cfg.name, url: SITE_URL + '/', inLanguage: 'tr-TR' },
      { '@context': 'https://schema.org', '@type': 'ItemList', name: 'Bakasana ürünleri',
        itemListElement: products.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(productPath(p)), name: p.name })) },
    ],
  });
}

function productPage(p, { categories, products }) {
  const cat = categories.find(c => c.id === p.category_id);
  const related = products.filter(x => x.category_id === p.category_id && x.slug !== p.slug).slice(0, 4);
  const catName = Object.fromEntries(categories.map(c => [c.id, c.name]));
  const ch = channelsOf(p);
  const body = `
<div class="wrap">
<nav class="crumbs" aria-label="Sayfa yolu"><ol><li><a href="/">Ana sayfa</a></li>${cat ? `<li><a href="/#urunler">${esc(cat.name)}</a></li>` : ''}<li aria-current="page">${esc(clip(p.name, 48))}</li></ol></nav>
<article class="pd">
<div class="gallery${p.in_stock === false ? ' oos' : ''}">
<div class="${mediaClass(p)} main">${media(p, true)}${badges(p)}</div>
${photosOf(p).length > 1 ? `<div class="thumbs" role="group" aria-label="Ürün fotoğrafları">${photosOf(p).map((u, i) => `<button type="button" class="thumb" aria-label="Fotoğraf ${i + 1} / ${photosOf(p).length}" aria-pressed="${i === 0}" data-src="${esc(img(u))}"><span class="media has-photo"><img class="photo" src="${esc(img(u))}" alt="" width="600" height="900" loading="lazy" decoding="async" onerror="this.closest('.thumb').remove()"></span></button>`).join('')}</div>` : ''}
</div>
<div class="pd-text">
<p class="cat">${esc(cat?.name || '')}${p.brand && p.brand !== cfg.name ? ` · ${esc(p.brand)}` : ''}</p>
<h1>${esc(p.name)}</h1>
<div class="buybox${p.in_stock === false ? ' oos' : ''}">
${priceHtml(p)}
${p.in_stock === false ? '<p class="stock">Şu an stokta yok</p>' : ''}
${ratingHtml(p, true)}
<div class="buy">${ch.length ? buyButtons(p) : Object.entries(cfg.stores).map(([k, s]) => `<a class="ch" href="${esc(s.url)}" target="_blank" rel="noopener" data-channel="${k}" data-slug="${esc(p.slug)}">${esc(s.label)} mağazamız</a>`).join('')}</div>
<p class="note">Fiyat ve stok durumu mağazaya göre değişebilir. Son fiyatı satın alacağınız mağazada görürsünüz.</p>
</div>
<div class="desc">${paragraphs(p.description)}</div>
${p.features?.length ? `<h2>Özellikler</h2><ul class="features">${p.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
</div>
</article>
</div>
${related.length ? `<section style="padding-top:0"><div class="wrap"><h2 style="margin-bottom:1.25rem">Benzer ürünler</h2><div class="grid">${related.map(r => card(r, catName[r.category_id])).join('')}</div></div></section>` : ''}`;

  return layout({
    title: `${clip(p.name, 55)} | ${cfg.name}`,
    description: clip(`${String(p.description || '').replace(/\s+/g, ' ')} ${ch.length ? ch.map(c => c.label).join(', ') + ' üzerinden satın alın.' : ''}`, 158),
    canonical: abs(productPath(p)),
    type: 'product',
    ogImage: photosOf(p)[0] ? absImg(photosOf(p)[0]) : undefined,
    body,
    jsonld: [
      productLd(p, cat?.name),
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Ana sayfa', item: SITE_URL + '/' },
        ...(cat ? [{ '@type': 'ListItem', position: 2, name: cat.name, item: SITE_URL + '/#urunler' }] : []),
        { '@type': 'ListItem', position: cat ? 3 : 2, name: p.name, item: abs(productPath(p)) },
      ] },
    ],
  });
}

function notFoundPage() {
  return layout({
    title: `Sayfa bulunamadı | ${cfg.name}`, description: 'Aradığınız sayfa bulunamadı.', canonical: SITE_URL + '/404.html', noindex: true,
    body: `<div class="wrap" style="padding:5rem 0"><h1 style="font:400 2.4rem var(--serif)">Bu sayfa bulunamadı</h1><p class="lead">Ürün kaldırılmış ya da adresi değişmiş olabilir.</p><a class="btn solid" href="/#urunler">Tüm ürünlere dön</a></div>`,
  });
}

// Fotoğrafları pazar yeri sunucusundan indirip sitenin /img/ klasörüne koyar.
// Böylece görseller kendi alan adınızdan sunulur ve Google Görseller sizin sitenizi kaynak gösterir.
async function mirrorImages(products) {
  const dir = path.join(OUT, 'img');
  await fs.mkdir(dir, { recursive: true });
  const jobs = [];
  for (const p of products) photosOf(p).forEach((u, i) => {
    const ext = (u.match(/\.(jpe?g|png|webp)(?:\?|$)/i)?.[1] || 'jpg').toLowerCase().replace('jpeg', 'jpg');
    jobs.push({ u, name: `${p.slug}-${i + 1}.${ext}` });
  });
  let ok = 0;
  for (let i = 0; i < jobs.length; i += 6) {
    await Promise.all(jobs.slice(i, i + 6).map(async j => {
      try {
        const r = await fetch(j.u);
        if (!r.ok) throw new Error(r.status);
        await fs.writeFile(path.join(dir, j.name), Buffer.from(await r.arrayBuffer()));
        IMG.set(j.u, `/img/${j.name}`); ok++;
      } catch (e) { console.warn(`Fotoğraf indirilemedi, uzak adres kullanılacak: ${j.u} (${e.message})`); }
    }));
  }
  console.log(`Fotoğraflar: ${ok}/${jobs.length} indirildi`);
}

// ---------- Yaz ----------
const data = await loadData();
await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(OUT, { recursive: true });
if (process.env.MIRROR_IMAGES === '1' && !PREVIEW) await mirrorImages(data.products);
if (!PREVIEW) await fs.cp(ASSET_DIR, path.join(OUT, 'assets'), { recursive: true });
await fs.writeFile(path.join(OUT, 'index.html'), homePage(data));

if (!PREVIEW) {
  for (const p of data.products) {
    const dir = path.join(OUT, 'urun', p.slug);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'index.html'), productPage(p, data));
  }
  await fs.writeFile(path.join(OUT, '404.html'), notFoundPage());
  const urls = [{ loc: SITE_URL + '/', lastmod: TODAY },
    ...data.products.map(p => ({ loc: abs(productPath(p)), lastmod: (p.updated_at || TODAY).slice(0, 10) }))];
  await fs.writeFile(path.join(OUT, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${esc(u.loc)}</loc><lastmod>${u.lastmod}</lastmod></url>`).join('\n')}\n</urlset>\n`);
  await fs.writeFile(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
}
console.log(`Bitti: ${OUT} (${PREVIEW ? 'önizleme' : data.products.length + ' ürün sayfası + sitemap'})`);
