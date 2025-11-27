// js/main.js

import { ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseGlobal = window.kc326e;
let db = null;
let auth = null;

if (firebaseGlobal) {
  db = firebaseGlobal.db;
  auth = firebaseGlobal.auth;
} else {
  console.warn("kc326e (firebase-core) chưa load trước main.js");
}

if (db) {
  const wifiRef = ref(db, "Data/Wifi");
  onValue(wifiRef, (snap) => {
    const wifiData = snap.val();
    // TODO: cập nhật UI wifi-floating ở đây
    // console.log("wifi:", wifiData);
  });
}

// ✨ Highlight <strong> trong mô tả preset (hợp nền tối & kính mờ)
(function injectStrongHighlightStyles() {
  const style = document.createElement("style");
  style.textContent = `
    /* Mặc định (light/dark đều ổn) */
    #popupDesc strong {
      color: #ffd86b;                 /* vàng nhạt nổi bật */
      background: rgba(255, 255, 255, 0.08);
      padding: 2px 6px;
      border-radius: 6px;
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      font-weight: 700;
      display: inline-block;
    }

    /* Nếu bạn có dark mode qua class .dark trên <body> */
    body.dark #popupDesc strong {
      color: #ffeb9c;
      background: rgba(255, 255, 255, 0.12);
    }

    /* Nếu chi tiết còn hiển thị ở nơi khác (tuỳ bạn bật), cứ giữ style nhất quán */
    .tab-content .details strong,
    .plant-details strong {
      color: #ffd86b;
      background: rgba(255, 255, 255, 0.08);
      padding: 2px 6px;
      border-radius: 6px;
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      font-weight: 700;
      display: inline-block;
    }
    body.dark .tab-content .details strong,
    body.dark .plant-details strong {
      color: #ffeb9c;
      background: rgba(255, 255, 255, 0.12);
    }
  `;
  document.head.appendChild(style);
})();


/* ================== PRESET THÔNG SỐ RAU ================== */
const PLANT_PRESETS = {
  content1: {
    name: "Sweet Cabbage (Cải ngọt)",
    tmin: 25, tmax: 30,
    hmin: 70, hmax: 85,
    details: "- Growth period:  <strong>5–8 days</strong> after sowing\n-Harvest when the vegetables reach a height of about  <strong>8–12 cm </strong>\n- Water with a mist spray <strong>1–2 times</strong> per day\n- Maintain suitable temperature, when the temperature is low the plant grows slowly, when the temperature is high the plant is easily damaged by high temperature.\n- Humidity must be kept high but avoid waterlogging which can damage the seeds.\n- The light and temperature should not be too high, just at the right level."
  },
  content2: {
    name: "Bok choy (Cải thìa)",
    tmin: 22, tmax: 28,
    hmin: 60, hmax: 70,
    details: "- Growth period: From sowing to harvest takes about <strong>6–10 days</strong>\n- The stems grow to a height of around  <strong>8–12 cm</strong>\n- Watering is done with a mist spray  <strong>1–2 times</strong> per day.\n- Maintain suitable temperature, when the temperature is low the plant grows slowly, when the temperature is high the plant is easily damaged by high temperature.\n- Humidity must be kept high but avoid waterlogging which can damage the seeds.\n- The light and temperature should not be too high, just at the right level."
  },
  content3: {
    name: "Bean sprouts (Giá đỗ)",
    tmin: 25, tmax: 30,
    hmin: 80, hmax: 95,
    details: "- Growth period: From sowing to harvest takes about <strong>5–7 days</strong>\n- Harvest when the stems turn  <strong>white and the red leaves become prominent</strong>\n- Water with a mist spray <strong>1–2 times</strong> per day.\n- Maintain suitable temperature, when the temperature is low the plant grows slowly, when the temperature is high the plant is easily damaged by high temperature.\n- Humidity must be kept high but avoid waterlogging which can damage the seeds.\n- The light and temperature should not be too high, just at the right level."
  },
  content4: {
    name: "Spinach (Rau muống)",
    tmin: 28, tmax: 32,
    hmin: 75, hmax: 85,
    details: "- Growth period: From sowing to harvest takes about <strong>6–8 days</strong>\n- The plants reach a height of around <strong>8–12 cm</strong> and can then be harvested\n- Water with a mist spray <strong>1–2 times</strong> per day.\n- Maintain suitable temperature, when the temperature is low the plant grows slowly, when the temperature is high the plant is easily damaged by high temperature.\n- Humidity must be kept high but avoid waterlogging which can damage the seeds.\n- The light and temperature should not be too high, just at the right level."
  },
  content5: {
    name: "Broccoli (Bông cải xanh)",
    tmin: 20, tmax: 25,
    hmin: 70, hmax: 80,
    details: "- Growth period: From sowing to harvest takes about <strong>5–7 days</strong>\n- The vegetables grow to a height of around  <strong>8–10 cm</strong> with green leaves and white stems\n- Water with a mist spray  <strong>1–2 times </strong> per day.\n- Maintain suitable temperature, when the temperature is low the plant grows slowly, when the temperature is high the plant is easily damaged by high temperature.\n- Humidity must be kept high but avoid waterlogging which can damage the seeds.\n- The light and temperature should not be too high, just at the right level."
  }
};

/* ====== HÀM LƯU LOCALSTORAGE ====== */
function savePlantToLocalStorage(plantId) {
  const preset = PLANT_PRESETS[plantId];
  if (!preset) return;
  localStorage.setItem("information.js_activePlant", plantId);
  localStorage.setItem("information.js_plantName", preset.name);
  localStorage.setItem("information.js_tmin", preset.tmin);
  localStorage.setItem("information.js_tmax", preset.tmax);
  localStorage.setItem("information.js_hmin", preset.hmin);
  localStorage.setItem("information.js_hmax", preset.hmax);
}

/* ====== 👉 NEW: GỬI LÊN RTDB /Details ====== */
function pushPlantDetailsToRTDB(plantId, preset) {
  if (!db || !preset) return;
  const detailsRef = ref(db, "Details"); // bạn muốn đè 1 chỗ
  const now = new Date();
  const ts =
    now.getFullYear() + "-" +
    String(now.getMonth() + 1).padStart(2, "0") + "-" +
    String(now.getDate()).padStart(2, "0") + " " +
    String(now.getHours()).padStart(2, "0") + ":" +
    String(now.getMinutes()).padStart(2, "0") + ":" +
    String(now.getSeconds()).padStart(2, "0");

  set(detailsRef, {
    plantId: plantId,
    plantName: preset.name,
    tmin: preset.tmin,
    tmax: preset.tmax,
    hmin: preset.hmin,
    hmax: preset.hmax,
    description: preset.details || "",
    time: ts
  }).catch(err => {
    console.warn("Không ghi được /Details:", err);
  });
}

/* ====== RENDER THÔNG SỐ ====== */
function renderPlantInfo(plantId) {
  const preset = PLANT_PRESETS[plantId];
  if (!preset) return;
  const nameEl = document.getElementById("plantNameShow");
  const tempEl = document.getElementById("plantTempRange");
  const humiEl = document.getElementById("plantHumiRange");

  if (nameEl) nameEl.textContent = preset.name;
  if (tempEl) tempEl.textContent = `${preset.tmin} – ${preset.tmax}°C`;
  if (humiEl) humiEl.textContent = `${preset.hmin} – ${preset.hmax}%`;
}

/* ====== CHỌN RAU BÊN PANEL ====== */
const plantCards = document.querySelectorAll(".plant-card");
const contents = document.querySelectorAll(".tab-content");

function activatePlant(plantId) {
  const preset = PLANT_PRESETS[plantId];
  if (!preset) return;

  renderPlantInfo(plantId);

  contents.forEach(c => c.classList.toggle("active", c.id === plantId));
  plantCards.forEach(card => {
    card.classList.toggle("active", card.dataset.target === plantId);
  });

  savePlantToLocalStorage(plantId);

  pushPlantDetailsToRTDB(plantId, preset);

  if (typeof window.setCarouselActiveByPlantId === "function") {
    window.setCarouselActiveByPlantId(plantId);
  }
}

plantCards.forEach(card => {
  const id = card.dataset.target;
  card.addEventListener("click", () => activatePlant(id));

  card.addEventListener("mouseenter", () => {
    const currentActive = localStorage.getItem("information.js_activePlant");
    if (currentActive && currentActive !== id) {
      renderPlantInfo(id);
      contents.forEach(c => c.classList.toggle("active", c.id === id));
      plantCards.forEach(c => c.classList.toggle("active", c.dataset.target === id));
    }
  });

  card.addEventListener("mouseleave", () => {
    const saved = localStorage.getItem("information.js_activePlant") || "content1";
    activatePlant(saved);
  });
});

window.addEventListener("DOMContentLoaded", () => {
  const lastPlant = localStorage.getItem("information.js_activePlant");
  const activePlantId = (lastPlant && PLANT_PRESETS[lastPlant]) ? lastPlant : "content1";
  activatePlant(activePlantId);
});

/* ====== CAROUSEL 3D (giữ nguyên) ====== */
document.addEventListener("DOMContentLoaded", () => {
  const cards = document.querySelectorAll(".carousel .veg-card");
  const popup = document.getElementById("vegPopup");
  const popupClose = document.getElementById("popupClose");
  const popupTitle = document.getElementById("popupTitle");
  const popupTemp = document.getElementById("popupTemp");
  const popupHumi = document.getElementById("popupHumi");
  const popupDesc = document.getElementById("popupDesc");
  const popupAvatar = document.getElementById("popupAvatar");

  let activeIndex = 0;

  function updateCarousel() {
    cards.forEach((card, i) => {
      card.className = "veg-card";
      if (i === activeIndex) card.classList.add("active");
      else if (i === activeIndex - 1) card.classList.add("left1");
      else if (i === activeIndex - 2) card.classList.add("left2");
      else if (i === activeIndex + 1) card.classList.add("right1");
      else if (i === activeIndex + 2) card.classList.add("right2");
    });
  }

  function setActive(idx) {
    activeIndex = idx;
    if (activeIndex < 0) activeIndex = cards.length - 1;
    if (activeIndex >= cards.length) activeIndex = 0;
    updateCarousel();
  }

  function openPopupFromCard(card) {
    const plantId = card.dataset.plant;
    const preset = PLANT_PRESETS[plantId];
    const emojiEl = card.querySelector(".veg-icon");
    const emoji = emojiEl ? emojiEl.textContent.trim() : "🌱";

    if (preset) {
      popupTitle.textContent = preset.name;
      popupTemp.textContent = `Temperature: ${preset.tmin} – ${preset.tmax}°C`;
      popupHumi.textContent = `Humidity: ${preset.hmin} – ${preset.hmax}%`;
      const raw = preset.details || "";
      popupDesc.innerHTML = raw.replace(/\r?\n|\r/g, "<br>");
    } else {
      const nameEl = card.querySelector(".veg-name");
      popupTitle.textContent = nameEl ? nameEl.textContent.trim() : "Vegetable";
      popupTemp.textContent = "";
      popupHumi.textContent = "";
      popupDesc.textContent = "";
    }

    if (popupAvatar) popupAvatar.textContent = emoji;

    popup.classList.add("show");
  }

  cards.forEach((card, i) => {
    card.addEventListener("mouseenter", () => setActive(i));
    card.addEventListener("click", () => {
      setActive(i);
      const plantId = card.dataset.plant;
      if (plantId && PLANT_PRESETS[plantId]) {
        activatePlant(plantId);
      }
      openPopupFromCard(card);
    });
  });

  if (popupClose) {
    popupClose.addEventListener("click", () => popup.classList.remove("show"));
  }
  if (popup) {
    popup.addEventListener("click", (e) => {
      if (e.target === popup) popup.classList.remove("show");
    });
  }

  window.setCarouselActiveByPlantId = function (plantId) {
    const idx = Array.from(cards).findIndex(c => c.dataset.plant === plantId);
    if (idx !== -1) {
      setActive(idx);
    }
  };

  const lastPlant = localStorage.getItem("information.js_activePlant");
  const initPlantId = (lastPlant && PLANT_PRESETS[lastPlant]) ? lastPlant : "content1";
  const initIndex = Array.from(cards).findIndex(c => c.dataset.plant === initPlantId);
  activeIndex = initIndex !== -1 ? initIndex : 0;
  updateCarousel();
});

