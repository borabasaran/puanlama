# Almanca Yazma Puanlama Platformu

TÜBİTAK 3005-B projesi — "Yapay Zekâ Tabanlı Değerlendirmenin Yabancı Dil Eğitiminde Pedagojik
Geçerliği ve Öğretmen Kararlarına Etkisi" — kapsamında geliştirilen çevrim içi puanlama arayüzü.

## Ne yapar

- Kimlik bilgisi içermeyen belirteçle (token) anonim giriş
- Çapa seti + dengelenmiş rastgele rotasyona dayalı otomatik metin atama
- CEFR temelli dört analitik boyut (0–4) + bütüncül puan (0–10) + "puanlanamaz" işaretlemesi
- Karara duyulan güven derecesi (1–5) ve metin başına süre kaydı
- Deney koşullarının (A: model puanı yok · B: gösteriliyor · C: kaydırılmış) rastgele atanması
- Oturumu bölüp aynı belirteçle kaldığı yerden devam etme
- Yönetim panelinde kapsam izleme ve CSV dışa aktarım (geniş biçim + MFRM için uzun biçim)

## Dosyalar

| Dosya | Açıklama |
|---|---|
| `index.html` | Puanlayıcı arayüzü. Yalnızca iki veritabanı fonksiyonunu çağırır. |
| `yonetim.html` | Yönetim paneli: veri izleme, CSV dışa aktarım ve metin havuzu yönetimi (Word/metin dosyasından transkripsiyon, taranmış görüntü yükleme). service_role anahtarı çalışma anında girilir, hiçbir yere yazılmaz. |
| `sql/sema.sql` | Veritabanı şeması, atama motoru, dışa aktarım görünümleri, güvenlik kuralları |
| `CNAME` | GitHub Pages özel alan adı (puanlama.bbasaran.net) |

## Metin havuzu yönetimi

Her metin üç biçimde saklanabilir:

- **Altın standart transkripsiyon** — `.docx` veya `.txt` dosyasından okunur ya da yapıştırılır. Puanlamada gösterilen metin budur.
- **Taranmış el yazısı görüntüsü** — PNG, JPG veya PDF; `metin-gorselleri` adlı özel depolama kovasına yüklenir. Kova herkese kapalıdır; görüntüler yalnızca yönetim panelinden, bir saat geçerli imzalı adresle açılır.
- **Ham tanıma çıktısı** — el yazısı tanıma alt çalışmasında kullanılacak, düzeltilmemiş HTR metni.

Toplu yükleme: birden çok `.docx`/`.txt` dosyası sürüklenip bırakıldığında her dosya bir metin kaydına dönüşür; metin kodu dosya adından, düzey ise kodun içindeki A2/B1/B2/C1 etiketinden çıkarılır.

## Mimari

- **Barındırma:** GitHub Pages (statik dosyalar)
- **Arka uç:** Supabase — PostgreSQL, bölge `eu-central-1` (Frankfurt, AB)
- **Güvenlik:** Tüm tablolarda satır düzeyi güvenlik açık ve `anon` rolüne hiçbir tablo yetkisi
  verilmemiştir. Tarayıcı yalnızca iki `security definer` fonksiyonu çağırabilir:
  `oturum_baslat(token)` ve `puan_kaydet(...)`. Bu nedenle sayfadaki yayımlanabilir anahtar
  veriye doğrudan erişim sağlamaz; başka bir puanlayıcının puanı okunamaz.
- **Model puanları:** Tarayıcıdan hiçbir model çağrısı yapılmaz. Model puanları önceden toplu
  olarak hesaplanıp `model_puanlari` tablosuna yazılır; arayüz yalnızca okur. Böylece tüm
  puanlayıcılar aynı model çıktısını görür ve deney koşulu bozulmaz. API anahtarları yalnızca
  araştırmacının makinesindeki toplu betikte bulunur.

## Yerel çalıştırma

Dosyalar statiktir; `index.html` doğrudan tarayıcıda açılabilir. Yönetim paneli için
Supabase panelinden `Project Settings › API › service_role` anahtarını kopyalayıp
`yonetim.html` içindeki alana yapıştırın.

## Yayına alma

1. Depoyu genel yapın (GitHub Pages ücretsiz planda özel depoda çalışmaz).
2. `Settings › Pages` altında kaynak olarak `main` dalını seçin.
3. Alan adı DNS'inde `puanlama` için `borabasaran.github.io` adresine CNAME kaydı açın.
4. Pages ayarlarında özel alan adını girip "Enforce HTTPS" seçeneğini işaretleyin.

## Etik ve veri koruma

Bu depodaki metinler gösterim amacıyla yazılmış örneklerdir; gerçek öğrenci verisi içermez.
Gerçek veri toplama, Anadolu Üniversitesi Sosyal ve Beşeri Bilimler Bilimsel Araştırma ve
Yayın Etiği Kurulu onayı ve ilgili kurum izinleri alındıktan sonra başlayacaktır.
