/**
 * app.js
 * Ana orkestratör modülü.
 * food.js (veri) + ui.js (arayüz) fonksiyonlarını bir araya getirir.
 * Event listener'lar ve sayfa akışları burada yönetilir.
 */

import {
  getAllFoods,
  addFood,
  rateFood,
  markAsCooked,
  getRecentHistory,
  getFullHistory,
  pickRandomFood
} from "./food.js";

import {
  showPage,
  toggleMobileMenu,
  renderTodayCard,
  renderRecentInfo,
  renderFoodGrid,
  renderHistory,
  bindFilterButtons,
  openRatingModal,
  closeRatingModal,
  showToast
} from "./ui.js";

/* ══════════════════════════════════════════
   UYGULAMA DURUMU
══════════════════════════════════════════ */

/** Tüm yemekler (Firestore'dan bir kez çekilir, bellekte tutulur) */
let allFoods = [];

/** Şu an ana sayfada önerilen yemek */
let currentFood = null;

/** Son N günde yapılan yemekler */
let recentHistory = [];

/** Yemek listesi sayfasında seçili filtre */
let activeCategory = "all";

/* ══════════════════════════════════════════
   BAŞLATMA
══════════════════════════════════════════ */

/**
 * Uygulama başlangıç noktası.
 * DOM hazır olduğunda çalışır.
 */
async function init() {
  bindNavButtons();
  bindMenuToggle();
  bindHomeButtons();
  bindAddFoodForm();
  bindFilterButtons(onCategoryFilter);
  bindModalClose();

  // Veriyi yükle ve ana sayfayı göster
  await loadAllData();
  showPage("home");
}

/* ══════════════════════════════════════════
   VERİ YÜKLEME
══════════════════════════════════════════ */

/**
 * Firestore'dan yemek listesini ve son geçmişi çeker.
 * Ana sayfa kartını ve geçmiş bilgisini günceller.
 */
async function loadAllData() {
  try {
    // Paralel sorgu: yemekler + son geçmiş
    [allFoods, recentHistory] = await Promise.all([
      getAllFoods(),
      getRecentHistory(5)
    ]);

    suggestFood();
    renderRecentInfo(recentHistory);
  } catch (err) {
    console.error("Veri yüklenemedi:", err);
    showToast("Veriler yüklenirken hata oluştu.", "error");
  }
}

/**
 * Yemek listesi sayfası açıldığında çağrılır.
 * Firestore'dan taze veri çeker ve grid'i render eder.
 */
async function loadFoodList() {
  try {
    allFoods = await getAllFoods();
    applyFilter(activeCategory);
  } catch (err) {
    console.error("Yemek listesi yüklenemedi:", err);
    showToast("Liste yüklenirken hata oluştu.", "error");
  }
}

/**
 * Geçmiş sayfası açıldığında çağrılır.
 * Firestore'dan tüm geçmişi çeker ve listeyi render eder.
 */
async function loadHistory() {
  try {
    const history = await getFullHistory();
    renderHistory(history);
  } catch (err) {
    console.error("Geçmiş yüklenemedi:", err);
    showToast("Geçmiş yüklenirken hata oluştu.", "error");
  }
}

/* ══════════════════════════════════════════
   ÖNERİ MANTIĞI
══════════════════════════════════════════ */

/**
 * Uygun yemekler arasından rastgele bir tane seçer
 * ve ana sayfa kartını günceller.
 */
function suggestFood() {
  currentFood = pickRandomFood(allFoods, recentHistory);
  renderTodayCard(currentFood);
}

/* ══════════════════════════════════════════
   FİLTRELEME
══════════════════════════════════════════ */

/**
 * Kategori filtresi değiştiğinde çağrılır.
 * @param {string} category - Seçilen kategori veya "all"
 */
function onCategoryFilter(category) {
  activeCategory = category;
  applyFilter(category);
}

/**
 * Yemekleri seçili kategoriye göre filtreler ve grid'i render eder.
 * @param {string} category - "all" veya kategori adı
 */
function applyFilter(category) {
  const filtered = category === "all"
    ? allFoods
    : allFoods.filter(f => f.category === category);

  renderFoodGrid(filtered, onRateClick);
}

/* ══════════════════════════════════════════
   PUANLAMA
══════════════════════════════════════════ */

/**
 * Yemek kartındaki "Puanla" butonuna basıldığında çağrılır.
 * @param {string} foodId   - Puanlanacak yemeğin ID'si
 * @param {string} foodName - Modal başlığı için isim
 */
function onRateClick(foodId, foodName) {
  openRatingModal(foodId, foodName, onRatingSubmit);
}

/**
 * Puanlama modalinde "Kaydet" basıldığında çağrılır.
 * Firestore'a yazar, listeyi ve ana sayfayı tazeler.
 * @param {string} foodId - Puanlanan yemeğin ID'si
 * @param {number} stars  - Seçilen puan (1–5)
 */
async function onRatingSubmit(foodId, stars) {
  try {
    await rateFood(foodId, stars);
    showToast("Puanın kaydedildi! ★".repeat(stars > 3 ? 1 : 0) || "Puanın kaydedildi!", "success");

    // Taze veriyi çek ve sayfaları güncelle
    allFoods = await getAllFoods();
    applyFilter(activeCategory);

    // Ana sayfadaki yemek hâlâ aynıysa kartını güncelle
    if (currentFood?.id === foodId) {
      const updated = allFoods.find(f => f.id === foodId);
      if (updated) {
        currentFood = updated;
        renderTodayCard(currentFood);
      }
    }
  } catch (err) {
    console.error("Puanlama hatası:", err);
    showToast("Puan kaydedilemedi.", "error");
  }
}

/* ══════════════════════════════════════════
   YEMEK EKLEME FORMU
══════════════════════════════════════════ */

/**
 * Yemek ekleme formunun submit olayını bağlar.
 * Doğrulama yapıp Firestore'a yazar.
 */
function bindAddFoodForm() {
  const btnAdd  = document.getElementById("btnAddFood");
  const errBox  = document.getElementById("formError");

  btnAdd.addEventListener("click", async () => {
    const name     = document.getElementById("inputName").value.trim();
    const category = document.getElementById("inputCategory").value;
    const prepTime = document.getElementById("inputTime").value;
    const photoUrl = document.getElementById("inputPhoto").value.trim();

    // — Doğrulama —
    const error = validateFoodForm(name, category, prepTime);
    if (error) {
      errBox.textContent    = error;
      errBox.style.display  = "block";
      return;
    }

    errBox.style.display = "none";
    btnAdd.disabled      = true;
    btnAdd.textContent   = "Ekleniyor…";

    try {
      await addFood({ name, category, prepTime, photoUrl });
      showToast(`"${name}" eklendi.`, "success");
      resetAddForm();

      // Yemek listesini tazele
      allFoods = await getAllFoods();
    } catch (err) {
      console.error("Yemek eklenemedi:", err);
      showToast("Yemek eklenirken hata oluştu.", "error");
    } finally {
      btnAdd.disabled    = false;
      btnAdd.textContent = "Yemeği Ekle";
    }
  });
}

/**
 * Yemek ekleme formunu doğrular.
 * @param {string} name     - Yemek adı
 * @param {string} category - Kategori
 * @param {string} prepTime - Hazırlama süresi
 * @returns {string|null} Hata mesajı veya null (geçerliyse)
 */
function validateFoodForm(name, category, prepTime) {
  if (!name)                        return "Yemek adı boş bırakılamaz.";
  if (name.length < 2)              return "Yemek adı en az 2 karakter olmalı.";
  if (!category)                    return "Lütfen bir kategori seçin.";
  if (!prepTime || isNaN(prepTime)) return "Geçerli bir hazırlama süresi girin.";
  if (Number(prepTime) < 1)         return "Hazırlama süresi en az 1 dakika olmalı.";
  return null;
}

/**
 * Yemek ekleme formunu sıfırlar.
 */
function resetAddForm() {
  document.getElementById("inputName").value     = "";
  document.getElementById("inputCategory").value = "";
  document.getElementById("inputTime").value     = "";
  document.getElementById("inputPhoto").value    = "";
  document.getElementById("formError").style.display = "none";
}

/* ══════════════════════════════════════════
   EVENT BAĞLANTILARI
══════════════════════════════════════════ */

/**
 * Header navigasyon butonlarını bağlar.
 * Her butona tıklandığında ilgili sayfayı açar,
 * gerekirse taze veri çeker.
 */
function bindNavButtons() {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const page = btn.dataset.page;
      showPage(page);

      // Sayfaya özgü veri yükleme
      if (page === "list")    await loadFoodList();
      if (page === "history") await loadHistory();
    });
  });
}

/**
 * Logo tıklamasını ana sayfaya bağlar.
 */
function bindNavButtons() {
  // Nav butonları
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const page = btn.dataset.page;
      showPage(page);
      if (page === "list")    await loadFoodList();
      if (page === "history") await loadHistory();
    });
  });

  // Logo → ana sayfa
  document.querySelector(".header__logo").addEventListener("click", (e) => {
    e.preventDefault();
    showPage("home");
  });
}

/**
 * Mobil hamburger menü butonunu bağlar.
 */
function bindMenuToggle() {
  document.getElementById("menuToggle").addEventListener("click", toggleMobileMenu);
}

/**
 * Ana sayfa butonlarını bağlar:
 * - "Yapalım" → geçmişe yazar, toast gösterir
 * - "Başka Öner" → yeni yemek önerir
 */
function bindHomeButtons() {
  // "Yapalım" butonu
  document.getElementById("btnMakeit").addEventListener("click", async () => {
    if (!currentFood) return;

    try {
      await markAsCooked(currentFood);
      showToast(`"${currentFood.name}" geçmişe eklendi. Afiyet olsun! 🍽️`, "success");

      // Geçmiş listesini tazele
      recentHistory = await getRecentHistory(5);
      renderRecentInfo(recentHistory);

      // Yeni öneri yap (yapılan yemek artık listeden çıkar)
      suggestFood();
    } catch (err) {
      console.error("Geçmişe eklenemedi:", err);
      showToast("Bir hata oluştu.", "error");
    }
  });

  // "Başka Öner" butonu
  document.getElementById("btnSuggest").addEventListener("click", () => {
    if (allFoods.length === 0) {
      showToast("Önce yemek listesine yemek ekleyin.", "error");
      return;
    }
    suggestFood();
  });
}

/**
 * Puanlama modalinin kapatma olaylarını bağlar:
 * - "✕" butonu
 * - Arka plan overlay'i
 * - Escape tuşu
 */
function bindModalClose() {
  document.getElementById("btnCloseModal").addEventListener("click", closeRatingModal);

  document.querySelector(".modal__overlay").addEventListener("click", closeRatingModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeRatingModal();
  });
}

/* ══════════════════════════════════════════
   BAŞLAT
══════════════════════════════════════════ */

// DOM hazır olduğunda uygulamayı başlat
document.addEventListener("DOMContentLoaded", init);
