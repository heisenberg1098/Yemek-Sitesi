/**
 * app.js
 * Ana orkestratör.
 * food.js + grocery.js (veri) ve ui.js (arayüz) bağlantısı.
 */

import {
  getAllFoods, addFood, rateFood,
  markAsCooked, getRecentHistory, getFullHistory,
  pickRandomFood, saveRecommendedFood,
  clearRecommendedFood, getRecommendedFood, normalizeCategory
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

let allFoods = [];   // Firestore'dan çekilen yemek listesi
let currentFood = null; // Şu an önerilen yemek
let recentHistory = [];   // Son 5 günlük geçmiş
let activeCategory = "all";
let isManualPick = false; // "Bugün Yap" ile mi seçildi?
let groceryItems = [];    // Alışveriş listesi (bellekte)

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
  bindMenuSuggest();

  await loadAllData();
  showPage("home");
}

/* ══════════════════════════════════════════
   VERİ YÜKLEME
══════════════════════════════════════════ */

/**
 * İlk yükleme: yemekler + geçmiş paralel çekilir.
 */async function loadAllData() {
  try {
    const [foodsData, historyData, recommendedData] = await Promise.all([
      getAllFoods(),
      getRecentHistory(5),
      getRecommendedFood()
    ]);

    allFoods = foodsData;
    recentHistory = historyData;

    // Eğer Firebase'de manuel seçilmiş bir yemek varsa onu göster!
    if (recommendedData && recommendedData.manuallySelected && recommendedData.recommendedFood) {
      isManualPick = true;
      // Kaydedilen anlık görüntü yerine, varsa allFoods'taki taze veriyi kullan
      // (puan/rateCount gibi alanlar güncel kalsın). Yemek silinmişse kayıtlı
      // anlık görüntüye geri dön.
      const savedFood = recommendedData.recommendedFood;
      currentFood = allFoods.find(f => f.id === savedFood.id) ?? savedFood;
      renderTodayCard(currentFood, true);
    } else {
      suggestFood(); // Yoksa rastgele öner
    }

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
  currentFood = pickRandomFood(allFoods, recentHistory);
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
    currentFood = food;

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

/**
 * Kategori filtresi değiştiğinde çağrılır.
 * @param {string} category - Filtre butonundan gelen kategori değeri
 */
function onCategoryFilter(category) {
  activeCategory = category;
  applyFilter(category);
}

/**
 * Yemekleri kategoriye göre filtreler ve grid'i render eder.
 * Normalize karşılaştırma ile büyük/küçük harf ve boşluk farkları giderilir.
 * @param {string} category - "all" veya kategori adı
 */
function applyFilter(category) {
  const filtered = category === "all"
    ? allFoods
    : allFoods.filter(f => normalizeCategory(f.category) === normalizeCategory(category));
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
    const name = document.getElementById("inputName").value.trim();
    const category = document.getElementById("inputCategory").value;
    const prepTime = document.getElementById("inputTime").value;
    const photoUrl = document.getElementById("inputPhoto").value.trim();

    const error = validateFoodForm(name, category, prepTime);
    if (error) {
      errBox.textContent = error;
      errBox.style.display = "block";
      return;
    }

    errBox.style.display = "none";
    btnAdd.disabled = true;
    btnAdd.textContent = "Ekleniyor…";

    try {
      await addFood({ name, category, prepTime, photoUrl });
      showToast(`"${name}" eklendi.`, "success");
      resetAddForm();
      allFoods = await getAllFoods();
    } catch (err) {
      console.error("Yemek eklenemedi:", err);
      showToast("Yemek eklenemedi.", "error");
    } finally {
      btnAdd.disabled = false;
      btnAdd.innerHTML = '<i data-lucide="plus-circle"></i> Yemeği Ekle';
      if (window.lucide) window.lucide.createIcons();
    }
  });
}

/** @returns {string|null} */
function validateFoodForm(name, category, prepTime) {
  if (!name || name.length < 2) return "Yemek adı en az 2 karakter olmalı.";
  if (!category) return "Lütfen bir kategori seçin.";
  if (!prepTime || isNaN(prepTime) || Number(prepTime) < 1)
    return "Geçerli bir hazırlama süresi girin.";
  return null;
}

function resetAddForm() {
  ["inputName", "inputCategory", "inputTime", "inputPhoto"].forEach(id => {
    document.getElementById(id).value = "";
  });
  document.getElementById("formError").style.display = "none";
}

/* ══════════════════════════════════════════
   PANOYA KOPYALAMA — GARANTİLİ YÖNTEM
   navigator.clipboard her zaman güvenilir değildir:
   - HTTP (non-HTTPS) veya file:// üzerinde tanımsız olabilir.
   - Bazı tarayıcılarda (Safari/iOS, eski Chrome/Android WebView)
     "izin reddedildi" tipi hata fırlatabilir.
   - document.execCommand('copy') exception FIRLATMAZ, sadece
     true/false döner — bu dönüş değeri kontrol edilmezse kopyalama
     sessizce başarısız olur ama kullanıcıya "başarılı" denir.
   Bu yüzden iki yöntem de gerçek sonucuna göre değerlendirilir ve
   kullanıcı için sırayla denenir; hangisi tutarsa o kullanılır.
══════════════════════════════════════════ */

/**
 * execCommand tabanlı eski tip kopyalama (fallback).
 * Dönüş değeri MUTLAKA kontrol edilir.
 * @param {string} text
 * @returns {boolean} Kopyalama gerçekten başarılı oldu mu
 */
function legacyCopyToClipboard(text) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  // Ekran dışına, görünmez şekilde yerleştir — scroll/zoom tetiklemesin
  textArea.style.position = "fixed";
  textArea.style.top = "0";
  textArea.style.left = "-9999px";
  textArea.style.width = "1px";
  textArea.style.height = "1px";
  textArea.setAttribute("readonly", "");
  document.body.appendChild(textArea);

  const selection = document.getSelection();
  const previousRange = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  textArea.select();
  textArea.setSelectionRange(0, textArea.value.length); // iOS Safari için gerekli

  let success = false;
  try {
    success = document.execCommand("copy"); // dönüş değeri kontrol ediliyor
  } catch {
    success = false;
  }

  document.body.removeChild(textArea);

  // Önceki seçimi geri yükle (kullanıcının sayfadaki seçimini bozmasın)
  if (previousRange) {
    selection.removeAllRanges();
    selection.addRange(previousRange);
  }

  return success;
}

/**
 * Metni panoya kopyalar. Önce modern Clipboard API'yi dener,
 * başarısız olursa veya kullanılamıyorsa execCommand fallback'ine
 * geçer. Kullanıcı tek tuşla her zaman bir sonuç görür.
 * @param {string} text
 */
async function copyTextToClipboard(text) {
  // 1) Modern Clipboard API — sadece güvenli bağlamda (HTTPS/localhost) var
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      showToast("Liste panoya kopyalandı.", "success");
      return;
    } catch (err) {
      // İzin reddi, kullanıcı jesti kopması vb. — fallback'e düş
      console.warn("Clipboard API başarısız, eski yönteme geçiliyor:", err);
    }
  }

  // 2) Eski yöntem (HTTP, file://, izin verilmeyen tarayıcılar için)
  if (legacyCopyToClipboard(text)) {
    showToast("Liste panoya kopyalandı.", "success");
  } else {
    showToast("Kopyalanamadı.", "error");
  }
}

/* ══════════════════════════════════════════
   ALIŞVERİŞ LİSTESİ
══════════════════════════════════════════ */

function bindGroceryPage() {
  const input = document.getElementById("groceryInput");
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
    await copyTextToClipboard(text);
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
  // "Başka Öner"
  document.getElementById("btnSuggest").addEventListener("click", async () => {
    if (!allFoods.length) {
      showToast("Önce yemek listesine yemek ekleyin.", "error");
      return;
    }
    
    try {
      await clearRecommendedFood(); // Firebase'deki manuel seçimi kaldır
      suggestFood(); // Yerel olarak yeni rastgele yemek seç
      showToast("Yeni öneri getirildi.", "success");
    } catch (err) {
      console.error("Öneri yenilenemedi:", err);
    }
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
      if (page === "list") await loadFoodList();
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

/* ══════════════════════════════════════════
   MENÜ ÖNER
══════════════════════════════════════════ */

/**
 * Menü konfigürasyonu.
 * Her slot: hangi kategori(ler)den seçim yapılacağı ve görüntüleme bilgileri.
 * "optional: true" ise bu kategoride yemek yoksa slot atlanır.
 */
const MENU_SLOTS = [
  {
    role: "Çorba",
    icon: "🥣",
    cats: ["çorba"],
    optional: false
  },
  {
    role: "Ana Yemek",
    icon: "🍗",
    cats: ["et", "tavuk", "sebze"],
    optional: false
  },
  {
    role: "Yardımcı Yemek",
    icon: "🍚",
    cats: ["makarna", "pilav", "diğer"],
    optional: true
  },
  {
    role: "Salata",
    icon: "🥗",
    cats: ["salata"],
    optional: true
  },
  {
    role: "Tatlı",
    icon: "🍰",
    cats: ["tatlı"],
    optional: true
  }
];

/**
 * Belirli kategoriler arasından rastgele bir yemek döndürür.
 * Büyük/küçük harf normalizasyonu uygulanır.
 * @param {string[]} cats - Aranacak kategori listesi
 * @returns {Object|null}
 */
function pickFromCategories(cats) {
  const pool = allFoods.filter(f => cats.some(c => normalizeCategory(f.category) === normalizeCategory(c)));
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * MENU_SLOTS listesinden her slot için rastgele yemek seçer.
 * Optional slotlarda yemek yoksa o satır atlanır.
 * @returns {Array} Seçilen menü öğeleri: { role, icon, name }
 */
function buildRandomMenu() {
  const result = [];
  for (const slot of MENU_SLOTS) {
    const food = pickFromCategories(slot.cats);
    if (!food && slot.optional) continue;   // Opsiyonel ve boş — atla
    result.push({
      role: slot.role,
      icon: slot.icon,
      name: food ? food.name : "(yemek eklenmemiş)"
    });
  }
  return result;
}

/**
 * Menü sonucunu DOM'a render eder.
 * @param {Array} menuItems - buildRandomMenu() çıktısı
 */
function renderMenuResult(menuItems) {
  const resultDiv = document.getElementById("menuResult");
  const resultList = document.getElementById("menuResultList");
  const btnMenu = document.getElementById("btnSuggestMenu");

  if (!menuItems.length) {
    resultDiv.style.display = "none";
    return;
  }

  resultList.innerHTML = menuItems.map(item => `
    <li class="menu-result__item">
      <span class="menu-result__item-icon">${item.icon}</span>
      <div class="menu-result__item-body">
        <p class="menu-result__item-role">${item.role}</p>
        <p class="menu-result__item-name">${item.name}</p>
      </div>
    </li>
  `).join("");

  resultDiv.style.display = "block";

  // Buton metnini güncelle
  btnMenu.innerHTML = `<i data-lucide="refresh-cw"></i> Yeniden Öner`;
  btnMenu.classList.add("has-result");
  if (window.lucide) window.lucide.createIcons();
}

/**
 * "Menü Öner" butonuna event bağlar.
 */
function bindMenuSuggest() {
  const btn = document.getElementById("btnSuggestMenu");
  if (!btn) return;

  btn.addEventListener("click", () => {
    if (!allFoods.length) {
      showToast("Önce yemek listesine yemek ekleyin.", "error");
      return;
    }
    const menu = buildRandomMenu();
    renderMenuResult(menu);
  });
}

document.addEventListener("DOMContentLoaded", init);
