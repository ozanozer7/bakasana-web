# Bakasana katalog sitesi

Ürünlerinizi listeleyen, ziyaretçiyi Trendyol, Hepsiburada ve Amazon mağazalarınıza yönlendiren, Google için hazırlanmış katalog sitesi.

## Nasıl çalışır?

1. Ürünler **Supabase** veritabanında durur (ücretsiz plan yeterli).
2. **Netlify** her yayında `src/build.mjs` dosyasını çalıştırır: ürünleri veritabanından çeker, her ürün için ayrı bir sayfa (`/urun/<adres>/`), `sitemap.xml` ve `robots.txt` üretir.
3. Ziyaretçi bir mağaza butonuna tıkladığında bu tıklama veritabanındaki `clicks` tablosuna yazılır. Hangi ürünün hangi kanalda ilgi gördüğünü buradan izlersiniz.

Sayfalar hazır HTML olarak sunulduğu için Google içeriği doğrudan okur. Her sayfada başlık, açıklama, canonical adresi, Open Graph etiketleri ve schema.org ürün verisi (Product, Offer, BreadcrumbList, Organization) bulunur.

## Kurulum (yaklaşık 30 dakika)

### 1. Veritabanı (Supabase) — TAMAMLANDI

Proje: `bakasana-web` (Frankfurt). Tablolar, güvenlik kuralları, 30 ürün ve `urunler` fotoğraf klasörü kurulu; bağlantı bilgileri `netlify.toml` içine yazıldı. Aşağıdaki adımlar yeni bir proje kurmak isterseniz diye duruyor.

1. https://supabase.com adresinde ücretsiz hesap açın, yeni proje oluşturun (bölge: Frankfurt / eu-central-1).
2. Sol menüden **SQL Editor**’ü açın. Önce `supabase/schema.sql`, sonra `supabase/seed.sql` dosyasının içeriğini yapıştırıp **Run** deyin.
3. **Project Settings > API** sayfasından `Project URL` ve `anon public` anahtarını not edin. (Bu anahtar herkese açık olacak şekilde tasarlanmıştır; güvenlik kuralları onunla yalnızca ürün okunabilmesini ve tıklama eklenebilmesini sağlar. `service_role` anahtarını asla siteye koymayın.)

### 2. Kodu GitHub’a yükleyin
Yeni bir GitHub deposu açıp bu klasörün içeriğini yükleyin.

### 3. Yayın (Netlify)
1. https://netlify.com üzerinde **Add new site > Import from Git** ile depoyu seçin. Build ayarları `netlify.toml`’dan otomatik gelir.
2. Supabase bağlantısı `netlify.toml` içinde hazır. Alan adınızı aldığınızda **Site configuration > Environment variables** bölümüne yalnızca `SITE_URL` = `https://www.bakasana.com.tr` (kendi adresiniz) ekleyin.
3. **Deploy** deyin.

### 4. Alan adı
`bakasana.com.tr` gibi bir alan adı alın (yıllık birkaç yüz TL) ve Netlify’da **Domain management** bölümünden bağlayın. SSL sertifikası otomatik gelir. `site.config.json` içindeki `siteUrl` değerini de buna göre güncelleyin.

### 5. Ürün değişince site kendini güncellesin
1. Netlify’da **Build & deploy > Build hooks** bölümünden bir hook oluşturun, verdiği adresi kopyalayın.
2. Supabase’de **Database > Webhooks > Create** ile `products` tablosundaki Insert/Update/Delete olaylarında bu adrese POST isteği gönderen bir webhook tanımlayın.

Artık Supabase’in **Table Editor** ekranından ürün eklediğinizde ya da fiyat değiştirdiğinizde site 1–2 dakika içinde yenilenir.

### 6. Google’a tanıtın
1. https://search.google.com/search-console adresinde sitenizi ekleyin ve doğrulayın.
2. **Sitemaps** bölümüne `sitemap.xml` yazıp gönderin.
3. https://search.google.com/test/rich-results ile bir ürün sayfasını test edin.
4. Ücretsiz bir **Google İşletme Profili** açıp sitenizi oraya ekleyin.

## Logo ve marka

`assets/` klasöründe logonuzun site için hazırlanmış sürümleri var: `logo.png` (açık zemin), `logo-dark.png` (karanlık mod, yazı açık renk), `mark.svg` (origami kuş, vektör), favicon ve telefon ana ekranı simgeleri, sosyal medyada paylaşıldığında görünen `og-image.jpg`. Site renkleri logodan alındı: mercan #EE5B56 vurgu rengi, butonlarda okunabilirlik için bir ton koyusu #C7403B, yazılarda logodaki koyu gri. Logoyu değiştirirseniz bu dosyaların adlarını koruyarak yenilerini koymanız yeterli.

## Ürün yönetimi

Supabase **Table Editor > products**:

| Alan | Açıklama |
|---|---|
| `slug` | Ürün adresi. Küçük harf, Türkçe karaktersiz, tireli. Yayından sonra değiştirmeyin (Google’daki sıralama kaybolur). |
| `name`, `description`, `features` | Başlık, açıklama ve madde madde özellikler. Açıklamayı pazar yerindekinden farklı yazın; Google aynı metni tekrar eden sayfaları geri planda tutar. |
| `price`, `list_price` | Güncel fiyat ve (varsa) indirim öncesi fiyat. Boş bırakırsanız fiyat gösterilmez. |
| `images` | Ürün fotoğraflarının adresleri, sırasıyla (ilki ana fotoğraf). Şu an Trendyol’daki fotoğraflarınız kullanılıyor. Yeni fotoğraf için Supabase **Storage**’da herkese açık bir klasöre yükleyip adresini ekleyebilirsiniz. Fotoğrafı olmayan ya da yüklenemeyen ürünlerde ahşap halka çizimi gösterilir. |
| `image_url` | Ana fotoğraf (`images` listesinin ilki ile aynı tutun). |
| `in_stock` | `false` ise sitede “Şu an stokta yok” yazar, buton “Trendyol’da gör” olur. |
| `barcode` | Trendyol barkodu. Aşağıdaki içe aktarma bununla eşleştirir. |
| `trendyol_url`, `hepsiburada_url`, `amazon_url` | Ürünün o mağazadaki adresi. Boş olan kanalın butonu çıkmaz. |
| `is_active` | `false` yaparsanız ürün siteden kalkar. |

### Trendyol listesinden güncelleme

Trendyol satıcı panelinden ürün listesini CSV olarak indirip şunu çalıştırın:

```
node src/import-trendyol.mjs trendyol-urunler.csv
node src/gen-seed.mjs
```

Barkodu eşleşen ürünlerin fiyatı, fotoğrafları, stok durumu ve Trendyol linki güncellenir; sizin yazdığınız açıklamalar, kategoriler ve Hepsiburada/Amazon linkleri korunur. Yeni ürünler taslak olarak eklenir (`is_active: false`); kategori ve açıklamasını yazıp `true` yapınca sitede görünür. Arşivlenen ürünler siteden kaldırılır. Sonra oluşan `supabase/seed.sql` dosyasını Supabase SQL Editor’de çalıştırın.

### Fotoğraflar

Netlify yayınında `MIRROR_IMAGES=1` açık: fotoğraflar her yayında Trendyol sunucusundan indirilip sitenizin `/img/` klasöründen sunulur. Böylece Trendyol bir görseli kaldırsa bile siteniz etkilenmez ve Google Görseller’de kaynak olarak sizin siteniz görünür.

### Raporlar

Tıklama raporu için SQL Editor’de: `select * from click_report;`

## Bilgisayarda deneme

En hızlı yol: klasördeki `onizleme.html` dosyasına çift tıklayın. Tüm ürünler fotoğraflarıyla tarayıcınızda açılır (internet bağlantısı gerekir).

Tam siteyi denemek için

Node.js 18+ yüklüyken:

```
node src/build.mjs          # data/products.json ile üretir
npx serve dist              # http://localhost:3000
```

Veritabanıyla denemek için önce `SUPABASE_URL` ve `SUPABASE_ANON_KEY` ortam değişkenlerini tanımlayın.
