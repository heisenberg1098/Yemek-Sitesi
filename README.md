# 🍽️ Bugün Ne Yesek?

Aile için günlük yemek öneren sade bir web uygulaması.  
"Bugün ne yemek yapacağız?" sorusunu 10 saniyede cevaplar.

---

## Özellikler

- **Günlük Öneri** — Son 5 günde yapılan yemekler hariç tutularak rastgele öneri
- **Yapalım** — Seçilen yemek geçmişe kaydedilir
- **Başka Öner** — Yeni rastgele öneri alır
- **Yemek Listesi** — Kategoriye göre filtrelenebilir kart görünümü
- **Yemek Ekle** — Ad, kategori, süre ve fotoğraf URL ile yeni yemek
- **Puanlama** — Her yemek için ★★★★★ puanlama
- **Geçmiş** — Son yapılan yemekler tarihleriyle listelenir

---

## Teknolojiler

| Katman    | Teknoloji                  |
|-----------|----------------------------|
| Arayüz    | HTML5, CSS3, Vanilla JS    |
| Veritabanı | Firebase Firestore         |
| Hosting   | GitHub Pages               |
| Font      | Inter (Google Fonts)       |

---

## Kurulum

### 1. Repoyu klonla

```bash
git clone https://github.com/heisenberg1098/Yemek-Sitesi
cd yemek-oneri
```

### 2. Firebase ayarları

`js/firebase.js` dosyasındaki `firebaseConfig` nesnesi kendi Firebase projenle dolu.  
Değiştirmek gerekirse [Firebase Console](https://console.firebase.google.com) → Proje Ayarları → Web Uygulaması bölümünden alabilirsin.

### 3. Firestore kuralları

Firebase Console → Firestore Database → Rules sekmesine şu kuralları yapıştır:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /foods/{id} {
      allow read, write: if true;
    }
    match /history/{id} {
      allow read, write: if true;
    }
  }
}
```

> ⚠️ Bu kurallar genel erişime açıktır. Yalnızca aile kullanımı içindir.

### 4. GitHub Pages'e yayınla

```bash
git add .
git commit -m "ilk yayın"
git push origin main
```

GitHub → Repo → Settings → Pages → Branch: `main` / `/ (root)` seç → Save.

Birkaç dakika sonra `https://kullanici-adi.github.io/yemek-oneri/` adresinde yayında.

---

## Dosya Yapısı

```
yemek-oneri/
├── index.html          # Tek sayfa, 4 bölüm (home / list / add / history)
├── css/
│   └── style.css       # Tüm stiller, CSS değişkenleri, responsive
├── js/
│   ├── firebase.js     # Firebase başlatma, db export
│   ├── food.js         # Firestore CRUD + öneri mantığı
│   ├── ui.js           # DOM render fonksiyonları
│   └── app.js          # Orkestratör, event listener'lar
├── images/             # İsteğe bağlı yerel görseller
└── README.md
```

---

## Kullanım

### Yemek ekleme
1. **Yemek Ekle** sayfasına git
2. Ad, kategori ve hazırlama süresini doldur
3. İsteğe bağlı fotoğraf URL'si ekle
4. **Yemeği Ekle** butonuna bas

### Öneri alma
- Ana sayfada günün önerisi otomatik gelir
- **Başka Öner** ile farklı bir öneri al
- **Yapalım** ile yemeği onayla → geçmişe kaydedilir

### Puanlama
- **Yemekler** sayfasında herhangi bir karttaki **Puanla** butonuna bas
- 1–5 yıldız seç ve kaydet

---

## Geliştirici Notları

- `allFoods` dizisi uygulama başlangıcında bir kez çekilir; sayfa geçişlerinde tazeler.
- Son 5 gün içinde yapılan yemekler `getRecentHistory(5)` ile elenip öneri dışı tutulur.
- Tüm kullanıcı girdileri `escHtml()` fonksiyonuyla XSS'e karşı temizlenir.
- `type="module"` ile ES modülleri kullanıldığından lokal açılışta CORS hatası alınır; bir yerel sunucu (örn. VS Code Live Server) üzerinden test et.
