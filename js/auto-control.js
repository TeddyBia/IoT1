// js/auto-control.js
import {
  ref,
  onValue,
  update,
  set
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseGlobal = window.kc326e;
let db = null;
let auth = null;

if (firebaseGlobal) {
  db = firebaseGlobal.db;
  auth = firebaseGlobal.auth;
} else {
  console.warn("kc326e (firebase-core) chưa load trước auto-control.js");
}

if (db) {
  const wifiRef = ref(db, "Data/Wifi");
  onValue(wifiRef, () => {});
}

// ==== KEY DÙNG CHUNG ====
const GLOBAL_MODE_KEY = "nhom6_global_mode_v1";   // range / mist / schedule / none
const SCHEDULE_LS_KEY = "nhom6_mist_schedule_v1"; // lịch tưới local
const TODAY_KEY       = "nhom6_mist_today_reset";

// ==== BADGE ====
const scheduleConnBadge = document.getElementById("scheduleConnBadge");
const mistingConnBadge  = document.getElementById("mistingConnBadge");

let rtdbOnline = false;
let mistLoaded = false;

function setConnBadge(el, state) {
  if (!el) return;
  el.classList.remove("connected", "offline");
  const textEl = el.querySelector(".status-text");
  if (state === "connected") {
    el.classList.add("connected");
    if (textEl) textEl.textContent = "Connected";
  } else if (state === "offline") {
    el.classList.add("offline");
    if (textEl) textEl.textContent = "Offline";
  } else {
    if (textEl) textEl.textContent = "Connecting…";
  }
}
function refreshBadges() {
  if (rtdbOnline) {
    setConnBadge(scheduleConnBadge, "connected");
  } else {
    setConnBadge(scheduleConnBadge, "offline");
  }

  if (rtdbOnline && mistLoaded) {
    setConnBadge(mistingConnBadge, "connected");
  } else if (!rtdbOnline) {
    setConnBadge(mistingConnBadge, "offline");
  } else {
    setConnBadge(mistingConnBadge, "connecting");
  }
}
refreshBadges();

const infoConnRef = db ? ref(db, ".info/connected") : null;
if (infoConnRef) {
  onValue(infoConnRef, (snap) => {
    rtdbOnline = snap.val() === true;
    refreshBadges();
  });
}

// ===== DOM =====
const scheduleSwitch    = document.getElementById("scheduleSwitch");
const scheduleCountSel  = document.getElementById("scheduleCount");
const scheduleContainer = document.getElementById("scheduleContainer");
const defaultDurationEl = document.getElementById("defaultDuration");
const saveScheduleBtn   = document.getElementById("saveSchedule");
const scheduleTodayRuns = document.getElementById("scheduleTodayRuns");
const scheduleNextEl    = document.getElementById("scheduleNext");

const autoSwitch        = document.getElementById("autoMode");
const intervalInput     = document.getElementById("sprayInterval");
const durationInput     = document.getElementById("sprayDuration");
const updateMistingBtn  = document.getElementById("updateMisting");
const mistingStatus     = document.getElementById("mistingStatus");
const testBurstBtn      = document.getElementById("testBurst");
const nextRunDisplay    = document.getElementById("nextRun");
const countdownDisplay  = document.getElementById("countdown");

// ===== RTDB refs =====
const mistAutoRef = db ? ref(db, "Data/Actuator/MistingAuto") : null;
const mistCfgRef  = db ? ref(db, "Data/MistConfig") : null;
const dataAutoRef = db ? ref(db, "Data/Auto") : null;

// ===== TOAST =====
function showToast({
  title = "Notification",
  message = "",
  type = "success",
  duration = 3000
} = {}) {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  let iconHTML = "⚙️";
  if (type === "success") iconHTML = "✅";
  if (type === "error") iconHTML = "⚠️";
  toast.innerHTML = `
    <div class="toast-icon">${iconHTML}</div>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${message}</div>
    </div>
    <button class="toast-close" aria-label="Close">&times;</button>
  `;
  toast.querySelector(".toast-close").addEventListener("click", () => {
    toast.style.animation = "fadeOut .25s forwards";
    setTimeout(() => toast.remove(), 250);
  });
  container.appendChild(toast);
  setTimeout(() => {
    if (!toast.isConnected) return;
    toast.style.animation = "fadeOut .25s forwards";
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

function setScheduleCardEnabled(_enabled) {
  // no-op
}
function setMistingCardEnabled(_enabled) {
  // no-op
}

// ===== SCHEDULE UI =====
function createScheduleRows(count, current = []) {
  scheduleContainer.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const slot = current[i] || { time: "06:00", duration: Number(defaultDurationEl.value) || 10 };
    const row = document.createElement("div");
    row.className = "schedule-row";
    row.innerHTML = `
      <div>
        <label>Time #${i+1}</label><br>
        <input type="time" value="${slot.time}" class="sch-time">
      </div>
      <div>
        <label>Duration (s)</label><br>
        <input type="number" min="1" max="3600" value="${slot.duration}" class="sch-duration">
      </div>
    `;
    scheduleContainer.appendChild(row);
  }
}

// ===== LOCAL SCHEDULE =====
function saveScheduleToLocal(payload) {
  localStorage.setItem(SCHEDULE_LS_KEY, JSON.stringify(payload));
}
function loadScheduleFromLocal() {
  const raw = localStorage.getItem(SCHEDULE_LS_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

// default
let scheduleData = loadScheduleFromLocal() || {
  enabled: false,
  count: 3,
  defaultDuration: 10,
  slots: [
    { time: "06:00", duration: 10 },
    { time: "12:00", duration: 10 },
    { time: "18:00", duration: 10 },
  ],
  lastRunPerSlot: {}
};

scheduleSwitch.checked  = scheduleData.enabled;
scheduleCountSel.value  = scheduleData.count;
defaultDurationEl.value = scheduleData.defaultDuration;
createScheduleRows(scheduleData.count, scheduleData.slots);

// ===== GLOBAL MODE =====
function setGlobalMode(mode) {
  localStorage.setItem(GLOBAL_MODE_KEY, mode);
}
function getCurrentRangeFromLS() {
  const g = localStorage.getItem(GLOBAL_MODE_KEY);
  return g === "range";
}

// ===== TRUNG TÂM: PUSH 3 TRẠNG THÁI LÊN RTDB =====
function push3TogglesToRTDB({ rangeOn, autoOn, scheduleOn }) {
  // 1) /Data/Auto/Mode
  if (dataAutoRef) {
    update(dataAutoRef, { Mode: rangeOn });
  }

  // 2) /Data/MistConfig
  if (mistCfgRef) {
    update(mistCfgRef, {
      auto: autoOn,
      schedule: scheduleOn,
    });
  }

  // 3) /Data/Actuator/MistingAuto
  if (mistAutoRef) {
    set(mistAutoRef, autoOn ? true : false);
  }
}

// ===== AUTO MISTING (interval) =====
let mistConfig      = { auto: false, interval: 2, duration: 10, lastRun: 0 };
let mistTimer       = null;
let mistTimeout     = null;
let isMistingActive = false;
let applyingFromRTDB = false;
let currentMistingEnd = 0;

if (mistCfgRef) {
  onValue(mistCfgRef, (snap) => {
    const data = snap.val();
    if (!data) return;

    applyingFromRTDB = true;

    mistConfig = {
      auto: !!data.auto,
      interval: Number(data.interval) || 2,
      duration: Number(data.duration) || 10,
      lastRun: Number(data.lastRun) || 0,
    };

    mistLoaded = true;
    refreshBadges();

    autoSwitch.checked = mistConfig.auto;

    if (data.schedule === true) {
      scheduleSwitch.checked = true;
      scheduleData.enabled = true;
      saveScheduleToLocal(scheduleData);
      autoSwitch.checked = false;
    } else if (data.schedule === false) {
      if (!scheduleData.enabled) {
        scheduleSwitch.checked = false;
      }
    }

if (mistConfig.auto) {
  scheduleSwitch.checked = false;
  scheduleData.enabled = false;
  saveScheduleToLocal(scheduleData);

  if (db) update(ref(db, "Data/Auto"), { Mode: false });

  setGlobalMode("mist");

  if (!mistTimer) {
    startAutoMisting();
  }
} else {
  if (mistTimer || isMistingActive) {
    stopAutoMisting();
  }
  if (!scheduleSwitch.checked) setGlobalMode("none");
}
    applyingFromRTDB = false;
  });
}

// cập nhật trạng thái phun
if (mistAutoRef) {
  onValue(mistAutoRef, (snap) => {
    const val = snap.val();
    isMistingActive = !!val;
    mistingStatus.textContent = val ? "💧 Misting Auto: ON" : "Misting Auto: OFF";
    mistingStatus.style.color = val ? "#2e7d32" : "#b71c1c";
  });
}

// ===== PHUN =====
function triggerMisting(durationSec) {
  if (isMistingActive) return;

  let d = Number(durationSec);
  if (!Number.isFinite(d) || d <= 0) d = 5;

  isMistingActive = true;
  if (mistAutoRef) set(mistAutoRef, true);

  const endTime = Date.now() + d * 1000;
  currentMistingEnd = endTime;

  if (dataAutoRef) {
    update(dataAutoRef, {
      Misting: true,
      MistingUntil: endTime,
      ts: Date.now()
    });
  }

  clearTimeout(mistTimeout);
  mistTimeout = setTimeout(() => {
    if (mistAutoRef) set(mistAutoRef, false);
    isMistingActive = false;
    currentMistingEnd = 0;

    if (dataAutoRef) {
      update(dataAutoRef, {
        Misting: false,
        ts: Date.now()
      });
    }

    mistConfig.lastRun = Date.now();
    if (mistCfgRef) update(mistCfgRef, { lastRun: mistConfig.lastRun });
    updateNextRunDisplay();

  }, d * 1000);
}


function startAutoMisting() {
  stopAutoMisting();

  // lần đầu bật auto → bắt đầu đếm từ bây giờ
  if (!mistConfig.lastRun) {
    mistConfig.lastRun = Date.now();
    if (mistCfgRef) update(mistCfgRef, { lastRun: mistConfig.lastRun });
  }
  updateNextRunDisplay();

  mistTimer = setInterval(() => {
    const now = Date.now();
    const intervalSec = mistConfig.interval * 60;

    // ✅ ĐANG PHUN → CHỈ hiển thị thời gian còn lại của lần phun
    if (isMistingActive) {
      if (currentMistingEnd) {
        const remainSpray = Math.max(Math.floor((currentMistingEnd - now) / 1000), 0);
        countdownDisplay.innerHTML = `<strong>Spraying:</strong> ${remainSpray}s`;
      } else {
        countdownDisplay.innerHTML = `<strong>Spraying:</strong> ...`;
      }
      return; // ❗ Không tính countdown interval khi đang phun
    }

    // ✅ KHÔNG PHUN → đếm ngược thời gian nghỉ đến lần phun tiếp theo
    const elapsed = (now - mistConfig.lastRun) / 1000;  // lastRun = lúc PHUN XONG gần nhất
    const remaining = Math.max(intervalSec - elapsed, 0);
    countdownDisplay.innerHTML = `<strong>Countdown:</strong> ${Math.floor(remaining)}s`;

    if (elapsed >= intervalSec) {
      // tới giờ phun, lastRun sẽ được cập nhật khi phun xong ở triggerMisting()
      triggerMisting(mistConfig.duration);
    }
  }, 1000);
}


function stopAutoMisting() {
  if (mistTimer) {
    clearInterval(mistTimer);
    mistTimer = null;
  }
  if (mistTimeout) {
    clearTimeout(mistTimeout);
    mistTimeout = null;
  }
  isMistingActive = false;
  currentMistingEnd = 0;   // ✅ reset luôn

  if (mistAutoRef) set(mistAutoRef, false);

  nextRunDisplay.innerHTML = "<strong>Next run:</strong> —";
  countdownDisplay.innerHTML = "<strong>Countdown:</strong> —";
}
  
function updateNextRunDisplay() {
  const nextTime = new Date(mistConfig.lastRun + mistConfig.interval * 60 * 1000);
  nextRunDisplay.innerHTML = `<strong>Next run:</strong> ${nextTime.toLocaleTimeString()}`;
}

// ===== EVENT: AUTO TOGGLE =====
autoSwitch.addEventListener("change", () => {
  if (applyingFromRTDB) return;

  const ena = autoSwitch.checked;

  if (ena) {
    // bật auto → tắt schedule, tắt range
    scheduleSwitch.checked = false;
    scheduleData.enabled = false;
    saveScheduleToLocal(scheduleData);

    setGlobalMode("mist");

    // gửi đủ 3
    const state = {
      rangeOn: false,
      autoOn: true,
      scheduleOn: false
    };
    push3TogglesToRTDB(state);

    startAutoMisting();
  } else {
    // tắt auto → nếu schedule đang off luôn thì 3 off
    const scheduleOn = scheduleSwitch.checked;
    const state = {
      rangeOn: false,
      autoOn: false,
      scheduleOn: scheduleOn
    };
    push3TogglesToRTDB(state);

    stopAutoMisting();

    if (!scheduleOn) {
      setGlobalMode("none");
    } else {
      setGlobalMode("schedule");
    }
  }
});

// ===== EVENT: TEST BURST =====
testBurstBtn.addEventListener("click", () => {
  triggerMisting(10);
});

// ===== EVENT: UPDATE MISTING CONFIG =====
updateMistingBtn.addEventListener("click", () => {
  mistConfig.interval = Number(intervalInput.value);
  mistConfig.duration = Number(durationInput.value);
  if (mistCfgRef) {
    update(mistCfgRef, {
      interval: mistConfig.interval,
      duration: mistConfig.duration,
    });
  }
  showToast({
    title: "Misting saved",
    message: `Every ${mistConfig.interval} min • Spray ${mistConfig.duration}s`,
    type: "success",
  });
});

// ===== EVENT: SCHEDULE COUNT =====
scheduleCountSel.addEventListener("change", () => {
  const count = Number(scheduleCountSel.value);
  const current = readCurrentSlotsFromUI();
  scheduleData.count = count;
  createScheduleRows(count, current);
});

function readCurrentSlotsFromUI() {
  const rows = scheduleContainer.querySelectorAll(".schedule-row");
  const arr = [];
  rows.forEach((row) => {
    const timeEl = row.querySelector(".sch-time");
    const durEl  = row.querySelector(".sch-duration");
    arr.push({
      time: timeEl.value || "06:00",
      duration: Number(durEl.value) || Number(defaultDurationEl.value) || 10,
    });
  });
  return arr;
}

// ===== EVENT: SAVE SCHEDULE =====
saveScheduleBtn.addEventListener("click", () => {
  const slots = readCurrentSlotsFromUI();
  scheduleData.slots = slots;
  scheduleData.defaultDuration = Number(defaultDurationEl.value) || 10;
  scheduleData.enabled = scheduleSwitch.checked;
  saveScheduleToLocal(scheduleData);
  showToast({
    title: "Schedule saved",
    message: `${slots.length} slot(s) saved`,
    type: "success",
  });
  updateNextScheduleDisplay();
});

// ===== EVENT: SCHEDULE TOGGLE =====
scheduleSwitch.addEventListener("change", () => {
  if (applyingFromRTDB) return;

  const ena = scheduleSwitch.checked;
  scheduleData.enabled = ena;
  saveScheduleToLocal(scheduleData);

  if (ena) {
    // bật schedule → tắt auto, tắt range
    autoSwitch.checked = false;
    stopAutoMisting();

    setGlobalMode("schedule");

    const state = {
      rangeOn: false,
      autoOn: false,
      scheduleOn: true
    };
    push3TogglesToRTDB(state);
  } else {
    // tắt schedule → nếu auto cũng off → 3 off
    const autoOn = autoSwitch.checked;
    const state = {
      rangeOn: false,
      autoOn: autoOn,
      scheduleOn: false
    };
    push3TogglesToRTDB(state);

    if (!autoOn) {
      setGlobalMode("none");
    } else {
      setGlobalMode("mist");
    }
  }
});

// ====== SCHEDULE TIMER ======
setInterval(() => {
  if (!scheduleData.enabled) return;
  const now = new Date();
  const hh = now.getHours().toString().padStart(2, "0");
  const mm = now.getMinutes().toString().padStart(2, "0");
  const currentHM = `${hh}:${mm}`;

  const todayStr = now.toISOString().split("T")[0];
  const savedToday = localStorage.getItem(TODAY_KEY);
  if (savedToday !== todayStr) {
    scheduleData.lastRunPerSlot = {};
    localStorage.setItem(TODAY_KEY, todayStr);
    saveScheduleToLocal(scheduleData);
    scheduleTodayRuns.textContent = "—";
  }

  let ranToday = Object.keys(scheduleData.lastRunPerSlot || {}).length;
  scheduleTodayRuns.textContent = ranToday > 0 ? `${ranToday} slot(s)` : "—";

  scheduleData.slots.forEach((slot) => {
    if (slot.time === currentHM) {
      if (scheduleData.lastRunPerSlot[slot.time] !== todayStr) {
        triggerMisting(slot.duration);
        scheduleData.lastRunPerSlot[slot.time] = todayStr;
        saveScheduleToLocal(scheduleData);
        scheduleTodayRuns.textContent = Object.keys(scheduleData.lastRunPerSlot).length + " slot(s)";
      }
    }
  });

  updateNextScheduleDisplay();
}, 1000);

function updateNextScheduleDisplay() {
  if (!scheduleData.enabled) {
    scheduleNextEl.textContent = "—";
    return;
  }
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let nextSlot = null;
  scheduleData.slots.forEach((slot) => {
    const [h, m] = slot.time.split(":").map(Number);
    const slotMin = h * 60 + m;
    if (slotMin >= nowMin) {
      if (!nextSlot || slotMin < nextSlot.slotMin) {
        nextSlot = { ...slot, slotMin };
      }
    }
  });
  if (!nextSlot && scheduleData.slots.length > 0) {
    const first = scheduleData.slots[0];
    scheduleNextEl.textContent = first.time + " (tomorrow)";
  } else if (nextSlot) {
    scheduleNextEl.textContent = nextSlot.time;
  } else {
    scheduleNextEl.textContent = "—";
  }
}

// ===== DOMContentLoaded =====
window.addEventListener("DOMContentLoaded", () => {
  // ===== SUBTITLE (Plant + Ranges) =====
  function renderPlantSubtitle() {
    const el = document.querySelector(".subtitle");
    if (!el) return;

    const plantName = localStorage.getItem("information.js_plantName") || "Selected plant";
    const tmin = localStorage.getItem("information.js_tmin");
    const tmax = localStorage.getItem("information.js_tmax");
    const hmin = localStorage.getItem("information.js_hmin");
    const hmax = localStorage.getItem("information.js_hmax");

    const tempPart = (tmin !== null && tmax !== null) ? `${tmin}–${tmax}°C` : `--°C`;
    const humiPart = (hmin !== null && hmax !== null) ? `${hmin}–${hmax}%`  : `--%`;

    el.innerHTML = `
      Current Plant: <strong>${plantName}</strong><br>
      Temperature: ${tempPart} • Humidity: ${humiPart}
    `;
  }

  // ✅ GỌI NGAY SAU KHI DOM SẴN
  renderPlantSubtitle();

  // ✅ Cập nhật live khi tab khác đổi LocalStorage
  window.addEventListener("storage", (e) => {
    if (
      e.key === "information.js_activePlant" ||
      e.key === "information.js_tmin" ||
      e.key === "information.js_tmax" ||
      e.key === "information.js_hmin" ||
      e.key === "information.js_hmax" ||
      e.key === "information.js_plantName"
    ) {
      renderPlantSubtitle();
    }
  });

  // ===== phần mode có sẵn của bạn (giữ nguyên) =====
  const gMode = localStorage.getItem(GLOBAL_MODE_KEY);
  if (gMode === "range") {
    scheduleSwitch.checked = false;
    autoSwitch.checked     = false;
  } else if (gMode === "schedule") {
    scheduleSwitch.checked = true;
    autoSwitch.checked     = false;
  } else if (gMode === "mist") {
    scheduleSwitch.checked = false;
    autoSwitch.checked     = true;
  } else {
    // none
  }

  updateNextScheduleDisplay();

  window.addEventListener("storage", (e) => {
    if (e.key === GLOBAL_MODE_KEY) {
      const newMode = e.newValue;
      if (newMode === "range") {
        scheduleSwitch.checked = false;
        autoSwitch.checked     = false;
      } else if (newMode === "schedule") {
        scheduleSwitch.checked = true;
        autoSwitch.checked     = false;
      } else if (newMode === "mist") {
        scheduleSwitch.checked = false;
        autoSwitch.checked     = true;
      } else {
        scheduleSwitch.checked = false;
        autoSwitch.checked     = false;
      }
    }
  });
});