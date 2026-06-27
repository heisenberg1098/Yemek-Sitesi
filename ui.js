/**
 * ui.js
 * DOM render fonksiyonları ve arayüz yardımcıları.
 * Veri çekmez; hazır veriyi ekrana yansıtır.
 */

import { getAverageRating, formatDate } from "./food.js";

/* ══════════════════════════════════════════
   NAVİGASYON
══════════════════════════════════════════ */

/**
 * Sayfayı gösterir, nav butonlarını günceller.
 * @param {string} pageId - "home"|"list"|"grocery"|"add"|"history"
 */
export function showPage(pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("page--active"));
  document.getElementById(`page-${pageId}`)?.classList.add("page--active");

  // Tab bar butonları
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.page === pageId);
  });
  // Masaüstü nav butonları
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.page === pageId);
  });

  window.scrollTo({ top: 0, behavior: "instant" });
}

/* ══════════════════════════════════════════
   GÜNÜN YEMEĞİ KARTI
══════════════════════════════════════════ */

/**
 * Ana sayfadaki büyük öneri kartını render eder.
 * @param {Object|null} food          - Gösterilecek yemek
 * @param {boolean}     manuallyPicked - Manuel seçildiyse "Enes Öneriyor" etiketi
 */
export function renderTodayCard(food, manuallyPicked = false) {
  const card    = document.getElementById("todayCard");
  const btnMake = document.getElementById("btnMakeit");

  if (!food) {
    card.className = "today-card";
    card.innerHTML = `
      <div class="today-card__body">
        <p class="today-card__category">Öneri</p>
        <p class="today-card__name">Yemek listesi boş.</p>
        <p style="color:var(--color-text-sub);font-size:var(--text-sm)">
          Önce birkaç yemek ekleyin.
        </p>
      </div>`;
    btnMake.disabled = true;
    return;
  }

  const avg      = getAverageRating(food);
  const hasPhoto = food.photoUrl?.trim();
  const stars    = renderStarsDisplay(avg);

  // Manuel seçimde öne çıkan kart sınıfı + badge
  card.className = `today-card${manuallyPicked ? " today-card--featured" : ""}`;

  const badgeHtml = manuallyPicked
    ? `<div class="today-card__badge">
         <i data-lucide="star"></i>
         Enes Öneriyor
       </div>`
    : "";

  const photoHtml = hasPhoto
    ? `<img class="today-card__photo" src="${esc(food.photoUrl)}"
            alt="${esc(food.name)}" onerror="this.style.display='none'">`
    : "";

  card.innerHTML = `
    ${badgeHtml}
    ${photoHtml}
    <div class="today-card__body">
      <p class="today-card__category">${esc(food.category)}</p>
      <h2 class="today-card__name">${esc(food.name)}</h2>
      <div class="today-card__meta">
        <span class="today-card__time">
          <i data-lucide="clock"></i> ${food.prepTime} dk
        </span>
        <span class="today-card__rating">${stars}</span>
      </div>
    </div>`;

  btnMake.disabled = false;

  // Lucide ikonlarını yeniden çiz (dinamik HTML içinde)
  if (window.lucide) window.lucide.createIcons();
}

/**
 * Son yapılan yemekler bilgi satırını günceller.
 * @param {Array} recentItems
 */
export function renderRecentInfo(recentItems) {
  const box  = document.getElementById("recentInfo");
  const list = document.getElementById("recentList");
  if (!recentItems.length) { box.style.display = "none"; return; }
  list.textContent  = [...new Set(recentItems.map(i => i.name))].join(", ");
  box.style.display = "flex";
}

/* ══════════════════════════════════════════
   YEMEK GRID
══════════════════════════════════════════ */

/**
 * Yemek kartlarını grid'e render eder.
 * @param {Array}    foods
 * @param {Function} onCookClick - "Bugün Yap" tıklandığında
 * @param {Function} onRateClick - "Puanla" tıklandığında
 */
export function renderFoodGrid(foods, onCookClick, onRateClick) {
  const grid  = document.getElementById("foodGrid");
  const empty = document.getElementById("emptyState");

  if (!foods.length) {
    grid.innerHTML    = "";
    empty.style.display = "flex";
    return;
  }

  empty.style.display = "none";
  grid.innerHTML = foods.map(food => buildFoodCard(food)).join("");

  // Event'leri bağla
  grid.querySelectorAll(".btn-cook").forEach(btn => {
    btn.addEventListener("click", () => onCookClick(btn.dataset.id));
  });
  grid.querySelectorAll(".btn-rate").forEach(btn => {
    btn.addEventListener("click", () => onRateClick(btn.dataset.id, btn.dataset.name));
  });

  if (window.lucide) window.lucide.createIcons();
}

/**
 * Tek yemek kartı HTML'i üretir.
 * @param {Object} food
 * @returns {string}
 */
function buildFoodCard(food) {
  const avg      = getAverageRating(food);
  const hasPhoto = food.photoUrl?.trim();

  const photoHtml = hasPhoto
    ? `<img class="food-card__photo" src="${esc(food.photoUrl)}" alt="${esc(food.name)}"
            loading="lazy" onerror="this.parentElement.innerHTML='<div class=food-card__photo-placeholder>${categoryEmoji(food.category)}</div>'">`
    : `<div class="food-card__photo-placeholder">${categoryEmoji(food.category)}</div>`;

  return `
    <article class="food-card">
      ${photoHtml}
      <div class="food-card__body">
        <p class="food-card__category">${esc(food.category)}</p>
        <h3 class="food-card__name">${esc(food.name)}</h3>
        <div class="food-card__footer">
          <span class="food-card__time">
            <i data-lucide="clock"></i>${food.prepTime} dk
          </span>
          <div class="stars-display">${renderStarsDisplay(avg)}</div>
        </div>
      </div>
      <div class="food-card__actions">
        <button class="btn-cook" data-id="${food.id}" aria-label="${esc(food.name)} bugün yap">
          <i data-lucide="cooking-pot"></i> Bugün Yap
        </button>
        <button class="btn-rate" data-id="${food.id}" data-name="${esc(food.name)}" aria-label="Puanla">
          <i data-lucide="star"></i>
        </button>
      </div>
    </article>`;
}

/**
 * Filtre butonlarına olay bağlar.
 * @param {Function} onFilter
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
   ALIŞVERİŞ LİSTESİ
══════════════════════════════════════════ */

/**
 * Alışveriş listesini render eder.
 * @param {Array}    items
 * @param {Function} onToggle  - Tamamla/geri al
 * @param {Function} onDelete  - Sil
 */
export function renderGroceryList(items, onToggle, onDelete) {
  const list    = document.getElementById("groceryList");
  const empty   = document.getElementById("groceryEmpty");
  const toolbar = document.getElementById("groceryToolbar");

  if (!items.length) {
    list.innerHTML         = "";
    empty.style.display    = "flex";
    toolbar.style.display  = "none";
    return;
  }

  empty.style.display   = "none";
  toolbar.style.display = "flex";

  // Tamamlanmayanlar üstte, tamamlananlar altta
  const sorted = [
    ...items.filter(i => !i.done),
    ...items.filter(i =>  i.done)
  ];

  list.innerHTML = sorted.map(item => `
    <li class="grocery-item${item.done ? " grocery-item--done" : ""}" data-id="${item.id}">
      <button class="grocery-item__check" data-id="${item.id}" data-done="${item.done}"
              aria-label="${item.done ? "Geri al" : "Tamamla"}">
        <i data-lucide="check"></i>
      </button>
      <span class="grocery-item__name">${esc(item.name)}</span>
      <button class="grocery-item__delete" data-id="${item.id}" aria-label="Sil">
        <i data-lucide="x"></i>
      </button>
    </li>`).join("");

  list.querySelectorAll(".grocery-item__check").forEach(btn => {
    btn.addEventListener("click", () => {
      onToggle(btn.dataset.id, btn.dataset.done === "true");
    });
  });
  list.querySelectorAll(".grocery-item__delete").forEach(btn => {
    btn.addEventListener("click", () => onDelete(btn.dataset.id));
  });

  if (window.lucide) window.lucide.createIcons();
}

/* ══════════════════════════════════════════
   GEÇMİŞ
══════════════════════════════════════════ */

/**
 * Geçmiş listesini render eder.
 * @param {Array} items
 */
export function renderHistory(items) {
  const list  = document.getElementById("historyList");
  const empty = document.getElementById("historyEmpty");

  if (!items.length) {
    list.innerHTML         = "";
    empty.style.display    = "flex";
    return;
  }

  empty.style.display = "none";
  list.innerHTML = items.map(item => {
    const date  = item.cookedAt ? formatDate(item.cookedAt) : "—";
    const stars = renderStarsDisplay(item.rating ?? 0);
    return `
      <div class="history-item">
        <span class="history-item__date">${date}</span>
        <div class="history-item__info">
          <p class="history-item__name">${esc(item.name)}</p>
          <p class="history-item__category">${esc(item.category ?? "")}</p>
        </div>
        <div class="history-item__stars">${stars}</div>
      </div>`;
  }).join("");
}

/* ══════════════════════════════════════════
   PUANLAMA MODALİ
══════════════════════════════════════════ */

/**
 * Puanlama modalini açar.
 * @param {string}   foodId
 * @param {string}   foodName
 * @param {Function} onSubmit
 */
export function openRatingModal(foodId, foodName, onSubmit) {
  const modal   = document.getElementById("ratingModal");
  const title   = document.getElementById("modalFoodName");
  const stars   = document.getElementById("starRating");

  title.textContent = foodName;
  let selected = 0;

  // Yıldızları oluştur
  stars.innerHTML = [1,2,3,4,5].map(n =>
    `<button class="star-btn" data-value="${n}" aria-label="${n} yıldız">★</button>`
  ).join("");

  stars.querySelectorAll(".star-btn").forEach(btn => {
    const val = Number(btn.dataset.value);
    btn.addEventListener("click", () => {
      selected = val;
      stars.querySelectorAll(".star-btn").forEach(b => {
        b.classList.toggle("selected", Number(b.dataset.value) <= selected);
      });
      document.getElementById("btnSubmitRating").disabled = false;
    });
  });

  // Gönder butonunu tazele (eski listener'ı klonlayarak temizle)
  const oldBtn  = document.getElementById("btnSubmitRating");
  const newBtn  = oldBtn.cloneNode(true);
  newBtn.disabled = true;
  oldBtn.parentNode.replaceChild(newBtn, oldBtn);

  newBtn.addEventListener("click", () => {
    if (selected < 1) return;
    onSubmit(foodId, selected);
    closeRatingModal();
  });

  modal.classList.add("open");
  document.body.style.overflow = "hidden";
  if (window.lucide) window.lucide.createIcons();
}

/** Puanlama modalini kapatır. */
export function closeRatingModal() {
  document.getElementById("ratingModal").classList.remove("open");
  document.body.style.overflow = "";
}

/* ══════════════════════════════════════════
   BAŞARI ANİMASYONU
══════════════════════════════════════════ */

/**
 * Yeşil tik animasyonunu gösterir.
 * @param {string} message - Kullanıcıya gösterilecek metin
 * @param {number} duration - ms (varsayılan 1600)
 */
export function showSuccessAnimation(message, duration = 1600) {
  const overlay = document.getElementById("successOverlay");
  const text    = document.getElementById("successText");

  text.textContent = message;
  overlay.classList.add("show");
  if (window.lucide) window.lucide.createIcons();

  setTimeout(() => overlay.classList.remove("show"), duration);
}

/* ══════════════════════════════════════════
   TOAST
══════════════════════════════════════════ */

let toastTimer = null;

/**
 * Alt bildirim toastı gösterir.
 * @param {string} message
 * @param {"success"|"error"|""} type
 * @param {number} duration
 */
export function showToast(message, type = "", duration = 3000) {
  const toast = document.getElementById("toast");
  if (toastTimer) clearTimeout(toastTimer);

  toast.classList.remove("toast--success", "toast--error", "show");

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
   YARDIMCILAR
══════════════════════════════════════════ */

/**
 * 0–5 arası puan için dolu/boş yıldız HTML'i.
 * @param {number} avg
 * @returns {string}
 */
export function renderStarsDisplay(avg) {
  return [1,2,3,4,5].map(n =>
    `<span class="star${n <= Math.round(avg) ? " filled" : ""}" aria-hidden="true">★</span>`
  ).join("");
}

/**
 * Kategori emoji haritası.
 * @param {string} category
 * @returns {string}
 */
export function categoryEmoji(category) {
  const map = { çorba:"🥣", et:"🥩", tavuk:"🍗", sebze:"🥦", makarna:"🍝", diğer:"🍽️" };
  return map[category?.toLowerCase()] ?? "🍽️";
}

/**
 * XSS koruması — tüm kullanıcı girdileri bu fonksiyondan geçer.
 * @param {string} str
 * @returns {string}
 */
function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;");
}
