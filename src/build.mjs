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
// Fotoğraf yüklenemezse (silinmiş, engellenmiş) altındaki ahşap halka çizimi görünür
const media = (p, eager = false) => {
  const first = photosOf(p)[0];
  const ph = rings(p.slug, { label: `${p.name} için görsel yer tutucusu`, hidden: !!first });
  if (!first) return ph;
  return `${ph}<img class="photo" src="${esc(img(first))}" alt="${esc(p.name)}" width="800" height="800" ${eager ? 'fetchpriority="high" id="ana-foto"' : 'loading="lazy"'} decoding="async" onerror="this.remove()">`;
};
const paragraphs = t => String(t || '').split(/\n\s*\n/).map(x => x.trim()).filter(Boolean).map(x => `<p>${esc(x)}</p>`).join('');

// ---------- Stil ----------
const CSS = `
:root{
  --bg:#F6F5F3;--surface:#FFFFFF;--ink:#2B2B2D;--muted:#66666A;--line:#E2DFDB;
  --accent:#C7403B;--accent-ink:#FFFFFF;--accent-soft:#FBE9E7;--coral:#EE5B56;--oak:#B98447;--oak-deep:#7A5328;--ring-bg:#EBD9BC;
  --radius-lg:22px;--radius-sm:10px;
  --serif:"Oswald","Arial Narrow","Roboto Condensed",sans-serif;
  --sans:"Instrument Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  color-scheme:light;
  box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --bg:#18181A;--surface:#212124;--ink:#ECE9E6;--muted:#A9A6A3;--line:#333336;
  --accent:#F07A74;--accent-ink:#1C1112;--accent-soft:#3A2322;--coral:#F06A64;--oak:#D2A06A;--oak-deep:#E6C08F;--ring-bg:#3A2D1E;color-scheme:dark}}
:root[data-theme="dark"]{
  --bg:#18181A;--surface:#212124;--ink:#ECE9E6;--muted:#A9A6A3;--line:#333336;
  --accent:#F07A74;--accent-ink:#1C1112;--accent-soft:#3A2322;--coral:#F06A64;--oak:#D2A06A;--oak-deep:#E6C08F;--ring-bg:#3A2D1E;color-scheme:dark}
.logo-d{display:none}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .logo-l{display:none}:root:not([data-theme="light"]) .logo-d{display:block}}
:root[data-theme="dark"] .logo-l{display:none}:root[data-theme="dark"] .logo-d{display:block}
*,*::before,*::after{box-sizing:inherit}
html{scroll-padding-top:calc(env(safe-area-inset-top,0px) + 72px);-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:400 1.0625rem/1.6 var(--sans)}
img,svg{max-width:100%;display:block}
a{color:inherit}
:focus-visible{outline:3px solid var(--coral);outline-offset:3px;border-radius:6px}
.wrap{width:min(1180px,100% - 2.5rem);margin-inline:auto}
.skip{position:absolute;left:-999px}.skip:focus{left:1rem;top:1rem;z-index:20;background:var(--surface);padding:.5rem 1rem}

/* Başlık */
.top{position:sticky;top:env(safe-area-inset-top,0px);z-index:10;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
body::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:10;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(10px)}
.top .wrap{display:flex;align-items:center;justify-content:space-between;gap:1rem;min-height:64px}
.brand{display:flex;align-items:center;text-decoration:none}
.logo{height:42px;width:auto}
footer .logo{height:46px}
main{overflow-x:clip}
.nav{display:flex;gap:1.4rem;font-size:.95rem}
.nav a{text-decoration:none;color:var(--muted)}.nav a:hover{color:var(--ink)}
@media (max-width:640px){.nav a:not(:last-child){display:none}}

/* Hero */
.hero{display:grid;grid-template-columns:1.05fr .95fr;gap:clamp(1.5rem,4vw,4rem);align-items:center;padding:clamp(2.5rem,6vw,5rem) 0 clamp(2rem,5vw,4rem)}
.hero h1{font:300 clamp(2.6rem,6vw,4.9rem)/1.06 var(--serif);letter-spacing:.005em;margin:0 0 1.25rem;text-wrap:balance}
.hero p{max-width:34em;color:var(--muted);font-size:1.125rem;margin:0 0 1.75rem}
.hero-art{position:relative;aspect-ratio:1;border-radius:50%;overflow:hidden;box-shadow:inset 0 0 0 10px color-mix(in srgb,var(--oak-deep) 55%,transparent),0 30px 60px -30px color-mix(in srgb,var(--oak-deep) 70%,transparent)}
.hero-art svg{width:100%;height:100%}
.hero-fig{position:relative}
.hero-bird{position:absolute;width:44%;height:auto;right:-7%;top:-6%;filter:drop-shadow(0 14px 16px rgba(60,20,15,.22));animation:land 1.4s .3s cubic-bezier(.2,.8,.2,1) both}
@keyframes land{from{transform:translate(18%,-22%) rotate(-8deg);opacity:0}to{transform:none;opacity:1}}
@media (prefers-reduced-motion:reduce){.hero-bird{animation:none}}
.hero-art .ring-lines{animation:grow 1.6s cubic-bezier(.2,.7,.2,1) both;transform-origin:50% 50%}
@keyframes grow{from{transform:scale(.55);opacity:0}to{transform:none;opacity:1}}
@media (prefers-reduced-motion:reduce){.hero-art .ring-lines{animation:none}}
@media (max-width:820px){.hero{grid-template-columns:1fr}.hero-fig{max-width:340px;justify-self:center;order:-1;width:68%}}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;min-height:46px;padding:.65rem 1.25rem;border-radius:999px;font:600 .975rem/1.1 var(--sans);text-decoration:none;border:1.5px solid var(--accent);color:var(--accent);background:transparent;cursor:pointer}
.btn:hover{background:var(--accent-soft)}
.btn.solid{background:var(--accent);color:var(--accent-ink)}.btn.solid:hover{filter:brightness(1.08)}
.row{display:flex;flex-wrap:wrap;gap:.6rem}

/* Mağazalar */
.stores{display:grid;grid-template-columns:repeat(3,1fr);border-block:1px solid var(--line)}
.store{padding:1.4rem 1.25rem;text-decoration:none;display:flex;flex-direction:column;gap:.2rem}
.store+.store{border-left:1px solid var(--line)}
.store strong{font:400 1.35rem/1.2 var(--serif)}
.store span{color:var(--muted);font-size:.92rem}
.store:hover strong{text-decoration:underline;text-decoration-color:var(--coral);text-underline-offset:5px}
@media (max-width:640px){.stores{grid-template-columns:1fr}.store+.store{border-left:0;border-top:1px solid var(--line)}}

/* Katalog */
section{padding:clamp(2.5rem,6vw,4.5rem) 0}
h2{font:300 clamp(1.9rem,3.6vw,2.8rem)/1.12 var(--serif);letter-spacing:.01em;margin:0 0 .6rem}
.lead{color:var(--muted);max-width:40em;margin:0 0 1.75rem}
.chips{display:flex;flex-wrap:wrap;gap:.5rem;margin:0 0 2rem;padding:0;list-style:none}
.chip{min-height:40px;padding:.45rem 1rem;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font:500 .93rem/1 var(--sans);cursor:pointer}
.chip[aria-pressed="true"]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.chip .n{color:var(--muted);margin-left:.35rem;font-variant-numeric:tabular-nums}
.chip[aria-pressed="true"] .n{color:inherit;opacity:.7}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:clamp(1rem,2.4vw,1.75rem)}
.card{display:flex;flex-direction:column;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);overflow:hidden}
.card[hidden]{display:none}
.card-media{position:relative;display:block;aspect-ratio:1;overflow:hidden;background:var(--ring-bg)}
.card-media svg,.card-media img{width:100%;height:100%;object-fit:cover}
.card-body{display:flex;flex-direction:column;gap:.35rem;padding:1.1rem 1.15rem 1.2rem;flex:1}
.cat{color:var(--accent);font-size:.85rem;font-weight:600;margin:0}
.card h3{font:600 1.04rem/1.35 var(--sans);margin:0}
.card h3 a{text-decoration:none}.card h3 a:hover{text-decoration:underline;text-underline-offset:3px}
.price{font:400 1.3rem/1.2 var(--serif);margin:.25rem 0 .6rem}
.price s{font:400 .9rem var(--sans);color:var(--muted);margin-left:.4rem}
.price .none{font:400 .92rem var(--sans);color:var(--muted)}
.rating{font-size:.85rem;color:var(--muted);margin:0}
.buy{margin-top:auto;display:flex;flex-wrap:wrap;gap:.45rem}
.ch{flex:1 1 auto;display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:.4rem .8rem;border-radius:var(--radius-sm);font:600 .88rem/1.1 var(--sans);text-decoration:none;border:1px solid var(--line);background:var(--bg)}
.ch:first-child{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
.ch:hover{border-color:var(--accent)}
.photo{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#fff}
.card:not(.oos) .card-media:hover .photo{transform:scale(1.03)}.photo{transition:transform .4s ease}
@media (prefers-reduced-motion:reduce){.photo{transition:none}}
.oos .card-media .photo{filter:grayscale(.85) contrast(.85) brightness(1.05)}
.badge{display:inline-block;align-self:flex-start;font-size:.8rem;font-weight:600;padding:.2rem .6rem;border-radius:999px;background:var(--line);color:var(--ink);margin:0}
.thumbs{display:flex;gap:.5rem;margin-top:.75rem;overflow-x:auto;padding:.2rem .1rem .4rem}
.thumb{flex:0 0 72px;height:72px;padding:0;border:2px solid transparent;border-radius:12px;overflow:hidden;background:#fff;cursor:pointer}
.thumb[aria-pressed="true"]{border-color:var(--accent)}
.thumb img{width:100%;height:100%;object-fit:contain}
.pd-text p{margin:0 0 .9rem;max-width:36em}
.ring-bg{fill:var(--ring-bg)}.ring-lines{stroke:var(--oak-deep)}.ring-crack{stroke:var(--oak-deep);stroke-width:1.6;opacity:.55;fill:none}.ring-pith{fill:var(--oak-deep)}

/* Ürün sayfası */
.crumbs{font-size:.9rem;color:var(--muted);padding-top:1.5rem}
.crumbs ol{list-style:none;display:flex;flex-wrap:wrap;gap:.4rem;margin:0;padding:0}
.crumbs li+li::before{content:"/";margin-right:.4rem;opacity:.6}
.crumbs a{text-decoration:none}.crumbs a:hover{text-decoration:underline}
.pd{display:grid;grid-template-columns:1fr 1fr;gap:clamp(1.5rem,4vw,3.5rem);padding:1.5rem 0 3rem;align-items:start}
.pd-media{position:relative;border-radius:var(--radius-lg);overflow:hidden;aspect-ratio:1;background:var(--ring-bg)}
.pd-media svg,.pd-media img{width:100%;height:100%;object-fit:cover}
.pd h1{font:300 clamp(1.9rem,3.8vw,2.9rem)/1.14 var(--serif);letter-spacing:.005em;margin:.3rem 0 1rem}
.pd .price{font-size:1.8rem}
.pd ul.features{padding-left:1.1rem;margin:1rem 0 1.75rem}
.pd ul.features li{margin:.25rem 0}
.pd .buy{gap:.6rem}.pd .ch{min-height:50px;font-size:1rem;flex:1 1 180px}
.note{font-size:.88rem;color:var(--muted);margin-top:1rem}
@media (max-width:820px){.pd{grid-template-columns:1fr}}

/* Hakkında ve alt bilgi */
.about{display:grid;grid-template-columns:1fr 1.4fr;gap:clamp(1.5rem,4vw,4rem);border-top:1px solid var(--line)}
.about p{margin:0 0 1rem;max-width:38em}
@media (max-width:820px){.about{grid-template-columns:1fr}}
footer{border-top:1px solid var(--line);padding:2.5rem 0 3rem;color:var(--muted);font-size:.95rem}
footer .wrap{display:flex;flex-wrap:wrap;justify-content:space-between;gap:1.5rem}
footer nav{display:flex;flex-wrap:wrap;gap:1.25rem}
footer a{text-decoration:none}footer a:hover{color:var(--ink);text-decoration:underline}
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
<meta name="theme-color" content="#F6F5F3" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#18181A" media="(prefers-color-scheme: dark)">
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
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&family=Oswald:wght@300;400;500&display=swap" rel="stylesheet">
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
  document.querySelectorAll('img.photo').forEach(function(i){if(i.complete&&i.naturalWidth===0)i.remove();});
  // Ürün galerisi
  document.querySelectorAll('.thumb').forEach(function(t){t.addEventListener('click',function(){
    var main=document.getElementById('ana-foto');if(!main)return;
    main.src=t.getAttribute('data-src');
    document.querySelectorAll('.thumb').forEach(function(x){x.setAttribute('aria-pressed',String(x===t))});
  })});
  // Kategori filtresi
  var chips=document.querySelectorAll('.chip[data-filter]');
  chips.forEach(function(c){c.addEventListener('click',function(){
    var f=c.getAttribute('data-filter');
    chips.forEach(function(x){x.setAttribute('aria-pressed',String(x===c))});
    document.querySelectorAll('.card[data-cat]').forEach(function(card){card.hidden=!(f==='all'||card.getAttribute('data-cat')===f)});
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
const stockBadge = p => p.in_stock === false ? `<p class="badge">Şu an stokta yok</p>` : '';
function card(p, catName) {
  const link = PREVIEW ? null : productPath(p);
  const title = link ? `<a href="${link}">${esc(p.name)}</a>` : esc(p.name);
  return `<article class="card${p.in_stock === false ? ' oos' : ''}" data-cat="${esc(p.category_id || '')}">
${link ? `<a class="card-media" href="${link}" tabindex="-1" aria-hidden="true">${media(p)}</a>` : `<div class="card-media">${media(p)}</div>`}
<div class="card-body">
<p class="cat">${esc(catName || '')}</p>
<h3>${title}</h3>
${priceHtml(p)}
${stockBadge(p)}
${p.rating ? `<p class="rating">${esc(p.rating_source || '')} puanı ${String(p.rating).replace('.', ',')} / 5 (${p.rating_count} değerlendirme)</p>` : ''}
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
<h2>Ürünlerimiz</h2>
<p class="lead">${products.length} ürün. Her ürünün altında, onu satın alabileceğiniz mağazalar yer alıyor.</p>
<ul class="chips" aria-label="Kategoriye göre filtrele">
<li><button class="chip" type="button" data-filter="all" aria-pressed="true">Tümü<span class="n">${products.length}</span></button></li>
${usedCats.map(c => `<li><button class="chip" type="button" data-filter="${esc(c.id)}" aria-pressed="false">${esc(c.name)}<span class="n">${count(c.id)}</span></button></li>`).join('')}
</ul>
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
  const related = products.filter(x => x.category_id === p.category_id && x.slug !== p.slug).slice(0, 3);
  const catName = Object.fromEntries(categories.map(c => [c.id, c.name]));
  const ch = channelsOf(p);
  const body = `
<div class="wrap">
<nav class="crumbs" aria-label="Sayfa yolu"><ol><li><a href="/">Ana sayfa</a></li>${cat ? `<li><a href="/#urunler">${esc(cat.name)}</a></li>` : ''}<li aria-current="page">${esc(clip(p.name, 48))}</li></ol></nav>
<article class="pd">
<div>
<div class="pd-media">${media(p, true)}</div>
${photosOf(p).length > 1 ? `<div class="thumbs" role="group" aria-label="Ürün fotoğrafları">${photosOf(p).map((u, i) => `<button type="button" class="thumb" aria-label="Fotoğraf ${i + 1}" aria-pressed="${i === 0}" data-src="${esc(img(u))}"><img src="${esc(img(u))}" alt="" loading="lazy" onerror="this.parentNode.remove()"></button>`).join('')}</div>` : ''}
</div>
<div class="pd-text">
<p class="cat">${esc(cat?.name || '')}${p.brand && p.brand !== cfg.name ? ` · ${esc(p.brand)}` : ''}</p>
<h1>${esc(p.name)}</h1>
${priceHtml(p)}
${stockBadge(p)}
${p.rating ? `<p class="rating">${esc(p.rating_source || '')} puanı ${String(p.rating).replace('.', ',')} / 5 (${p.rating_count} değerlendirme)</p>` : ''}
${paragraphs(p.description)}
${p.features?.length ? `<ul class="features">${p.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
<h2 style="font-size:1.3rem;margin-bottom:.8rem">Nereden satın alabilirim?</h2>
<div class="buy">${ch.length ? buyButtons(p) : Object.entries(cfg.stores).map(([k, s]) => `<a class="ch" href="${esc(s.url)}" target="_blank" rel="noopener" data-channel="${k}" data-slug="${esc(p.slug)}">${esc(s.label)} mağazamız</a>`).join('')}</div>
<p class="note">Fiyat ve stok durumu mağazaya göre değişebilir. Son fiyatı satın alacağınız mağazada görürsünüz.</p>
</div>
</article>
</div>
${related.length ? `<section style="padding-top:0"><div class="wrap"><h2>Benzer ürünler</h2><div class="grid" style="margin-top:1.5rem">${related.map(r => card(r, catName[r.category_id])).join('')}</div></div></section>` : ''}`;

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
