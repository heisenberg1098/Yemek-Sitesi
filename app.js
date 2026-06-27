/**
 * app.js
 * Ana orkestratör.
 * food.js + grocery.js (veri) ve ui.js (arayüz) bağlantısı.
 */

import {
  getAllFoods, addFood, rateFood,
  markAsCooked, getRecentHistory, getFullHistory,
  pickRandomFood, saveRecommendedFood
} from "./food.js";

import {
  getGroceryItems, addGroceryItem, toggleGroceryItem,
  deleteGroceryItem, clearGroceryList, formatListForCopy
} from "./grocery.js";

import {
  showPage, renderTodayCard, renderRecentInfo,
  renderFoodGrid, renderGroceryList, renderHistory,
  bindFilterButtons, openRatingModal, closeRatingModal,
  showToast, showSuccessAnimation, categoryEmoji
} from "./ui.js";

/* ══════════════════════════════════════════
   UYGULAMA DURUMU
══════════════════════════════════════════ */

let allFoods      = [];   // Firestore'dan çekilen yemek listesi
let currentFood   = null; // Şu an önerilen yemek
let recentHistory = [];   // Son 5 günlük geçmiş
let activeCategory = "all";
let isManualPick  = false; // "Bugün Yap" ile mi seçildi?
let groceryItems  = [];    // Alışveriş listesi (bellekte)

/* ══════════════════════════════════════════
   BAŞLATMA
══════════════════════════════════════════ */

/**
 * Uygulama giriş noktası.
 */
async function init() {
  // Lucide ikonlarını başlat
  if (window.lucide) window.lucide.createIcons();

  bindAllNavButtons();
  bindHomeButtons();
  bindAddFoodForm();
  bindFilterButtons(onCategoryFilter);
  bindModalClose();
  bindGroceryPage();

  await loadAllData();
  showPage("home");
}

/* ══════════════════════════════════════════
   VERİ YÜKLEME
══════════════════════════════════════════ */

/**
 * İlk yükleme: yemekler + geçmiş paralel çekilir.
 */
async function loadAllData() {
  try {
    [allFoods, recentHistory] = await Promise.all([
      getAllFoods(),
      getRecentHistory(5)
    ]);
    suggestFood();
    renderRecentInfo(recentHistory);
  } catch (err) {
    console.error("Veri yüklenemedi:", err);
    showToast("Veriler yüklenemedi.", "error");
  }
}

/**
 * Yemek listesi sayfası açıldığında taze veri çeker.
 */
async function loadFoodList() {
  try {
    allFoods = await getAllFoods();
    applyFilter(activeCategory);
  } catch (err) {
    console.error("Liste yüklenemedi:", err);
    showToast("Liste yüklenemedi.", "error");
  }
}

/**
 * Geçmiş sayfası açıldığında taze veri çeker.
 */
async function loadHistory() {
  try {
    const history = await getFullHistory();
    renderHistory(history);
  } catch (err) {
    console.error("Geçmiş yüklenemedi:", err);
    showToast("Geçmiş yüklenemedi.", "error");
  }
}

/**
 * Alışveriş sayfası açıldığında listeyi çeker.
 */
async function loadGrocery() {
  try {
    groceryItems = await getGroceryItems();
    renderGroceryList(groceryItems, onGroceryToggle, onGroceryDelete);
  } catch (err) {
    console.error("Liste yüklenemedi:", err);
    showToast("Alışveriş listesi yüklenemedi.", "error");
  }
}

/* ══════════════════════════════════════════
   ÖNERİ MANTIĞI
══════════════════════════════════════════ */

/**
 * Uygun yemeklerden rastgele seçer, kartı günceller.
 */
function suggestFood() {
  isManualPick = false;
  currentFood  = pickRandomFood(allFoods, recentHistory);
  renderTodayCard(currentFood, false);
}

/**
 * "Bugün Yap" — Yemek listesinden manuel seçim.
 * Ana sayfayı günceller, Firestore'a kaydeder.
 * @param {string} foodId
 */
async function onCookFromList(foodId) {
  const food = allFoods.find(f => f.id === foodId);
  if (!food) return;

  try {
    // Geçmişe kaydet
    await markAsCooked(food);
    // Firestore settings/daily güncelle (bildirim hazırlığı)
    await saveRecommendedFood(food);

    isManualPick = true;
    currentFood  = food;

    // Başarı animasyonu
    showSuccessAnimation(`${food.name} bugünün yemeği!`);

    // Ana sayfayı güncelle
    renderTodayCard(currentFood, true);
    document.getElementById("btnMakeit").disabled = false;

    // Geçmiş ve recent güncelle
    recentHistory = await getRecentHistory(5);
    renderRecentInfo(recentHistory);

    // Liste sayfasını da tazele (buton durumu için)
    applyFilter(activeCategory);

    // 1 sn sonra ana sayfaya yönlendir
    setTimeout(() => showPage("home"), 900);

  } catch (err) {
    console.error("Seçim kaydedilemedi:", err);
    showToast("Bir hata oluştu.", "error");
  }
}

/* ══════════════════════════════════════════
   FİLTRELEME
══════════════════════════════════════════ */

/** @param {string} category */
function onCategoryFilter(category) {
  activeCategory = category;
  applyFilter(category);
}

/** @param {string} category */
function applyFilter(category) {
  const filtered = category === "all"
    ? allFoods
    : allFoods.filter(f => f.category === category);
  renderFoodGrid(filtered, onCookFromList, onRateClick);
}

/* ══════════════════════════════════════════
   PUANLAMA
══════════════════════════════════════════ */

/** @param {string} foodId @param {string} foodName */
function onRateClick(foodId, foodName) {
  openRatingModal(foodId, foodName, onRatingSubmit);
}

/**
 * Puanı Firestore'a yazar, kartları günceller.
 * @param {string} foodId
 * @param {number} stars
 */
async function onRatingSubmit(foodId, stars) {
  try {
    await rateFood(foodId, stars);
    showToast("Puanın kaydedildi!", "success");

    allFoods = await getAllFoods();
    applyFilter(activeCategory);

    // Ana sayfadaki yemek aynıysa kartını güncelle
    if (currentFood?.id === foodId) {
      currentFood = allFoods.find(f => f.id === foodId) ?? currentFood;
      renderTodayCard(currentFood, isManualPick);
    }
  } catch (err) {
    console.error("Puanlama hatası:", err);
    showToast("Puan kaydedilemedi.", "error");
  }
}

/* ══════════════════════════════════════════
   YEMEK EKLEME
══════════════════════════════════════════ */

function bindAddFoodForm() {
  const btnAdd = document.getElementById("btnAddFood");
  const errBox = document.getElementById("formError");

  btnAdd.addEventListener("click", async () => {
    const name     = document.getElementById("inputName").value.trim();
    const category = document.getElementById("inputCategory").value;
    const prepTime = document.getElementById("inputTime").value;
    const photoUrl = document.getElementById("inputPhoto").value.trim();

    const error = validateFoodForm(name, category, prepTime);
    if (error) {
      errBox.textContent   = error;
      errBox.style.display = "block";
      return;
    }

    errBox.style.display = "none";
    btnAdd.disabled      = true;
    btnAdd.textContent   = "Ekleniyor…";

    try {
      await addFood({ name, category, prepTime, photoUrl });
      showToast(`"${name}" eklendi.`, "success");
      resetAddForm();
      allFoods = await getAllFoods();
    } catch (err) {
      console.error("Yemek eklenemedi:", err);
      showToast("Yemek eklenemedi.", "error");
    } finally {
      btnAdd.disabled    = false;
      btnAdd.innerHTML   = '<i data-lucide="plus-circle"></i> Yemeği Ekle';
      if (window.lucide) window.lucide.createIcons();
    }
  });
}

/** @returns {string|null} */
function validateFoodForm(name, category, prepTime) {
  if (!name || name.length < 2)             return "Yemek adı en az 2 karakter olmalı.";
  if (!category)                            return "Lütfen bir kategori seçin.";
  if (!prepTime || isNaN(prepTime) || Number(prepTime) < 1)
                                            return "Geçerli bir hazırlama süresi girin.";
  return null;
}

function resetAddForm() {
  ["inputName","inputCategory","inputTime","inputPhoto"].forEach(id => {
    document.getElementById(id).value = "";
  });
  document.getElementById("formError").style.display = "none";
}

/* ══════════════════════════════════════════
   ALIŞVERİŞ LİSTESİ
══════════════════════════════════════════ */

function bindGroceryPage() {
  const input  = document.getElementById("groceryInput");
  const btnAdd = document.getElementById("btnAddGrocery");

  // Ürün ekle
  const doAdd = async () => {
    const name = input.value.trim();
    if (!name) return;
    try {
      await addGroceryItem(name);
      input.value = "";
      groceryItems = await getGroceryItems();
      renderGroceryList(groceryItems, onGroceryToggle, onGroceryDelete);
    } catch (err) {
      console.error("Ürün eklenemedi:", err);
      showToast("Ürün eklenemedi.", "error");
    }
  };

  btnAdd.addEventListener("click", doAdd);
  // Enter tuşuyla da eklenebilsin
  input.addEventListener("keydown", e => { if (e.key === "Enter") doAdd(); });

  // Listeyi kopyala
  document.getElementById("btnCopyList").addEventListener("click", async () => {
    if (!groceryItems.length) return;
    const text = formatListForCopy(groceryItems);
    try {
      await navigator.clipboard.writeText(text);
      showToast("Liste panoya kopyalandı.", "success");
    } catch {
      showToast("Kopyalanamadı.", "error");
    }
  });

  // Listeyi temizle
  document.getElementById("btnClearList").addEventListener("click", async () => {
    if (!groceryItems.length) return;
    if (!confirm("Liste tamamen silinsin mi?")) return;
    try {
      await clearGroceryList(groceryItems);
      groceryItems = [];
      renderGroceryList([], onGroceryToggle, onGroceryDelete);
      showToast("Liste temizlendi.", "success");
    } catch (err) {
      console.error("Liste temizlenemedi:", err);
      showToast("Hata oluştu.", "error");
    }
  });
}

/**
 * Ürün tamamla/geri al.
 * @param {string}  id
 * @param {boolean} currentDone
 */
async function onGroceryToggle(id, currentDone) {
  try {
    await toggleGroceryItem(id, currentDone);
    groceryItems = await getGroceryItems();
    renderGroceryList(groceryItems, onGroceryToggle, onGroceryDelete);
  } catch (err) {
    console.error("Güncelleme hatası:", err);
    showToast("Güncellenemedi.", "error");
  }
}

/**
 * Ürün sil.
 * @param {string} id
 */
async function onGroceryDelete(id) {
  try {
    await deleteGroceryItem(id);
    groceryItems = groceryItems.filter(i => i.id !== id);
    renderGroceryList(groceryItems, onGroceryToggle, onGroceryDelete);
  } catch (err) {
    console.error("Silme hatası:", err);
    showToast("Silinemedi.", "error");
  }
}

/* ══════════════════════════════════════════
   ANA SAYFA BUTONLARI
══════════════════════════════════════════ */

function bindHomeButtons() {
  // "Yapalım" — mevcut öneriyi onayla
  document.getElementById("btnMakeit").addEventListener("click", async () => {
    if (!currentFood) return;
    try {
      await markAsCooked(currentFood);
      await saveRecommendedFood(currentFood);

      isManualPick = true;
      showSuccessAnimation(`${currentFood.name} — Afiyet olsun!`);

      recentHistory = await getRecentHistory(5);
      renderRecentInfo(recentHistory);
      renderTodayCard(currentFood, true);
    } catch (err) {
      console.error("Kayıt hatası:", err);
      showToast("Bir hata oluştu.", "error");
    }
  });

  // "Başka Öner"
  document.getElementById("btnSuggest").addEventListener("click", () => {
    if (!allFoods.length) {
      showToast("Önce yemek listesine yemek ekleyin.", "error");
      return;
    }
    suggestFood();
  });
}

/* ══════════════════════════════════════════
   NAVİGASYON
══════════════════════════════════════════ */

function bindAllNavButtons() {
  // Tab bar + masaüstü nav
  document.querySelectorAll(".tab-btn, .nav-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const page = btn.dataset.page;
      showPage(page);
      if (page === "list")    await loadFoodList();
      if (page === "history") await loadHistory();
      if (page === "grocery") await loadGrocery();
    });
  });

  // Logo → ana sayfa
  document.getElementById("logoBtn")?.addEventListener("click", e => {
    e.preventDefault();
    showPage("home");
  });

  // "İlk Yemeği Ekle" butonu (boş durum)
  document.getElementById("btnGoAdd")?.addEventListener("click", () => showPage("add"));
}

/* ══════════════════════════════════════════
   MODAL KAPAT
══════════════════════════════════════════ */

function bindModalClose() {
  document.getElementById("btnCloseModal").addEventListener("click", closeRatingModal);
  document.querySelector(".modal__overlay").addEventListener("click", closeRatingModal);
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeRatingModal(); });
}

/* ══════════════════════════════════════════
   BAŞLAT
══════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", init);
