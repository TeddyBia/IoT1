// js/state.js
// ⚠️ file này chạy SAU firebase-core.js

import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// helper select
const $ = (id) => document.getElementById(id);
const connEl = $("conn");

// lấy firebase từ global
const fb = window.kc326e;
let db = null;
let auth = null;

if (fb && fb.db && fb.auth) {
  db = fb.db;
  auth = fb.auth;
} else {
  console.warn("⚠️ Firebase core chưa sẵn sàng. Kiểm tra thứ tự <script> trong HTML.");
}

// ===== KEY cũ giữ lại để khỏi hư tab khác =====
const STATE_LS_SETPOINT_KEY = "nhom6_autoControl_setpoints";

// 🆕 key bạn đang dùng để lưu preset cây
const LS_TMIN = "information.js_tmin";
const LS_TMAX = "information.js_tmax";
const LS_HMIN = "information.js_hmin";
const LS_HMAX = "information.js_hmax";

// biến để vẽ bound
let state_tmin = null;
let state_tmax = null;
let state_hmin = null;
let state_hmax = null;

// ===== CHART DATA =====
const ctxTemp = $("tempChart"),
      ctxHum  = $("humidityChart"),
      ctxLdr  = $("ldrChart"),
      ctxAir  = $("airChart");
const labels  = [],
      tempData = [],
      humData  = [],
      ldrData  = [],
      airData  = [];
const maxPoints = 288; // 24h nếu 5 phút 1 điểm

function makeProLegend() {
  return {
    display: true,
    position: "top",
    align: "end",
    labels: {
      color: "#ffffff",
      usePointStyle: true,
      pointStyle: "line",
      boxWidth: 10,
      boxHeight: 10,
      padding: 12,
      margin: 10,
      font: {
        size: 11,
        family: "'Poppins', sans-serif",
        weight: 400,
      },
    },
  };
}

// ===== đọc preset/bound từ localStorage =====
function loadBoundsFromLocalStorage_stateJS() {
  // ưu tiên đúng key của bạn
  const tmin = localStorage.getItem(LS_TMIN);
  const tmax = localStorage.getItem(LS_TMAX);
  const hmin = localStorage.getItem(LS_HMIN);
  const hmax = localStorage.getItem(LS_HMAX);

  if (tmin !== null) state_tmin = Number(tmin);
  if (tmax !== null) state_tmax = Number(tmax);
  if (hmin !== null) state_hmin = Number(hmin);
  if (hmax !== null) state_hmax = Number(hmax);

  // fallback: nếu trước đây auto-control có lưu SP cũ
  const raw = localStorage.getItem(STATE_LS_SETPOINT_KEY);
  if (
    raw &&
    (state_tmin == null || state_tmax == null || state_hmin == null || state_hmax == null)
  ) {
    try {
      const obj = JSON.parse(raw);
      if (state_tmin == null) state_tmin = Number(obj.setTemp);
      if (state_tmax == null) state_tmax = Number(obj.setTemp);
      if (state_hmin == null) state_hmin = Number(obj.setHumi);
      if (state_hmax == null) state_hmax = Number(obj.setHumi);
    } catch (err) {
      console.warn("Không parse được setpoint cũ:", err);
    }
  }
}
loadBoundsFromLocalStorage_stateJS();

// nếu tab khác đổi preset cây → update luôn
window.addEventListener("storage", (e) => {
  if (
    e.key === LS_TMIN ||
    e.key === LS_TMAX ||
    e.key === LS_HMIN ||
    e.key === LS_HMAX
  ) {
    loadBoundsFromLocalStorage_stateJS();
    updateBoundDatasets_stateJS();
  }

  if (e.key === STATE_LS_SETPOINT_KEY && e.newValue) {
    loadBoundsFromLocalStorage_stateJS();
    updateBoundDatasets_stateJS();
  }
});

// =========== HÀM TẠO CHART ============
function newChart(ctx, label, color, dataArr, yMin = 0, yMax = 100) {
  return new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label,
          data: dataArr,
          borderColor: color,
          backgroundColor: color + "33",
          borderWidth: 2,
          pointRadius: 0,
          fill: true,
          tension: 0.25,
        },
      ],
    },
    options: {
      responsive: true,
      animation: false,
      scales: {
        x: {
          ticks: { color: "#ccc" },
          grid: { color: "rgba(255,255,255,0.05)" },
        },
        y: {
          min: yMin,
          max: yMax,
          ticks: { color: "#ccc" },
          grid: { color: "rgba(255,255,255,0.06)" },
        },
      },
      plugins: {
        legend: { display: false },
      },
    },
  });
}

// 4 chart gốc
const tempChart = newChart(ctxTemp, "Temperature (°C)", "#ff9800", tempData, 0, 100);
const humChart  = newChart(ctxHum,  "Humidity (%)",    "#03a9f4", humData,  0, 100);
const ldrChart  = newChart(ctxLdr,  "LDR (Light)",     "#4caf50", ldrData,  0, 50);
const airChart  = newChart(ctxAir,  "Air Quality",     "#e91e63", airData,  0, 50);

// ====== DATASET BIÊN (2 đường) ======
function makeBoundDataset(label, color, value) {
  return {
    label,
    data: labels.map(() => value ?? 0),
    borderColor: color,
    borderWidth: 1.5,
    borderDash: [6, 4],
    pointRadius: 0,
    fill: false,
    tension: 0,
  };
}

// cập nhật / chèn 2 đường biên cho temp + hum
function updateBoundDatasets_stateJS() {
  // -------- NHIỆT ĐỘ (Tmin / Tmax) --------
  const dsTemp = tempChart.data.datasets;

  if (state_tmin != null) {
    const tminData = labels.map(() => state_tmin);
    if (dsTemp[1]) {
      dsTemp[1].data = tminData;
      dsTemp[1].label = "Tmin";
      dsTemp[1].borderColor = "#ffe082";
    } else {
      dsTemp.push(makeBoundDataset("Tmin", "#ffe082", state_tmin));
    }
  }

  if (state_tmax != null) {
    const tmaxData = labels.map(() => state_tmax);
    if (dsTemp[2]) {
      dsTemp[2].data = tmaxData;
      dsTemp[2].label = "Tmax";
      dsTemp[2].borderColor = "#ff5252"; // màu khác biệt
    } else {
      dsTemp.push(makeBoundDataset("Tmax", "#ff5252", state_tmax));
    }
  }

  if (state_tmin != null || state_tmax != null) {
    tempChart.options.plugins.legend = makeProLegend();
  }
  tempChart.update();

  // -------- ĐỘ ẨM (Hmin / Hmax) --------
  const dsHum = humChart.data.datasets;

  if (state_hmin != null) {
    const hminData = labels.map(() => state_hmin);
    if (dsHum[1]) {
      dsHum[1].data = hminData;
      dsHum[1].label = "Hmin";
      dsHum[1].borderColor = "#b2ff59";
    } else {
      dsHum.push(makeBoundDataset("Hmin", "#b2ff59", state_hmin));
    }
  }

  if (state_hmax != null) {
    const hmaxData = labels.map(() => state_hmax);
    if (dsHum[2]) {
      dsHum[2].data = hmaxData;
      dsHum[2].label = "Hmax";
      dsHum[2].borderColor = "#4caf50";
    } else {
      dsHum.push(makeBoundDataset("Hmax", "#4caf50", state_hmax));
    }
  }

  if (state_hmin != null || state_hmax != null) {
    humChart.options.plugins.legend = makeProLegend();
  }
  humChart.update();
}

// gọi 1 lần sau khi tạo chart
updateBoundDatasets_stateJS();


// ====== PHÓNG TO BIỂU ĐỒ ======
let currentZoom = {
  sourceId: null,
  sourceChart: null,
  overlay: null,
  overlayChart: null,
};

const chartMap = {
  tempChart: tempChart,
  humidityChart: humChart,
  ldrChart: ldrChart,
  airChart: airChart,
};

function openChartFullscreen(canvasId) {
  const srcChart = chartMap[canvasId];
  if (!srcChart) return;

  const overlay = document.createElement("div");
  overlay.className = "fullscreen-chart-overlay";

  const box = document.createElement("div");
  box.className = "chart-box";

  const bigCanvas = document.createElement("canvas");
  bigCanvas.id = "zoomed-" + canvasId;
  bigCanvas.style.flex = "1 1 auto";

  box.appendChild(bigCanvas);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  const clonedData = {
    labels: [...srcChart.data.labels],
    datasets: srcChart.data.datasets.map((ds) => ({
      ...ds,
      data: [...ds.data],
    })),
  };

  const clonedOptions = JSON.parse(JSON.stringify(srcChart.options || {}));
  clonedOptions.plugins = clonedOptions.plugins || {};
  clonedOptions.plugins.legend = { display: false };
  clonedOptions.responsive = true;
  clonedOptions.maintainAspectRatio = false;
  clonedOptions.animation = false;

  const overlayChart = new Chart(bigCanvas.getContext("2d"), {
    type: srcChart.config.type,
    data: clonedData,
    options: clonedOptions,
  });

  currentZoom = { sourceId: canvasId, sourceChart: srcChart, overlay, overlayChart };

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      overlayChart.destroy();
      overlay.remove();
      currentZoom = { sourceId: null, sourceChart: null, overlay: null, overlayChart: null };
    }
  });
}

Object.keys(chartMap).forEach((id) => {
  const el = document.getElementById(id);
  if (el) {
    el.style.cursor = "zoom-in";
    el.addEventListener("click", () => openChartFullscreen(id));
  }
});

// ====== Doughnut charts (giữ nguyên) ======
function newCircleChart(ctx, color, maxValue) {
  return new Chart(ctx, {
    type: "doughnut",
    data: {
      datasets: [
        {
          data: [0, maxValue],
          backgroundColor: [color, "rgba(255, 255, 255, 0.95)"],
          borderWidth: 0,
          cutout: "75%",
        },
      ],
    },
    options: {
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      animation: { duration: 0 },
    },
  });
}

const circleCharts = {
  Temperature: newCircleChart($("TemperatureChart"), "#ff9800", 100),
  Humminity:   newCircleChart($("HumminityChart"),  "#03a9f4", 100),
  LDR:         newCircleChart($("LDRChart"),        "#4caf50", 50),
  AirQuality:  newCircleChart($("AirQualityChart"), "#e91e63", 50),
  WaterLevel:  newCircleChart($("WaterLevelChart"), "#00e676", 20),
};

// ====== SAVE / LOAD 24h ======
function saveChartData() {
  const history = {
    labels,
    tempData,
    humData,
    ldrData,
    airData,
    timestamp: Date.now(),
  };
  localStorage.setItem("sensorHistory", JSON.stringify(history));
}

function loadChartData() {
  const saved = localStorage.getItem("sensorHistory");
  if (!saved) return;

  try {
    const parsed = JSON.parse(saved);
    const ageHours = (Date.now() - parsed.timestamp) / 3600000;
    if (ageHours > 24) {
      localStorage.removeItem("sensorHistory");
      return;
    }

    labels.push(...parsed.labels);
    tempData.push(...parsed.tempData);
    humData.push(...parsed.humData);
    ldrData.push(...parsed.ldrData);
    airData.push(...parsed.airData);

    tempChart.update();
    humChart.update();
    ldrChart.update();
    airChart.update();

    // kéo dài đường biên
    updateBoundDatasets_stateJS();
  } catch (err) {
    console.error("❌ Lỗi đọc dữ liệu:", err);
  }
}

// ====== TẠO 2 Ô CẢNH BÁO (gắn vào chart-card) ======
function ensureWarningBoxes() {
  // chart-card đầu tiên (Temperature)
  const tempCard = document.querySelector(".chart-card:nth-of-type(1)");
  if (tempCard && !tempCard.querySelector(".warn-temp")) {
    const w = document.createElement("div");
    w.className = "warn-temp";
    w.style.marginBottom = "6px";
    w.style.fontSize = "0.75rem";
    w.style.color = "#ff5252";
    w.style.fontWeight = "500";
    w.style.display = "none";
    tempCard.insertBefore(w, tempCard.querySelector("canvas"));
  }

  // chart-card thứ hai (Humidity)
  const humCard = document.querySelector(".chart-card:nth-of-type(2)");
  if (humCard && !humCard.querySelector(".warn-humi")) {
    const w = document.createElement("div");
    w.className = "warn-humi";
    w.style.marginBottom = "6px";
    w.style.fontSize = "0.75rem";
    w.style.color = "#ff5252";
    w.style.fontWeight = "500";
    w.style.display = "none";
    humCard.insertBefore(w, humCard.querySelector("canvas"));
  }
}
ensureWarningBoxes();

// ====== UPDATE LINE CHART + CẢNH BÁO ======
function updateCharts(data) {
  const now = new Date();
  const timeLabel = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (labels.length >= maxPoints) {
    labels.shift();
    tempData.shift();
    humData.shift();
    ldrData.shift();
    airData.shift();

    if (tempChart.data.datasets[1]) tempChart.data.datasets[1].data.shift();
    if (tempChart.data.datasets[2]) tempChart.data.datasets[2].data.shift();
    if (humChart.data.datasets[1]) humChart.data.datasets[1].data.shift();
    if (humChart.data.datasets[2]) humChart.data.datasets[2].data.shift();
  }

  const curTemp = data.Temperature ?? 0;
  const curHumi = data.Humminity ?? 0;

  labels.push(timeLabel);
  tempData.push(curTemp);
  humData.push(curHumi);
  ldrData.push(data.LDR ?? 0);
  airData.push(data["Air Quality"] ?? 0);

  // đẩy thêm điểm cho 4 đường biên (nếu có)
  if (tempChart.data.datasets[1] && state_tmin != null) {
    tempChart.data.datasets[1].data.push(state_tmin);
  }
  if (tempChart.data.datasets[2] && state_tmax != null) {
    tempChart.data.datasets[2].data.push(state_tmax);
  }
  if (humChart.data.datasets[1] && state_hmin != null) {
    humChart.data.datasets[1].data.push(state_hmin);
  }
  if (humChart.data.datasets[2] && state_hmax != null) {
    humChart.data.datasets[2].data.push(state_hmax);
  }

  tempChart.update();
  humChart.update();
  ldrChart.update();
  airChart.update();

  // ====== CẢNH BÁO NHIỆT ĐỘ / ĐỘ ẨM ======
  const tempWarnEl = document.querySelector(".warn-temp");
  if (tempWarnEl) {
    let msg = "";
    if (state_tmin != null && curTemp < state_tmin) {
      msg = `Temperature is below Tmin (${state_tmin}°C)`;
    } else if (state_tmax != null && curTemp > state_tmax) {
      msg = `Temperature is above Tmax (${state_tmax}°C)`;
    }
    if (msg) {
      tempWarnEl.textContent = msg;
      tempWarnEl.style.display = "block";
    } else {
      tempWarnEl.style.display = "none";
    }
  }

  const humWarnEl = document.querySelector(".warn-humi");
  if (humWarnEl) {
    let msg = "";
    if (state_hmin != null && curHumi < state_hmin) {
      msg = `Humidity is below Hmin (${state_hmin}%)`;
    } else if (state_hmax != null && curHumi > state_hmax) {
      msg = `Humidity is above Hmax (${state_hmax}%)`;
    }
    if (msg) {
      humWarnEl.textContent = msg;
      humWarnEl.style.display = "block";
    } else {
      humWarnEl.style.display = "none";
    }
  }

  // nếu đang phóng to cái nào thì sync
  if (currentZoom.overlayChart && currentZoom.sourceChart) {
    const src = currentZoom.sourceChart;
    const dst = currentZoom.overlayChart;

    dst.data.labels = [...src.data.labels];
    dst.data.datasets = src.data.datasets.map((ds) => ({
      ...ds,
      data: [...ds.data],
    }));

    if (src.options && src.options.scales) {
      dst.options.scales = JSON.parse(JSON.stringify(src.options.scales));
    }

    dst.update();
  }

  saveChartData();
}

// == Lắng nghe Firebase realtime ===
const sensorRef = ref(db, "Data/Sensor");
onValue(sensorRef, (snapshot) => {
  const data = snapshot.val();
  if (!data) {
    connEl.textContent = "❌ Data not found";
    connEl.style.color = "red";
    return;
  }

  connEl.textContent = "Connect Success to RTDB";
  connEl.style.color = "#4ade80";
  connEl.classList.add("online");

  const sensors = {
    Temperature: { val: data.Temperature ?? 0, max: 100, unit: "°C" },
    Humminity:   { val: data.Humminity ?? 0, max: 100, unit: "%" },
    LDR:         { val: data.LDR ?? 0, max: 50, unit: "LUX" },
    AirQuality:  { val: data["Air Quality"] ?? 0, max: 50, unit: "AQI" },
    WaterLevel:  { val: data.WaterLevel ?? 0, max: 20, unit: "CM" },
  };

  function getDynamicColor(ratio) {
    if (ratio < 0.4) return "#00e676";
    if (ratio < 0.7) return "#ffeb3b";
    return "#ff1744";
  }

  for (const key in sensors) {
    const { val, max, unit } = sensors[key];
    const chart = circleCharts[key];
    const valEl = $(key + "Val");

    const ratio = Math.min(val / max, 1);
    const color = getDynamicColor(ratio);

    if (chart) {
      chart.data.datasets[0].data = [val, Math.max(0, max - val)];
      chart.data.datasets[0].backgroundColor = [color, "rgba(255,255,255,0.1)"];
      chart.update();
    }

    if (valEl) valEl.textContent = `${val} ${unit}`;
  }

  updateCharts(data);
});

// === Khi trang load, khôi phục dữ liệu cũ ===
window.addEventListener("load", loadChartData);

// ====== SHOW ACTIVE PLANT (from localStorage) ======
function showActivePlantOnStatePage() {
  const nameEl  = document.getElementById("activePlantName");
  const rangeEl = document.getElementById("activePlantRanges");

  const plantName = localStorage.getItem("information.js_plantName");
  const tmin = localStorage.getItem(LS_TMIN);
  const tmax = localStorage.getItem(LS_TMAX);
  const hmin = localStorage.getItem(LS_HMIN);
  const hmax = localStorage.getItem(LS_HMAX);
  const plantId = localStorage.getItem("information.js_activePlant");

  if (nameEl) {
    if (plantName) {
      nameEl.textContent = plantName;
    } else if (plantId) {
      nameEl.textContent = plantId;
    } else {
      nameEl.textContent = "this plant";
    }
  }

  if (rangeEl) {
    if (tmin !== null && tmax !== null && hmin !== null && hmax !== null) {
      rangeEl.textContent = `(${tmin}–${tmax}°C, ${hmin}–${hmax}%)`;
    } else {
      rangeEl.textContent = "(--°C, --%)";
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  showActivePlantOnStatePage();

  window.addEventListener("storage", (e) => {
    if (
      e.key === "information.js_plantName" ||
      e.key === LS_TMIN ||
      e.key === LS_TMAX ||
      e.key === LS_HMIN ||
      e.key === LS_HMAX ||
      e.key === "information.js_activePlant"
    ) {
      showActivePlantOnStatePage();
    }
  });
});
