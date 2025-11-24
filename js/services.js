// ===== Firebase setup =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// ===== CONFIG =====
const firebaseConfig = {
  apiKey: "AlzaSyDAPC5R3FZdiwmzO26T2gvVMUHO98CChdA",
  authDomain: "kc326e.firebaseapp.com",
  databaseURL: "https://kc326e-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kc326e",
  storageBucket: "kc326e.appspot.com",
  messagingSenderId: "1073378109515",
  appId: "1:1073378109515:web:xxxxxx",
};

// ===== Initialize Firebase =====
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const actRef = ref(db, "Data/Actuator");

// ===== DOM elements =====
const statusEl = document.getElementById("status");
const sliders = ["fan", "led", "pump", "servo"];

const toggleState = { fan: false, led: false, pump: false, servo: false };

// ===== LOCAL STORAGE SAVE & LOAD =====
function saveLocalState() {
  const state = { toggleState, sliderValues: {} };
  sliders.forEach((id) => {
    const slider = document.getElementById(id + "Slider");
    state.sliderValues[id] = parseInt(slider.value);
  });
  localStorage.setItem("deviceState", JSON.stringify(state));
}

function loadLocalState() {
  const saved = localStorage.getItem("deviceState");
  if (!saved) return;
  try {
    const state = JSON.parse(saved);
    Object.assign(toggleState, state.toggleState);

    sliders.forEach((id) => {
      const btn = document.getElementById(id + "Toggle");
      const slider = document.getElementById(id + "Slider");
      const input = document.getElementById(id + "Input");
      const label = document.getElementById(id + "Value");
      const value = state.sliderValues[id] ?? 0;

      slider.value = value;
      input.value = value;
      label.textContent = value;
      updateSliderBackground(slider);

      const active = toggleState[id];
      btn.classList.toggle("on", active);
      btn.classList.toggle("off", !active);
      btn.textContent = `${active ? "Enabled" : "Disabled"} ${id.toUpperCase()}`;
      slider.disabled = !active;
      input.disabled = !active;
      slider.classList.toggle("disabled", !active);
      input.classList.toggle("disabled", !active);
    });
    console.log("✅ Đã khôi phục trạng thái từ localStorage");
  } catch (err) {
    console.error("❌ Lỗi đọc localStorage:", err);
  }
}

// ===== TOGGLE BUTTON FUNCTION =====
function toggleButton(id) {
  const btn = document.getElementById(id + "Toggle");
  const slider = document.getElementById(id + "Slider");
  const input = document.getElementById(id + "Input");

  toggleState[id] = !toggleState[id];
  const active = toggleState[id];

  btn.classList.toggle("on", active);
  btn.classList.toggle("off", !active);
  btn.textContent = `${active ? "Enabled" : "Disabled"} ${id.toUpperCase()}`;
  slider.disabled = !active;
  input.disabled = !active;
  slider.classList.toggle("disabled", !active);
  input.classList.toggle("disabled", !active);

  saveLocalState();
}

// ===== UPDATE VALUE TO FIREBASE =====
// Fan/Led/Pump: 0–100 → 0–255
// Servo: 0–180 → 0–180 (giữ nguyên)
function updateValue(id, value) {
  if (!toggleState[id]) {
    console.log(`🚫 ${id.toUpperCase()} đang TẮT - không gửi dữ liệu`);
    return;
  }

  let sendValue;
  if (id === "servo") {
    sendValue = Math.round(value); // servo: giữ nguyên 0–180
  } else {
    sendValue = Math.round((value / 100) * 255); // fan, led, pump: quy đổi PWM
  }

  const key = id.charAt(0).toUpperCase() + id.slice(1);
  update(actRef, { [key]: sendValue })
    .then(() =>
      console.log(
        `✅ Gửi ${key} = ${sendValue} ${
          id === "servo" ? "°" : `(từ ${value}%)`
        }`
      )
    )
    .catch((err) => console.error("❌ Lỗi gửi Firebase:", err));

  saveLocalState();
}

// ===== SLIDER BACKGROUND =====
function updateSliderBackground(slider) {
  const value = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
  slider.style.background = `linear-gradient(90deg,#00b4ff 0%,#00ffcc ${value}%,#000 ${value}%)`;
}

// ===== SLIDER + INPUT EVENTS =====
sliders.forEach((id) => {
  const slider = document.getElementById(id + "Slider");
  const label = document.getElementById(id + "Value");
  const toggleBtn = document.getElementById(id + "Toggle");
  const input = document.getElementById(id + "Input");

  slider.addEventListener("input", (e) => {
    const val = parseInt(e.target.value);
    label.textContent = val;
    input.value = val;
    updateSliderBackground(slider);
    updateValue(id, val);
  });

  input.addEventListener("input", (e) => {
    let val = parseInt(e.target.value);
    if (isNaN(val)) val = 0;
    val = Math.max(parseInt(slider.min), Math.min(val, parseInt(slider.max)));
    slider.value = val;
    label.textContent = val;
    updateSliderBackground(slider);
    updateValue(id, val);
  });

  toggleBtn.addEventListener("click", () => toggleButton(id));
  updateSliderBackground(slider);
});

window.addEventListener("DOMContentLoaded", loadLocalState);

// ===== FIREBASE REALTIME LISTENER =====
onValue(actRef, (snapshot) => {
  const data = snapshot.val();
  if (data) {
    sliders.forEach((id) => {
      const key = id.charAt(0).toUpperCase() + id.slice(1);
      const rawValue = data[key] ?? 0;
      let displayValue;

      if (id === "servo") {
        displayValue = rawValue; // servo: 0–180
      } else {
        displayValue = Math.round((rawValue / 255) * 100); // 0–255 → %
      }

      const slider = document.getElementById(id + "Slider");
      const label = document.getElementById(id + "Value");
      slider.value = displayValue;
      label.textContent = displayValue;
      updateSliderBackground(slider);
    });
    statusEl.textContent = "✅ Đã kết nối Firebase";
    statusEl.style.color = "#00e676";
  } else {
    statusEl.textContent = "⚠️ Không tìm thấy Data/Actuator";
    statusEl.style.color = "orange";
  }
});

// ===== MISTING CONTROL (true / false) =====
const mistOnBtn = document.getElementById("mistingOn");
const mistOffBtn = document.getElementById("mistingOff");
let mistingState = false;

function setMistingState(isOn) {
  mistingState = isOn;
  mistOnBtn.classList.toggle("on", isOn);
  mistOnBtn.classList.toggle("off", !isOn);
  mistOffBtn.classList.toggle("on", !isOn);
  mistOffBtn.classList.toggle("off", isOn);
  update(ref(db, "Data/Actuator"), { Misting: isOn });
  console.log(`💧 Phun sương: ${isOn ? "True" : "False"}`);
}
mistOnBtn.addEventListener("click", () => setMistingState(true));
mistOffBtn.addEventListener("click", () => setMistingState(false));

// ===== CAMERA IMAGE FEED =====
const frameRef = ref(db, "rasp/frame");
const imgEl = document.getElementById("cameraFrame");
const frameStatus = document.getElementById("frameStatus");
let lastUpdate = 0;
const MIN_INTERVAL_MS = 200;

onValue(frameRef, (snapshot) => {
  const now = performance.now();
  if (now - lastUpdate < MIN_INTERVAL_MS) return;
  lastUpdate = now;

  const data = snapshot.val();
  if (!data) {
    frameStatus.textContent = "⚠️ Không có dữ liệu hình ảnh!";
    frameStatus.style.color = "orange";
    imgEl.style.opacity = 0;
    return;
  }

  let b64 = typeof data === "object" && data.frame ? data.frame : data;
  if (!b64.startsWith("data:image"))
    b64 = "data:image/jpeg;base64," + b64;

  imgEl.style.opacity = 0;
  imgEl.src = b64;
  imgEl.onload = () => (imgEl.style.opacity = 1);

  frameStatus.textContent = "✅ Hình ảnh cập nhật từ rasp/frame";
  frameStatus.style.color = "#00e676";
});

// ===== FIREBASE REALTIME: rasp/detect =====
const detectRef = ref(db, "rasp/detect");
const detectStatus = document.getElementById("detectStatus");
const detectEls = {
  1: document.getElementById("detect1"),
  2: document.getElementById("detect2"),
  3: document.getElementById("detect3"),
  4: document.getElementById("detect4"),
};

onValue(detectRef, (snapshot) => {
  const data = snapshot.val();
  if (!data) {
    detectStatus.textContent = "⚠️ Không có dữ liệu từ rasp/detect";
    detectStatus.style.color = "orange";
    Object.values(detectEls).forEach((el) => (el.textContent = "--"));
    return;
  }
  for (let i = 1; i <= 4; i++) detectEls[i].textContent = data[i] ?? "--";
  detectStatus.textContent = "✅ Đã nhận dữ liệu";
  detectStatus.style.color = "#00e676";
});
