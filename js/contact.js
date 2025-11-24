// ================== IMPORT FIREBASE ==================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-app.js";
import { getDatabase, ref, update, onValue, set } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-database.js";

// ================== FIREBASE CONFIG ==================
const firebaseConfig = {
  apiKey: "AlzaSyDAPC5R3FZdiwmzO26T2gvVMUHO98CChdA",
  authDomain: "kc326e.firebaseapp.com",
  databaseURL: "https://kc326e-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kc326e",
  storageBucket: "kc326e.appspot.com",
  messagingSenderId: "1073378109515",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);


// =============== PID CONFIGURATION ====================

const pidRef = ref(db, "Data/PID");

const enaSwitch = document.getElementById("enaSwitch");
const kdInput = document.getElementById("kdInput");
const kiInput = document.getElementById("kiInput");
const kpInput = document.getElementById("kpInput");
const humiSlider = document.getElementById("humiSlider");
const tempSlider = document.getElementById("tempSlider");
const humiVal = document.getElementById("humiVal");
const tempVal = document.getElementById("tempVal");
const updatePIDBtn = document.getElementById("updatePID");

// Load PID từ Firebase
onValue(pidRef, (snap) => {
  const data = snap.val();
  if (!data) return;

  enaSwitch.checked = data.ena || false;
  kdInput.value = data.kd || 0;
  kiInput.value = data.ki || 0;
  kpInput.value = data.kp || 0;
  humiSlider.value = data.setHumi || 40;
  tempSlider.value = data.setTemp || 20;

  humiVal.textContent = data.setHumi;
  tempVal.textContent = data.setTemp;
});

// Gửi thay đổi PID
enaSwitch.addEventListener("change", () =>
  update(pidRef, { ena: enaSwitch.checked })
);

updatePIDBtn.addEventListener("click", () => {
  update(pidRef, {
    kd: Number(kdInput.value),
    ki: Number(kiInput.value),
    kp: Number(kpInput.value),
  });
  alert("✅ PID parameters updated!");
});

humiSlider.addEventListener("input", () => {
  humiVal.textContent = humiSlider.value;
  update(pidRef, { setHumi: Number(humiSlider.value) });
});
tempSlider.addEventListener("input", () => {
  tempVal.textContent = tempSlider.value;
  update(pidRef, { setTemp: Number(tempSlider.value) });
});

// =====================================================
// =============== MISTING AUTO CONTROL =================
// =====================================================
const mistAutoRef = ref(db, "Data/Actuator/MistingAuto");
const mistCfgRef = ref(db, "Data/MistConfig");

const autoSwitch = document.getElementById("autoMode");
const intervalInput = document.getElementById("sprayInterval");
const durationInput = document.getElementById("sprayDuration");
const updateMistingBtn = document.getElementById("updateMisting");
const mistingStatus = document.getElementById("mistingStatus");
const testBurstBtn = document.getElementById("testBurst");
const nextRunDisplay = document.getElementById("nextRun");
const countdownDisplay = document.getElementById("countdown");

let mistConfig = { auto: false, interval: 2, duration: 10, lastRun: 0 };
let mistTimer = null;
let mistTimeout = null;

// Lắng nghe config từ Firebase
onValue(mistCfgRef, (snap) => {
  const data = snap.val();
  if (!data) return;

  mistConfig = {
    auto: !!data.auto,
    interval: Number(data.interval) || 2,
    duration: Number(data.duration) || 10,
    lastRun: Number(data.lastRun) || 0,
  };

  autoSwitch.checked = mistConfig.auto;
  intervalInput.value = mistConfig.interval;
  durationInput.value = mistConfig.duration;

  if (mistConfig.auto) startAutoMisting();
  else stopAutoMisting();
});

// Lưu thay đổi interval & duration
updateMistingBtn.addEventListener("click", () => {
  mistConfig.interval = Number(intervalInput.value);
  mistConfig.duration = Number(durationInput.value);

  update(mistCfgRef, {
    interval: mistConfig.interval,
    duration: mistConfig.duration,
  });
  alert("✅ Misting configuration saved!");
});

// Bật/tắt auto mode
autoSwitch.addEventListener("change", () => {
  mistConfig.auto = autoSwitch.checked;
  update(mistCfgRef, { auto: mistConfig.auto });
  if (mistConfig.auto) startAutoMisting();
  else stopAutoMisting();
});

// Nút test phun thủ công 10s
testBurstBtn.addEventListener("click", () => {
  triggerMisting(10);
  console.log("💧 Test burst: 10s");
});

// Hiển thị trạng thái realtime
onValue(mistAutoRef, (snap) => {
  const val = snap.val();
  mistingStatus.textContent = val ? "💧 Misting Auto: ON" : "Misting Auto: OFF";
  mistingStatus.style.color = val ? "#2e7d32" : "#b71c1c";
});

// =====================================================
// =============== LOGIC HẸN GIỜ PHUN ===================
// =====================================================
let isMistingActive = false;

onValue(mistAutoRef, (snap) => {
  const val = snap.val();
  isMistingActive = !!val;
  mistingStatus.textContent = val ? "💧 Misting Auto: ON" : "Misting Auto: OFF";
  mistingStatus.style.color = val ? "#2e7d32" : "#b71c1c";
});

function startAutoMisting() {
  stopAutoMisting();
  console.log("✅ Auto misting ENABLED");

  // nếu chưa có lastRun thì tạo mới
  if (!mistConfig.lastRun) {
    mistConfig.lastRun = Date.now();
    update(mistCfgRef, { lastRun: mistConfig.lastRun });
  }

  updateNextRunDisplay();

  mistTimer = setInterval(() => {
    const now = Date.now();
    const elapsed = (now - mistConfig.lastRun) / 1000;
    const intervalSec = mistConfig.interval * 60;

    const remaining = Math.max(intervalSec - elapsed, 0);
    countdownDisplay.innerHTML = `<strong>Countdown:</strong> ${Math.floor(remaining)}s`;

    if (!isMistingActive && elapsed >= intervalSec) {
      console.log(`[AUTO] Trigger misting for ${mistConfig.duration}s`);
      triggerMisting(mistConfig.duration);
      mistConfig.lastRun = now;
      update(mistCfgRef, { lastRun: mistConfig.lastRun });
      updateNextRunDisplay();
    }
  }, 1000);
}

function stopAutoMisting() {
  console.log("⏹ Auto misting STOPPED");
  clearInterval(mistTimer);
  clearTimeout(mistTimeout);
  isMistingActive = false;
  set(mistAutoRef, false);
  nextRunDisplay.innerHTML = "<strong>Next run:</strong> —";
  countdownDisplay.innerHTML = "<strong>Countdown:</strong> —";
}

function triggerMisting(durationSec) {
  if (isMistingActive) {
    console.log("⚠️ Đang phun — bỏ qua trigger mới");
    return;
  }

  isMistingActive = true;
  set(mistAutoRef, true);
  console.log("💧 Auto Misting ON");

  // Ghi mốc thời gian kết thúc để đồng bộ nếu reload
  const endTime = Date.now() + durationSec * 1000;
  update(mistCfgRef, { endTime });

  clearTimeout(mistTimeout);
  mistTimeout = setTimeout(() => {
    set(mistAutoRef, false);
    isMistingActive = false;
    console.log("💧 Auto Misting OFF");
  }, durationSec * 1000);
}

function updateNextRunDisplay() {
  const nextTime = new Date(mistConfig.lastRun + mistConfig.interval * 60 * 1000);
  nextRunDisplay.innerHTML = `<strong>Next run:</strong> ${nextTime.toLocaleTimeString()}`;
}

// Khi reload, nếu đang trong khoảng phun → tự động bật lại timer tắt
onValue(mistCfgRef, (snap) => {
  const data = snap.val();
  if (!data) return;

  const endTime = data.endTime || 0;
  if (endTime && Date.now() < endTime) {
    const remaining = Math.floor((endTime - Date.now()) / 1000);
    console.log(`🔄 Đang trong chu kỳ phun, còn ${remaining}s`);
    triggerResume(remaining);
  }
});

// Hàm phục hồi nếu reload giữa lúc đang phun
function triggerResume(remainingSec) {
  set(mistAutoRef, true);
  isMistingActive = true;
  clearTimeout(mistTimeout);
  mistTimeout = setTimeout(() => {
    set(mistAutoRef, false);
    isMistingActive = false;
    console.log("💧 Resume OFF sau reload");
  }, remainingSec * 1000);
}

