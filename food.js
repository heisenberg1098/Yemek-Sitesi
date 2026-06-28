/**
 * food.js
 * Firestore veri katmanı — yemek ve geçmiş işlemleri.
 */

import {
  collection, doc, addDoc, getDocs, getDoc, updateDoc, setDoc, query, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { db, COLLECTIONS } from "./firebase.js";

/* ══════════════════════════════════════════
   YEMEK İŞLEMLERİ
══════════════════════════════════════════ */

/**
 * Tüm yemekleri getirir.
 * @returns {Promise<Array>}
 */
export async function getAllFoods() {
  const snapshot = await getDocs(collection(db, COLLECTIONS.FOODS));
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Tek yemek getirir.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getFoodById(id) {
  const snap = await getDoc(doc(db, COLLECTIONS.FOODS, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Yeni yemek ekler.
 * @param {Object} foodData - { name, category, prepTime, photoUrl }
 * @returns {Promise<string>} Yeni belge ID'si
 */
export async function addFood(foodData) {
  const ref = await addDoc(collection(db, COLLECTIONS.FOODS), {
    name:      foodData.name.trim(),
    category:  foodData.category,
    prepTime:  Number(foodData.prepTime),
    photoUrl:  foodData.photoUrl?.trim() || "",
    rating:    0,
    rateCount: 0,
    createdAt: serverTimestamp()
  });
  return ref.id;
}

/**
 * Yemeği puanlar. Toplam puan ve sayı birikimli tutulur.
 * @param {string} id
 * @param {number} stars  1–5
 */
export async function rateFood(id, stars) {
  const food = await getFoodById(id);
  if (!food) throw new Error("Yemek bulunamadı.");
  await updateDoc(doc(db, COLLECTIONS.FOODS, id), {
    rating:    food.rating + stars,
    rateCount: food.rateCount + 1
  });
}

/**
 * Ortalama puan hesaplar.
 * @param {Object} food
 * @returns {number}
 */
export function getAverageRating(food) {
  if (!food?.rateCount) return 0;
  return food.rating / food.rateCount;
}

/* ══════════════════════════════════════════
   GEÇMİŞ İŞLEMLERİ
══════════════════════════════════════════ */

/**
 * Son N günde yapılan yemekleri getirir.
 * @param {number} days
 * @returns {Promise<Array>}
 */
export async function getRecentHistory(days = 5) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const q = query(
    collection(db, COLLECTIONS.HISTORY),
    orderBy("cookedAt", "desc"),
    limit(30)
  );
  const snapshot = await getDocs(q);

  return snapshot.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(item => {
      const date = item.cookedAt?.toDate?.() ?? new Date(item.cookedAt);
      return date >= since;
    });
}

/**
 * Tüm geçmişi getirir (max 50).
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
 * Yemeği geçmişe kaydeder.
 * @param {Object} food
 * @returns {Promise<string>}
 */
export async function markAsCooked(food) {
  const ref = await addDoc(collection(db, COLLECTIONS.HISTORY), {
    foodId:   food.id,
    name:     food.name,
    category: food.category,
    rating:   getAverageRating(food),
    cookedAt: serverTimestamp()
  });
  return ref.id;
}

/* ══════════════════════════════════════════
   AYARLAR — recommendedFood
   İlerideki bildirim sistemi için hazır alan.
══════════════════════════════════════════ */

/**
 * Günün manuel seçilen yemeğini Firestore'a kaydeder.
 * Bildirim sistemleri bu alanı dinleyebilir.
 * @param {Object} food
 */
export async function saveRecommendedFood(food) {
  await setDoc(doc(db, COLLECTIONS.SETTINGS, "daily"), {
    recommendedFood: {
      id:       food.id,
      name:     food.name,
      category: food.category,
      prepTime: food.prepTime,
      photoUrl: food.photoUrl || ""
    },
    manuallySelected: true,
    updatedAt: serverTimestamp()
  });
}

/**
 * Firestore'daki günün önerisini getirir.
 * @returns {Promise<Object|null>}
 */
export async function getRecommendedFood() {
  const snap = await getDoc(doc(db, COLLECTIONS.SETTINGS, "daily"));
  return snap.exists() ? snap.data() : null;
}

/**
 * Manuel öneriyi sıfırlar ("Başka Öner" dendiğinde).
 */
export async function clearRecommendedFood() {
  await setDoc(doc(db, COLLECTIONS.SETTINGS, "daily"), {
    manuallySelected: false,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

/* ══════════════════════════════════════════
   ÖNERİ MANTIĞI
══════════════════════════════════════════ */

/**
 * Kategori adlarını karşılaştırma için normalize eder.
 * NOT: String.prototype.toLowerCase() Türkçe karakterlerde hatalı sonuç verir
 * ("TATLI".toLowerCase() === "tatli", noktasız i — "tatlı" ile eşleşmez;
 * "DİĞER".toLowerCase() === "di̇ğer" — kombinleme karakteri ekler).
 * Bu yüzden tüm kategori karşılaştırmaları bu fonksiyon üzerinden, tr-TR
 * locale'i ile yapılmalıdır.
 * @param {string} str
 * @returns {string}
 */
export function normalizeCategory(str) {
  return (str ?? "").trim().toLocaleLowerCase("tr-TR");
}

/**
 * Son N günde yapılanlar hariç rastgele yemek seçer.
 * Uygun yemek yoksa tüm listeden seçer.
 * @param {Array} allFoods
 * @param {Array} recentItems
 * @returns {Object|null}
 */
export function pickRandomFood(allFoods, recentItems) {
  const recentIds = new Set(recentItems.map(item => item.foodId));
  const eligible  = allFoods.filter(food => !recentIds.has(food.id));
  const pool      = eligible.length > 0 ? eligible : allFoods;
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Tarih formatlayıcı: "Bugün", "Dün", "3 Haz"
 * @param {Object|Date} dateOrTimestamp
 * @returns {string}
 */
export function formatDate(dateOrTimestamp) {
  const date = dateOrTimestamp?.toDate?.()
    ? dateOrTimestamp.toDate()
    : new Date(dateOrTimestamp);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  const diff = Math.round((today - d) / 86400000);
  if (diff === 0) return "Bugün";
  if (diff === 1) return "Dün";
  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}