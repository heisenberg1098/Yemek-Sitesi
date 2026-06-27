/**
 * food.js
 * Firestore veri katmanı.
 * Yemek ve geçmiş ile ilgili tüm okuma/yazma işlemleri burada.
 * ui.js ve app.js bu fonksiyonları çağırır; Firebase'i doğrudan kullanmaz.
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  orderBy,
  query,
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

import { db, COLLECTIONS } from "./firebase.js";

/* ══════════════════════════════════════════
   YEMEK İŞLEMLERİ
══════════════════════════════════════════ */

/**
 * Firestore'daki tüm yemekleri getirir.
 * @returns {Promise<Array>} Yemek nesnelerinin dizisi ({ id, ...data })
 */
export async function getAllFoods() {
  const snapshot = await getDocs(collection(db, COLLECTIONS.FOODS));
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Tek bir yemeği ID'ye göre getirir.
 * @param {string} id - Firestore belge ID'si
 * @returns {Promise<Object|null>} Yemek nesnesi veya null
 */
export async function getFoodById(id) {
  const snap = await getDoc(doc(db, COLLECTIONS.FOODS, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Yeni yemek ekler.
 * @param {Object} foodData - { name, category, prepTime, photoUrl }
 * @returns {Promise<string>} Oluşturulan belgenin ID'si
 */
export async function addFood(foodData) {
  const docRef = await addDoc(collection(db, COLLECTIONS.FOODS), {
    name:      foodData.name.trim(),
    category:  foodData.category,
    prepTime:  Number(foodData.prepTime),
    photoUrl:  foodData.photoUrl?.trim() || "",
    rating:    0,       // Toplam puan
    rateCount: 0,       // Kaç kez puanlandı
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

/**
 * Bir yemeğin puanını günceller.
 * Mevcut puana yeni puanı ekleyerek ortalama hesaplar.
 * @param {string} id     - Yemek ID'si
 * @param {number} stars  - 1–5 arası puan
 */
export async function rateFood(id, stars) {
  const food = await getFoodById(id);
  if (!food) throw new Error("Yemek bulunamadı.");

  const newCount  = food.rateCount + 1;
  const newRating = food.rating + stars;   // Ham toplam saklanır

  await updateDoc(doc(db, COLLECTIONS.FOODS, id), {
    rating:    newRating,
    rateCount: newCount
  });
}

/**
 * Bir yemeğin ortalama yıldız puanını hesaplar (0–5).
 * @param {Object} food - Firestore yemek nesnesi
 * @returns {number} Ortalama puan (ondalıklı)
 */
export function getAverageRating(food) {
  if (!food.rateCount || food.rateCount === 0) return 0;
  return food.rating / food.rateCount;
}

/* ══════════════════════════════════════════
   GEÇMİŞ İŞLEMLERİ
══════════════════════════════════════════ */

/**
 * Son N günde yapılan yemekleri getirir.
 * @param {number} days - Kaç günlük geçmiş sorgulanacak (varsayılan: 5)
 * @returns {Promise<Array>} Geçmiş kayıtları dizisi
 */
export async function getRecentHistory(days = 5) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  // Tüm geçmişi tarihe göre sıralı getir, son 30 kayıtla sınırla
  const q = query(
    collection(db, COLLECTIONS.HISTORY),
    orderBy("cookedAt", "desc"),
    limit(30)
  );

  const snapshot = await getDocs(q);

  // Son N gündekileri filtrele
  return snapshot.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(item => {
      const date = item.cookedAt?.toDate?.() ?? new Date(item.cookedAt);
      return date >= since;
    });
}

/**
 * Tüm geçmişi sayfa için getirir (en yeni önce, max 50 kayıt).
 * @returns {Promise<Array>}
 */
export async function getFullHistory() {
  const q = query(
    collection(db, COLLECTIONS.HISTORY),
    orderBy("cookedAt", "desc"),
    limit(50)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * "Yapalım" butonuna basınca çağrılır.
 * Yemeği geçmişe kaydeder.
 * @param {Object} food - Yapılan yemek nesnesi
 * @returns {Promise<string>} Oluşturulan geçmiş kaydı ID'si
 */
export async function markAsCooked(food) {
  const docRef = await addDoc(collection(db, COLLECTIONS.HISTORY), {
    foodId:   food.id,
    name:     food.name,
    category: food.category,
    rating:   getAverageRating(food),
    cookedAt: serverTimestamp()
  });
  return docRef.id;
}

/* ══════════════════════════════════════════
   ÖNERİ MANTIĞI
══════════════════════════════════════════ */

/**
 * Son N günde yapılan yemekleri hariç tutarak
 * kalan yemekler arasından rastgele bir tane seçer.
 *
 * @param {Array}  allFoods    - Tüm yemekler listesi
 * @param {Array}  recentItems - Son günlerde yapılan geçmiş kayıtları
 * @returns {Object|null} Seçilen yemek nesnesi veya null (yemek yoksa)
 */
export function pickRandomFood(allFoods, recentItems) {
  // Son yapılan yemeklerin ID setini oluştur
  const recentIds = new Set(recentItems.map(item => item.foodId));

  // Geçmişte olmayanları filtrele
  const eligible = allFoods.filter(food => !recentIds.has(food.id));

  // Uygun yemek yoksa tüm listeden seç (en azından bir şey önerilsin)
  const pool = eligible.length > 0 ? eligible : allFoods;

  if (pool.length === 0) return null;

  // Rastgele seç
  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}

/**
 * Tarih nesnesini "Bugün", "Dün" veya "D MMM" formatında gösterir.
 * Geçmiş listesinde kullanılır.
 * @param {Date|Object} dateOrTimestamp - Firestore Timestamp veya Date
 * @returns {string} Okunabilir tarih metni
 */
export function formatDate(dateOrTimestamp) {
  const date = dateOrTimestamp?.toDate?.()
    ? dateOrTimestamp.toDate()
    : new Date(dateOrTimestamp);

  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d     = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffDays = Math.round((today - d) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Bugün";
  if (diffDays === 1) return "Dün";

  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}
