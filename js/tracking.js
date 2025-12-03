// 👉 vì firebase-core.js đã init rồi, ở đây KHÔNG initializeApp nữa
// chỉ import mấy hàm cần dùng
import {
  ref,
  onValue,
  update,
  set
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";


// lấy firebase đã dựng sẵn
const firebaseGlobal = window.kc326e;
let db = null;
let auth = null;

if (firebaseGlobal) {
  db = firebaseGlobal.db;
  auth = firebaseGlobal.auth;
} else {
  console.warn("kc326e (firebase-core) chưa load trước main.js");
}

// nếu bạn cần theo dõi wifi realtime
if (db) {
  const wifiRef = ref(db, "Data/Wifi");
  onValue(wifiRef, (snap) => {
    const wifiData = snap.val();
    // TODO: cập nhật UI wifi-floating ở đây
    // console.log("wifi:", wifiData);
  });
}
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
    console.log("✅ restored from localStorage");
  } catch (err) {
    console.error("❌ localStorage parse error:", err);
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
function updateValue(id, value) {
  if (!toggleState[id]) {
    console.log(`🚫 ${id.toUpperCase()} is OFF - skip push`);
    return;
  }

  let sendValue;
  if (id === "servo") {
    sendValue = Math.round(value);
  } else {
    sendValue = Math.round((value / 100) * 255);
  }

  const key = id.charAt(0).toUpperCase() + id.slice(1);
  update(actRef, { [key]: sendValue })
    .then(() => console.log(`✅ sent ${key}=${sendValue}`))
    .catch((err) => console.error("❌ Firebase update error:", err));

  saveLocalState();
}

// ===== SLIDER BACKGROUND =====
function updateSliderBackground(slider) {
  const value = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
  slider.style.background = `linear-gradient(90deg,#00b4ff 0%,#00ffcc ${value}%,rgba(0,0,0,0.35) ${value}%)`;
}

// ===== INIT EVENTS =====
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

// ===== FIREBASE REALTIME LISTENER (actuator) =====
onValue(actRef, (snapshot) => {
  const data = snapshot.val();
  if (data) {
    sliders.forEach((id) => {
      const key = id.charAt(0).toUpperCase() + id.slice(1);
      const rawValue = data[key] ?? 0;
      let displayValue;

      if (id === "servo") {
        displayValue = rawValue;
      } else {
        displayValue = Math.round((rawValue / 255) * 100);
      }

      const slider = document.getElementById(id + "Slider");
      const label = document.getElementById(id + "Value");
      slider.value = displayValue;
      label.textContent = displayValue;
      updateSliderBackground(slider);
    });
// helper đổi trạng thái pill
function setStatus(ok, el, okMsg, badMsg) {
  if (!el) return;
  // xóa hết class trạng thái cũ
  el.classList.remove("waiting", "ok", "error", "offline", "online");
  el.innerHTML = `<span class="dot"></span>${ok ? okMsg : badMsg}`;
  if (ok) {
    el.classList.add("ok");
  } else {
    el.classList.add("error");
  }
}
// đầu file sau khi getElement...
statusEl.classList.add("waiting");
statusEl.innerHTML = `<span class="dot"></span>Connecting`;

detectStatus.classList.add("waiting");
detectStatus.innerHTML = `<span class="dot"></span>Waiting for detection data…`;

// ===== FIREBASE REALTIME LISTENER (actuator) =====
onValue(actRef, (snapshot) => {
  const data = snapshot.val();
  if (data) {
    sliders.forEach((id) => {
      const key = id.charAt(0).toUpperCase() + id.slice(1);
      const rawValue = data[key] ?? 0;
      let displayValue;

      if (id === "servo") {
        displayValue = rawValue;
      } else {
        displayValue = Math.round((rawValue / 255) * 100);
      }

      const slider = document.getElementById(id + "Slider");
      const label = document.getElementById(id + "Value");
      slider.value = displayValue;
      label.textContent = displayValue;
      updateSliderBackground(slider);
    });

    // ✅ nhìn giống hình bạn gửi
    setStatus(true, statusEl, "Connected", "Connecting");
  } else {
    setStatus(false, statusEl, "Connected", "⚠️ 'Data/Actuator' not found");
  }
});

  } else {
    statusEl.textContent = "⚠️ 'Data/Actuator' not found";
    statusEl.classList.remove("status-ok");
    statusEl.classList.add("status-warning");
  }
});

// ===== MISTING CONTROL =====
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
  console.log(`💧 Misting: ${isOn ? "ON" : "OFF"}`);
}
mistOnBtn.addEventListener("click", () => setMistingState(true));
mistOffBtn.addEventListener("click", () => setMistingState(false));

// ===== CAMERA IMAGE FEED =====
const frameRef = ref(db, "rasp/frame");
const imgEl = document.getElementById("cameraFrame");
const frameStatus = document.getElementById("frameStatus");
const cameraStatus = document.getElementById("cameraStatus");

let lastFrameTs = 0;
const MAX_STALE_MS = 20000; // 2s

function setCameraOnline(isOnline) {
  cameraStatus.classList.toggle("online", isOnline);
  cameraStatus.classList.toggle("offline", !isOnline);
  cameraStatus.innerHTML = isOnline
    ? '<span class="dot"></span>Online'
    : '<span class="dot"></span>Offline';
  frameStatus.textContent = isOnline ? "Live frame received." : "Waiting for frame…";
}

onValue(frameRef, (snapshot) => {
  const now = performance.now();
  const data = snapshot.val();

  if (!data) {
    setCameraOnline(false);
    imgEl.classList.remove("loaded");
    return;
  }

  // nhận được frame mới
  lastFrameTs = now;

  let b64 = typeof data === "object" && data.frame ? data.frame : data;
  if (!b64.startsWith("data:image")) {
    b64 = "data:image/jpeg;base64," + b64;
  }

  imgEl.classList.remove("loaded");
  imgEl.src = b64;
  imgEl.onload = () => {
    imgEl.classList.add("loaded");
  };

  setCameraOnline(true);
});

// timer check: nếu quá 2s ko có frame mới sẽ chuyển offline
setInterval(() => {
  const now = performance.now();
  if (now - lastFrameTs > MAX_STALE_MS) {
    setCameraOnline(false);
    imgEl.classList.remove("loaded");
  }
}, 500);

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
    setStatus(false, detectStatus, "Detection data received", "Waiting for detection data…");
    Object.values(detectEls).forEach((el) => (el.textContent = "--"));
    return;
  }

  for (let i = 1; i <= 4; i++) {
    detectEls[i].textContent = data[i] ?? "--";
  }

  // giống hình “connect success …” nhưng là bên detect
  setStatus(true, detectStatus, "Detection data received", "Waiting for detection data…");
});

// ===== PHÓNG TO ẢNH KHI CLICK =====
document.addEventListener("DOMContentLoaded", () => {
  const frame = document.getElementById("cameraFrame");

  if (frame) {
    frame.style.cursor = "zoom-in";

    frame.addEventListener("click", () => {
      // tạo overlay
      const overlay = document.createElement("div");
      overlay.classList.add("fullscreen-overlay");

      // ảnh phóng to
      const img = document.createElement("img");
      img.src = frame.src;
      overlay.appendChild(img);

      // gắn vào body
      document.body.appendChild(overlay);

      // --- 🔁 theo dõi frame gốc để cập nhật realtime ---
      const observer = new MutationObserver((mutations) => {
        // mỗi lần #cameraFrame đổi src -> cập nhật ảnh phóng to
        img.src = frame.src;
      });
      observer.observe(frame, {
        attributes: true,
        attributeFilter: ["src"],
      });

      // click overlay để thoát
      overlay.addEventListener("click", () => {
        observer.disconnect();   // 🧹 dọn observer để không leak
        overlay.remove();
      });
    });
  }
});


