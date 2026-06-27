/**
 * grocery.js
 * Alışveriş listesi — Firestore veri katmanı.
 * Ürün ekleme, silme, tamamlama ve liste yönetimi.
 */

import {
  collection, doc, addDoc, deleteDoc,
  getDocs, updateDoc, writeBatch, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

import { db, COLLECTIONS } from "./firebase.js";

/* ══════════════════════════════════════════
   CRUD İŞLEMLERİ
══════════════════════════════════════════ */

/**
 * Alışveriş listesini getirir (ekleme sırasına göre).
 * @returns {Promise<Array>}
 */
export async function getGroceryItems() {
  const q = query(
    collection(db, COLLECTIONS.GROCERY),
    orderBy("createdAt", "asc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Listeye ürün ekler.
 * @param {string} name - Ürün adı
 * @returns {Promise<string>} Yeni belge ID'si
 */
export async function addGroceryItem(name) {
  const ref = await addDoc(collection(db, COLLECTIONS.GROCERY), {
    name:      name.trim(),
    done:      false,
    createdAt: serverTimestamp()
  });
  return ref.id;
}

/**
 * Ürünün tamamlandı durumunu tersine çevirir.
 * @param {string} id    - Belge ID'si
 * @param {boolean} done - Mevcut durum
 */
export async function toggleGroceryItem(id, done) {
  await updateDoc(doc(db, COLLECTIONS.GROCERY, id), { done: !done });
}

/**
 * Ürünü listeden siler.
 * @param {string} id
 */
export async function deleteGroceryItem(id) {
  await deleteDoc(doc(db, COLLECTIONS.GROCERY, id));
}

/**
 * Tüm listeyi toplu olarak siler (batch write).
 * @param {Array} items - Silinecek öğeler dizisi
 */
export async function clearGroceryList(items) {
  const batch = writeBatch(db);
  items.forEach(item => {
    batch.delete(doc(db, COLLECTIONS.GROCERY, item.id));
  });
  await batch.commit();
}

/* ══════════════════════════════════════════
   YARDIMCI
══════════════════════════════════════════ */

/**
 * Liste öğelerini kopyalanabilir metin formatına dönüştürür.
 * Tamamlanmamış olanlar önce, tamamlananlar sonda gelir.
 * @param {Array} items
 * @returns {string}
 */
export function formatListForCopy(items) {
  const pending = items.filter(i => !i.done).map(i => i.name);
  const done    = items.filter(i =>  i.done).map(i => `✓ ${i.name}`);
  return [...pending, ...done].join("\n");
}
