/**
 * ui.js
 * DOM işlemleri ve arayüz render fonksiyonları.
 * Veri çekmez; aldığı veriyi ekrana yansıtır.
 * app.js bu modülü orkestra eder.
 */

import { getAverageRating, formatDate } from "./food.js";

/* ══════════════════════════════════════════
   SAYFA NAVİGASYONU
══════════════════════════════════════════ */

/**
 * Belirtilen sayfayı gösterir, diğerlerini gizler.
 * Nav butonlarının "active" sınıfını günceller.
 * @param {string} pageId - "home" | "list" | "add" | "history"
 */
export function showPage(pageId) {
  // Tüm sayfaları gizle
  document.querySelectorAll(".page").forEach(p => p.classList.remove("page--active"));

  // Hedef sayfayı göster
  const target = document.getElementById(`page-${pageId}`);
  if (target) target.classList.add("page--active");

  // Nav butonlarını güncelle
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.page === pageId);
  });

  // Mobil menüyü kapat
  closeMobileMenu();

  // Sayfanın en üstüne kaydır
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * Mobil hamburger menüyü açar/kapatır.
 */
export function toggleMobileMenu() {
  const nav    = document.querySelector(".header__nav");
  const toggle = document.getElementById("menuToggle");
  const isOpen = nav.classList.toggle("open");
  toggle.classList.toggle("open", isOpen);
  toggle.setAttribute("aria-label", isOpen ? "Menüyü kapat" : "Menüyü aç");
}

/**
 * Mobil menüyü kapatır.
 */
export function closeMobileMenu() {
  document.querySelector(".header__nav").classList.remove("open");
  const toggle = document.getElementById("menuToggle");
  toggle.classList.remove("open");
  toggle.setAttribute("aria-label", "Menüyü aç");
}

/* ══════════════════════════════════════════
   GÜNÜN YEMEĞİ KARTI
══════════════════════════════════════════ */

/**
 * Ana sayfadaki "Günün Yemeği" kartını render eder.
 * @param {Object|null} food - Gösterilecek yemek nesnesi
 */
export function renderTodayCard(food) {
  const card      = document.getElementById("todayCard");
  const btnMake   = document.getElementById("btnMakeit");

  if (!food) {
    card.innerHTML = `
      <div class="today-card__body">
        <p class="today-card__category">Öneri</p>
        <p class="today-card__name">Yemek listesi boş.</p>
        <p style="color:var(--color-text-sub); font-size:var(--text-sm);">
          Önce birkaç yemek ekleyin.
        </p>
      </div>`;
    btnMake.disabled = true;
    return;
  }

  const avg        = getAverageRating(food);
  const hasPhoto   = food.photoUrl && food.photoUrl.trim() !== "";
  const starsHtml  = renderStarsDisplay(avg);

  if (hasPhoto) {
    card.className = "today-card today-card--with-photo";
    card.innerHTML = `
      <img
        class="today-card__photo"
        src="${escHtml(food.photoUrl)}"
        alt="${escHtml(food.name)}"
        onerror="this.style.display='none'"
      />
      <div class="today-card__body">
        <p class="today-card__category">${escHtml(food.category)}</p>
        <h2 class="today-card__name">${escHtml(food.name)}</h2>
        <div class="today-card__meta">
          <span class="today-card__time">⏱ ${food.prepTime} dk</span>
          <span class="today-card__rating">${starsHtml}</span>
        </div>
      </div>`;
  } else {
    card.className = "today-card";
    card.innerHTML = `
      <div class="today-card__body">
        <p class="today-card__category">${escHtml(food.category)}</p>
        <h2 class="today-card__name">${escHtml(food.name)}</h2>
        <div class="today-card__meta">
          <span class="today-card__time">⏱ ${food.prepTime} dk</span>
          <span class="today-card__rating">${starsHtml}</span>
        </div>
      </div>`;
  }

  btnMake.disabled = false;
}

/**
 * Son yapılan yemekler bilgi satırını günceller.
 * @param {Array} recentItems - Geçmiş kayıtları
 */
export function renderRecentInfo(recentItems) {
  const box  = document.getElementById("recentInfo");
  const list = document.getElementById("recentList");

  if (recentItems.length === 0) {
    box.style.display = "none";
    return;
  }

  // Tekrarsız yemek adları
  const uniqueNames = [...new Set(recentItems.map(i => i.name))];
  list.textContent  = uniqueNames.join(", ");
  box.style.display = "block";
}

/* ══════════════════════════════════════════
   YEMEK LİSTESİ
══════════════════════════════════════════ */

/**
 * Yemek kartlarını grid'e render eder.
 * @param {Array}  foods           - Gösterilecek yemekler
 * @param {Function} onRateClick   - Kart üzerindeki "Puanla" tıklandığında çağrılır
 */
export function renderFoodGrid(foods, onRateClick) {
  const grid       = document.getElementById("foodGrid");
  const emptyState = document.getElementById("emptyState");

  if (foods.length === 0) {
    grid.innerHTML      = "";
    emptyState.style.display = "flex";
    return;
  }

  emptyState.style.display = "none";
  grid.innerHTML = foods.map(food => buildFoodCard(food)).join("");

  // "Puanla" butonlarına event bağla
  grid.querySelectorAll(".btn-rate").forEach(btn => {
    btn.addEventListener("click", () => {
      const foodId   = btn.dataset.id;
      const foodName = btn.dataset.name;
      onRateClick(foodId, foodName);
    });
  });
}

/**
 * Tek bir yemek kartının HTML'ini üretir.
 * @param {Object} food - Yemek nesnesi
 * @returns {string} HTML string
 */
function buildFoodCard(food) {
  const avg       = getAverageRating(food);
  const starsHtml = renderStarsDisplay(avg);
  const hasPhoto  = food.photoUrl && food.photoUrl.trim() !== "";

  const photoHtml = hasPhoto
    ? `<img class="food-card__photo" src="${escHtml(food.photoUrl)}" alt="${escHtml(food.name)}" loading="lazy" onerror="this.style.display='none'">`
    : `<div class="food-card__photo-placeholder">${categoryEmoji(food.category)}</div>`;

  return `
    <article class="food-card">
      ${photoHtml}
      <div class="food-card__body">
        <p class="food-card__category">${escHtml(food.category)}</p>
        <h3 class="food-card__name">${escHtml(food.name)}</h3>
        <div class="food-card__footer">
          <span class="food-card__time">⏱ ${food.prepTime} dk</span>
          <div class="stars-display">${starsHtml}</div>
          <button
            class="btn-rate"
            data-id="${food.id}"
            data-name="${escHtml(food.name)}"
            aria-label="${escHtml(food.name)} yemeğini puanla"
          >Puanla</button>
        </div>
      </div>
    </article>`;
}

/**
 * Kategori filtre butonlarına event bağlar.
 * @param {Function} onFilter - Seçilen kategori string'i ile çağrılır
 */
export function bindFilterButtons(onFilter) {
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      onFilter(btn.dataset.category);
    });
  });
}

/* ══════════════════════════════════════════
   GEÇMİŞ LİSTESİ
══════════════════════════════════════════ */

/**
 * Geçmiş sayfasındaki yemek listesini render eder.
 * @param {Array} items - Geçmiş kayıtları (en yeni önce)
 */
export function renderHistory(items) {
  const list         = document.getElementById("historyList");
  const emptyHistory = document.getElementById("historyEmpty");

  if (items.length === 0) {
    list.innerHTML          = "";
    emptyHistory.style.display = "flex";
    return;
  }

  emptyHistory.style.display = "none";
  list.innerHTML = items.map(item => {
    const starsHtml = renderStarsDisplay(item.rating ?? 0);
    const dateText  = item.cookedAt ? formatDate(item.cookedAt) : "—";

    return `
      <div class="history-item">
        <span class="history-item__date">${dateText}</span>
        <span class="history-item__name">${escHtml(item.name)}</span>
        <div class="history-item__rating">${starsHtml}</div>
      </div>`;
  }).join("");
}

/* ══════════════════════════════════════════
   PUANLAMA MODALİ
══════════════════════════════════════════ */

/**
 * Puanlama modalini açar ve yıldız seçme widgetını hazırlar.
 * @param {string}   foodId   - Puanlanacak yemeğin ID'si
 * @param {string}   foodName - Modal başlığında gösterilecek isim
 * @param {Function} onSubmit - Seçilen puan (1–5) ile çağrılır
 */
export function openRatingModal(foodId, foodName, onSubmit) {
  const modal    = document.getElementById("ratingModal");
  const title    = document.getElementById("modalFoodName");
  const stars    = document.getElementById("starRating");
  const btnSubmit = document.getElementById("btnSubmitRating");

  title.textContent = foodName;
  let selected = 0;

  // Yıldızları oluştur
  stars.innerHTML = [1, 2, 3, 4, 5].map(n => `
    <button
      class="star-btn"
      data-value="${n}"
      role="radio"
      aria-checked="false"
      aria-label="${n} yıldız"
    >★</button>`).join("");

  // Yıldız hover ve seçim mantığı
  stars.querySelectorAll(".star-btn").forEach(btn => {
    const val = Number(btn.dataset.value);

    btn.addEventListener("mouseenter", () => highlightStars(stars, val));
    btn.addEventListener("mouseleave", () => highlightStars(stars, selected));

    btn.addEventListener("click", () => {
      selected = val;
      highlightStars(stars, selected);
      // Seçilen yıldızı aria ile işaretle
      stars.querySelectorAll(".star-btn").forEach(b => {
        b.setAttribute("aria-checked", Number(b.dataset.value) === selected ? "true" : "false");
      });
      btnSubmit.disabled = false;
    });
  });

  // Başlangıçta gönder butonu pasif
  btnSubmit.disabled = true;

  // Gönder butonu — eski listener'ı temizle
  const newBtn = btnSubmit.cloneNode(true);
  btnSubmit.parentNode.replaceChild(newBtn, btnSubmit);
  newBtn.disabled = true;

  newBtn.addEventListener("click", () => {
    if (selected < 1) return;
    onSubmit(foodId, selected);
    closeRatingModal();
  });

  modal.classList.add("open");
  document.body.style.overflow = "hidden";
}

/**
 * Puanlama modalini kapatır.
 */
export function closeRatingModal() {
  document.getElementById("ratingModal").classList.remove("open");
  document.body.style.overflow = "";
}

/**
 * Yıldızları verilen değere kadar renklendirir (hover veya seçim).
 * @param {HTMLElement} container - Yıldız butonlarının parent'ı
 * @param {number}      upTo      - Bu değere kadar renklendir (dahil)
 */
function highlightStars(container, upTo) {
  container.querySelectorAll(".star-btn").forEach(btn => {
    const val = Number(btn.dataset.value);
    btn.classList.toggle("selected", val <= upTo);
  });
}

/* ══════════════════════════════════════════
   TOAST BİLDİRİMİ
══════════════════════════════════════════ */

/** Aktif toast zamanlayıcısı — çakışmayı önler */
let toastTimer = null;

/**
 * Ekranın altında kısa süreli bildirim gösterir.
 * @param {string} message          - Gösterilecek metin
 * @param {"success"|"error"|""} type - Renk türü (varsayılan: koyu gri)
 * @param {number} duration         - Gösterim süresi ms (varsayılan: 3000)
 */
export function showToast(message, type = "", duration = 3000) {
  const toast = document.getElementById("toast");

  // Önceki timer varsa iptal et
  if (toastTimer) clearTimeout(toastTimer);

  // Tip sınıflarını temizle
  toast.classList.remove("toast--success", "toast--error", "show");

  // Bir sonraki frame'de ekle (CSS geçişi tetiklensin)
  requestAnimationFrame(() => {
    toast.textContent = message;
    if (type) toast.classList.add(`toast--${type}`);
    toast.classList.add("show");
  });

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
    toastTimer = null;
  }, duration);
}

/* ══════════════════════════════════════════
   YARDIMCI FONKSİYONLAR
══════════════════════════════════════════ */

/**
 * 0–5 arası bir puana göre dolu/boş yıldız HTML'i üretir.
 * @param {number} avg - Ortalama puan
 * @returns {string} HTML string
 */
export function renderStarsDisplay(avg) {
  return [1, 2, 3, 4, 5].map(n =>
    `<span class="star ${n <= Math.round(avg) ? "filled" : ""}" aria-hidden="true">★</span>`
  ).join("");
}

/**
 * Kategoriye göre emoji döndürür (fotoğraf yoksa placeholder için).
 * @param {string} category - Yemek kategorisi
 * @returns {string} Emoji
 */
export function categoryEmoji(category) {
  const map = {
    çorba:   "🥣",
    et:      "🥩",
    tavuk:   "🍗",
    sebze:   "🥦",
    makarna: "🍝",
    diğer:   "🍽️"
  };
  return map[category?.toLowerCase()] ?? "🍽️";
}

/**
 * HTML özel karakterlerini escape eder.
 * XSS saldırılarına karşı her kullanıcı girdisi bu fonksiyondan geçirilir.
 * @param {string} str - Ham metin
 * @returns {string} Güvenli metin
 */
function escHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
