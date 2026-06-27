# Yemek-Sitesi

🍽️ Bugün Ne Yesek?
Evdeki "Akşama ne pişirsek?" krizlerine pratik bir çözüm bulmak için geliştirdiğim sade bir web uygulaması. Karar verme sürecini uzatmamak için tasarlandı; yaklaşık 10 saniye içinde sana mantıklı bir yemek önerisi sunuyor.

✨ Neler Yapabiliyor?
Akıllı Öneri: Uygulama, son 5 günde yaptığınız yemekleri hafızasında tutarak sana sürekli aynı şeyleri önermekten kaçınıyor.

Hızlı Karar: Gelen öneriyi beğendiysen Yapalım butonuna basıyorsun ve o yemek doğrudan geçmişe kaydediliyor.

Alternatif Arama: Canın o yemeği çekmediyse Başka Öner diyerek şansını tekrar deneyebiliyorsun.

Kendi Menünü Oluştur: Veritabanına kendi yaptığınız yemekleri; fotoğraf, kategori ve hazırlama süresi gibi detaylarla ekleyebilirsin.

Puanlama Sistemi: Yemeklere 1'den 5'e kadar yıldız vererek ailenin favorilerini belirleyebilirsin.

Geçmiş: Geriye dönük "Biz geçen hafta ne yemiştik?" sorusunun cevabını liste halinde görebilirsin.

🛠️ Kullandığım Teknolojiler
Projeyi geliştirirken olabildiğince dışa bağımlılığı azaltıp sade kalmaya çalıştım:

Frontend: HTML5, CSS3, Vanilla JS (Herhangi bir framework kullanılmadı)

Veritabanı: Firebase Firestore (Hızlı ve gerçek zamanlı yapısı için tercih ettim)

Hosting: GitHub Pages

Tipografi: Inter (Google Fonts)

🚀 Kurulum ve Kullanım
Projeyi kendi bilgisayarında denemek veya kendi ailen için özelleştirmek istersen adımlar oldukça basit:

1. Projeyi Bilgisayarına İndir
Bash
git clone https://github.com/kullanici-adi/yemek-oneri.git
cd yemek-oneri
2. Firebase Bağlantısı
Uygulamanın çalışması için kendi Firebase veritabanını bağlaman gerekiyor. js/firebase.js dosyası içindeki firebaseConfig ayarlarını kendi projenin bilgileriyle değiştir. (Bunun için Firebase Console üzerinden ücretsiz bir web uygulaması oluşturman yeterli).

3. Firestore Kuralları
Veritabanının okuma/yazma izinlerini ayarlamalısın. Şimdilik sadece aile içi kullanım odaklı olduğu için test aşamasında kuralları herkese açık bırakabilirsin:

JavaScript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /foods/{id} { allow read, write: if true; }
    match /history/{id} { allow read, write: if true; }
  }
}
⚠️ Küçük bir uyarı: Projeyi ileride dışarıya açacaksan, bu kuralları mutlaka güvenlik standartlarına uygun hale getirmelisin.

4. Yayına Alma (Opsiyonel)
Değişikliklerini tamamladıktan sonra GitHub reposu üzerinden Settings → Pages sekmesine gidip projeni GitHub Pages aracılığıyla birkaç dakika içinde canlıya alabilirsin.

💡 Kodlarken Dikkat Ettiklerim (Geliştirici Notları)
Performans Optimizasyonu: Uygulama açıldığında tüm yemek listesini veritabanından sadece bir kez (allFoods dizisine) çekiyorum. Sayfa geçişlerinde sürekli veritabanına istek atmak yerine bu yerel veriyi kullanarak hızı artırdım.

Öneri Mantığı: Rastgele öneri fonksiyonu çalışmadan önce getRecentHistory(5) metodu devreye giriyor. Son 5 günün verisini filtreleyip bu yemekleri öneri havuzunun dışında bırakıyor.

Güvenlik (XSS): Dışarıdan veya formlardan girilen tüm veriler ekrana basılmadan önce yazdığım özel bir escHtml() fonksiyonundan geçiyor.

Modül Kullanımı: JavaScript dosyalarını daha düzenli tutmak için ES modüllerini (type="module") tercih ettim. Bu yüzden index.html dosyasını direkt tarayıcıda açarsan CORS hatası alırsın. Kodu denerken VS Code Live Server gibi yerel bir sunucu kullanmayı unutma.
