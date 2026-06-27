/**
 * firebase.js
 * Firebase başlatma ve Firestore bağlantısı.
 * Tüm Firebase işlemleri bu dosya üzerinden yürütülür.
 */

import { initializeApp }     from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getFirestore }      from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { getAnalytics }      from "https://www.gstatic.com/firebasejs/12.15.0/firebase-analytics.js";

/* ── Proje yapılandırması ── */
const firebaseConfig = {
  apiKey:            "AIzaSyBAXe9znKfZydYjk4U20VR1YCysaimQ3i0",
  authDomain:        "yemekweb-cae8e.firebaseapp.com",
  projectId:         "yemekweb-cae8e",
  storageBucket:     "yemekweb-cae8e.firebasestorage.app",
  messagingSenderId: "399909637630",
  appId:             "1:399909637630:web:8a48f08750a816d409c4af",
  measurementId:     "G-Y2BNHH2PYJ"
};

/* ── Firebase uygulamasını başlat ── */
const app       = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

/**
 * Firestore veritabanı örneği.
 * Diğer modüller bu nesneyi import ederek kullanır.
 */
export const db = getFirestore(app);

/**
 * Firestore koleksiyon adları.
 * Sabit olarak burada tanımlanır; ileride değişirse tek yerden güncellenir.
 */
export const COLLECTIONS = {
  FOODS:   "foods",    // Yemek listesi
  HISTORY: "history"  // Yapılan yemekler geçmişi
};
