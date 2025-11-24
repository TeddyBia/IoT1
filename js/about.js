// ===== Firebase setup =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AlzaSyDAPC5R3FZdiwmzO26T2gvVMUHO98CChdA",
  authDomain: "kc326e.firebaseapp.com",
  databaseURL: "https://kc326e-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kc326e",
  storageBucket: "kc326e.appspot.com",
  messagingSenderId: "1073378109515",
  appId: "1:1073378109515:web:xxxxxx",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const $ = (id) => document.getElementById(id);
const connEl = $("conn");

// hiển thị giá trị trên vòng slider 
const ctxTemp = $("tempChart"), ctxHum = $("humidityChart"), ctxLdr = $("ldrChart"), ctxAir = $("airChart");
const labels = [], tempData = [], humData = [], ldrData = [], airData = [];
const maxPoints = 288; // 288 điểm --> 24h nếu cập nhật mỗi 5 phút

function newChart(ctx, label, color, dataArr) {
  return new Chart(ctx, {
    type: "line",
    data: { labels, datasets: [{ label, data: dataArr, borderColor: color, borderWidth: 2, pointRadius: 0, fill: false, tension: 0.2 }] },
    options: { 
      responsive: true, 
      animation: false, 
      scales: {
        x: { ticks: { color: "#ccc" }, grid: { color: "rgba(255,255,255,0.1)" } },
        y: { ticks: { color: "#ccc" }, grid: { color: "rgba(255,255,255,0.1)" } },
      },
      plugins: { legend: { display: false } },
    }
  });
}

const tempChart = newChart(ctxTemp, "Temperature (°C)", "#ff9800", tempData);
const humChart = newChart(ctxHum, "Humidity (%)", "#03a9f4", humData);
const ldrChart = newChart(ctxLdr, "LDR (Light)", "#4caf50", ldrData);
const airChart = newChart(ctxAir, "Air Quality", "#e91e63", airData);

//  Doughnut charts 
function newCircleChart(ctx, color, maxValue) {
  return new Chart(ctx, {
    type: "doughnut",
    data: { datasets: [{ data: [0, maxValue], backgroundColor: [color, "rgba(255, 255, 255, 0.95)"], borderWidth: 0, cutout: "75%" }] },
    options: { plugins: { legend: { display: false }, tooltip: { enabled: false } }, animation: { duration: 0 } },
  });
}

const circleCharts = {
  Temperature: newCircleChart($("TemperatureChart"), "#ff9800", 50),
  Humminity: newCircleChart($("HumminityChart"), "#03a9f4", 100),
  LDR: newCircleChart($("LDRChart"), "#4caf50", 1023),
  AirQuality: newCircleChart($("AirQualityChart"), "#e91e63", 500),
  WaterLevel: newCircleChart($("WaterLevelChart"), "#00e676", 100),
};

//  Lưu & khôi phục dữ liệu 24h 
function saveChartData() {
  const history = {
    labels,
    tempData,
    humData,
    ldrData,
    airData,
    timestamp: Date.now()
  };
  localStorage.setItem("sensorHistory", JSON.stringify(history));
}

function loadChartData() {
  const saved = localStorage.getItem("sensorHistory");
  if (!saved) return console.log("ℹ️ Không có dữ liệu cũ để khôi phục.");

  try {
    const parsed = JSON.parse(saved);
    const ageHours = (Date.now() - parsed.timestamp) / 3600000;
    if (ageHours > 24) {
      console.log("⚠️ Dữ liệu quá 24h, xóa cache.");
      localStorage.removeItem("sensorHistory");
      return;
    }

    labels.push(...parsed.labels);
    tempData.push(...parsed.tempData);
    humData.push(...parsed.humData);
    ldrData.push(...parsed.ldrData);
    airData.push(...parsed.airData);

    tempChart.update(); humChart.update(); ldrChart.update(); airChart.update();
    console.log(" Đã khôi phục dữ liệu biểu đồ từ localStorage");
  } catch (err) {
    console.error("❌ Lỗi đọc dữ liệu:", err);
  }
}

// Cập nhật dữ liệu line chart 
function updateCharts(data) {
  const now = new Date();
  const timeLabel = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (labels.length >= maxPoints) {
    labels.shift(); tempData.shift(); humData.shift(); ldrData.shift(); airData.shift();
  }

  labels.push(timeLabel);
  tempData.push(data.Temperature ?? 0);
  humData.push(data.Humminity ?? 0);
  ldrData.push(data.LDR ?? 0);
  airData.push(data["Air Quality"] ?? 0);

  tempChart.update(); humChart.update(); ldrChart.update(); airChart.update();
  saveChartData();
}

// == Lắng nghe Firebase realtime ===
const sensorRef = ref(db, "Data/Sensor");
onValue(sensorRef, (snapshot) => {
  const data = snapshot.val();
  if (!data) {
    connEl.textContent = "❌ Không tìm thấy dữ liệu";
    connEl.style.color = "red";
    return;
  }

  connEl.textContent = "✅ Đã kết nối Firebase";
  connEl.style.color = "#4ade80";

  const sensors = {
    Temperature: { val: data.Temperature ?? 0, max: 50, unit: "°C" },
    Humminity: { val: data.Humminity ?? 0, max: 100, unit: "%" },
    LDR: { val: data.LDR ?? 0, max: 1023, unit: "" },
    AirQuality: { val: data["Air Quality"] ?? 0, max: 500, unit: "AQI" },
    WaterLevel: { val: data.WaterLevel ?? 0, max: 100, unit: "%" },
  };

  function getDynamicColor(ratio) {
  // ratio từ 0 → 1
  if (ratio < 0.4) return "#00e676";   // xanh lá
  if (ratio < 0.7) return "#ffeb3b";   // vàng
  return "#ff1744";                    // đỏ
}

for (const key in sensors) {
  const { val, max, unit } = sensors[key];
  const chart = circleCharts[key];
  const valEl = $(key + "Val");

  // Tính tỷ lệ giá trị hiện tại
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
