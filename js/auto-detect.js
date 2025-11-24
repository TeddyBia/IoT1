// js/auto-detect.js
import {
  ref,
  onValue,
  update,
  set
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// --- lấy firebase core ---
const firebaseGlobal = window.kc326e;
let db = null;
let auth = null;

if (firebaseGlobal) {
  db = firebaseGlobal.db;
  auth = firebaseGlobal.auth;
} else {
  console.warn("kc326e (firebase-core) chưa load trước auto-detect.js");
}

// theo dõi wifi (optional)
if (db) {
  const wifiRef = ref(db, "Data/Wifi");
  onValue(wifiRef, () => {});
}

// ==== KEY dùng chung ====
const GLOBAL_MODE_KEY   = "nhom6_global_mode_v1";
const SCHEDULE_LS_KEY   = "nhom6_mist_schedule_v1";
const TODAY_KEY         = "nhom6_mist_today_reset";

// ==== RTDB refs ====
const dataAutoRef  = db ? ref(db, "Data/Auto") : null;
const mistCfgRef   = db ? ref(db, "Data/MistConfig") : null;
const mistActRef   = db ? ref(db, "Data/Actuator/MistingAuto") : null;
const pidRef       = db ? ref(db, "Data/PID") : null;

// ===== DOM gốc (phần auto-range) =====
const Tmin = document.getElementById("Tsetmin");
const Tmax = document.getElementById("Tsetmax");
const Mmin = document.getElementById("Msetmin");
const Mmax = document.getElementById("Msetmax");

const TminInput = document.getElementById("TminInput");
const TmaxInput = document.getElementById("TmaxInput");
const MminInput = document.getElementById("MminInput");
const MmaxInput = document.getElementById("MmaxInput");

const Tnow = document.getElementById("Tnow");
const Mnow = document.getElementById("Mnow");

const LedA = document.getElementById("LedA");
const FanA = document.getElementById("FanA");
const MistingA = document.getElementById("MistingA");
const ServoA = document.getElementById("ServoA");

// === 3 TOGGLE (có thể không có hết) ===
const rangeModeSwitch = document.getElementById("rangeModeSwitch"); // bên auto-detect
const autoModeSwitch  = document.getElementById("autoMode");        // bên auto-control
const scheduleSwitch  = document.getElementById("scheduleSwitch");  // bên auto-control

// UI khác
const leftPanel = document.querySelector(".left-panel");
const connPills = document.querySelectorAll(".conn-pill");
const subtitleNameEl  = document.getElementById("activePlantName");
const subtitleRangeEl = document.getElementById("activePlantRanges");

// ===== STATE =====
let setpointsLoaded = false;
let sensorCache = null;
let applyingFromFirebase = false;
let rtdbOnline = false;
let authed = false;

/* ======================= Helpers chung ======================= */
function setGlobalMode(mode) {
  localStorage.setItem(GLOBAL_MODE_KEY, mode);
}

function setRangeEnabled(enabled) {
  if (!leftPanel) return;
  leftPanel.classList.toggle("range-disabled", !enabled);
}

function refreshConnPills() {
  const ok = rtdbOnline && authed;
  connPills.forEach((pill) => {
    const txt = pill.querySelector(".text");
    const dot = pill.querySelector(".dot");
    if (ok) {
      pill.classList.add("connected");
      if (txt) txt.textContent = "Connected";
      if (dot) dot.setAttribute("data-status", "on");
    } else {
      pill.classList.remove("connected");
      if (txt) txt.textContent = "Connecting…";
      if (dot) dot.setAttribute("data-status", "off");
    }
  });
}

function fillColor(minSlider, maxSlider, track) {
  if (!track || !minSlider || !maxSlider) return;
  const min = parseFloat(minSlider.value);
  const max = parseFloat(maxSlider.value);
  const maxRange = parseFloat(minSlider.max);

  const minPct = (min / maxRange) * 100;
  const maxPct = (max / maxRange) * 100;

  track.style.background = `linear-gradient(to right,
    rgba(18, 18, 18, 0.55) 0%,
    rgba(18, 18, 18, 0.55) ${minPct}%,
    #00e5ff ${minPct}%,
    #00e5ff ${maxPct}%,
    rgba(18, 18, 18, 0.55) ${maxPct}%,
    rgba(18, 18, 18, 0.55) 100%)`;
}

function clamp(v, mn, mx) {
  return Math.min(Math.max(v, mn), mx);
}

/* ======================= Per-plant overrides ======================= */
const OVERRIDE_PREFIX = "autodetect.userSetpoints.";

function getActivePlantId() {
  return localStorage.getItem("information.js_activePlant") || "default";
}

function getUserOverride(plantId) {
  // try {
  //   const raw = localStorage.getItem(OVERRIDE_PREFIX + plantId);
  //   if (!raw) return null;
  //   const obj = JSON.parse(raw);
  //   if (obj && Number.isFinite(obj.tmin) && Number.isFinite(obj.tmax)
  //       && Number.isFinite(obj.hmin) && Number.isFinite(obj.hmax)) {
  //     return obj;
  //   }
    return null;
  // } catch { return null; }
}

function saveUserOverride(plantId, { tmin, tmax, hmin, hmax }) {
  const payload = { tmin: +tmin, tmax: +tmax, hmin: +hmin, hmax: +hmax, ts: Date.now() };
  localStorage.setItem(OVERRIDE_PREFIX + plantId, JSON.stringify(payload));
}

function getPresetFromInformation() {
  const tmin = Number(localStorage.getItem("information.js_tmin"));
  const tmax = Number(localStorage.getItem("information.js_tmax"));
  const hmin = Number(localStorage.getItem("information.js_hmin"));
  const hmax = Number(localStorage.getItem("information.js_hmax"));
  if ([tmin, tmax, hmin, hmax].every(Number.isFinite)) {
    return { tmin, tmax, hmin, hmax };
  }
  return null;
}

function applySetpointsToUIAndRTDB({ tmin, tmax, hmin, hmax }) {
  applyingFromFirebase = true;
  if (Tmin) Tmin.value = tmin;
  if (Tmax) Tmax.value = tmax;
  if (Mmin) Mmin.value = hmin;
  if (Mmax) Mmax.value = hmax;
  if (TminInput) TminInput.value = tmin;
  if (TmaxInput) TmaxInput.value = tmax;
  if (MminInput) MminInput.value = hmin;
  if (MmaxInput) MmaxInput.value = hmax;
  applyingFromFirebase = false;

  fillColor(Tmin, Tmax, Tmin?.closest(".slider")?.querySelector(".slider-track"));
  fillColor(Mmin, Mmax, Mmin?.closest(".slider")?.querySelector(".slider-track"));

  if (db) {
    update(ref(db, "Data/Auto"), {
      Tsetmin: +tmin,
      Tsetmax: +tmax,
      Msetmin: +hmin,
      Msetmax: +hmax,
      PlantName: getActivePlantId() || "unknown"
    });
  }
}

/** Nạp setpoint ưu tiên: override theo cây -> nếu không có thì preset theo cây (information.js_*) */
function loadSetpointsForActivePlant() {
  const plantId = getActivePlantId();
  const ov = getUserOverride(plantId);
  const base = ov ?? getPresetFromInformation();
  if (base) {
    applySetpointsToUIAndRTDB(base);
    setpointsLoaded = true;
  }
}

/* ======================= Plant header ======================= */
function applyPlantHeaderFromLocalStorage() {
  const plantName = localStorage.getItem("information.js_plantName");
  const tminLS    = localStorage.getItem("information.js_tmin");
  const tmaxLS    = localStorage.getItem("information.js_tmax");
  const hminLS    = localStorage.getItem("information.js_hmin");
  const hmaxLS    = localStorage.getItem("information.js_hmax");

  if (subtitleNameEl) {
    subtitleNameEl.textContent = plantName || "this plant";
  }

  if (subtitleRangeEl) {
    if (tminLS !== null && tmaxLS !== null && hminLS !== null && hmaxLS !== null) {
      subtitleRangeEl.textContent = `(${tminLS}–${tmaxLS}°C, ${hminLS}–${hmaxLS}%)`;
    } else {
      subtitleRangeEl.textContent = "( --°C, --% )";
    }
  }
}

/* ======================= PUSH 3 trạng thái ======================= */
function push3TogglesToRTDB({ rangeOn, autoOn, scheduleOn }) {
  // /Data/Auto/Mode
  if (dataAutoRef) {
    update(dataAutoRef, {
      Mode: rangeOn
    });
  }

  // /Data/MistConfig/auto , /Data/MistConfig/schedule
  if (mistCfgRef) {
    update(mistCfgRef, {
      auto: autoOn,
      schedule: scheduleOn
    });
  }

  // actuator
  if (mistActRef) {
    // auto thì bật, còn lại tắt
    set(mistActRef, !!autoOn);
  }

  // nếu range bật thì tắt PID
  if (rangeOn && pidRef) {
    update(pidRef, { ena: false });
  }
}

/* ======================= Đọc DOM thành state ======================= */
function getCurrentToggleStateFromDOM() {
  return {
    rangeOn: !!(rangeModeSwitch && rangeModeSwitch.checked),
    autoOn: !!(autoModeSwitch && autoModeSwitch.checked),
    scheduleOn: !!(scheduleSwitch && scheduleSwitch.checked),
  };
}

/* ======================= Apply state lên DOM + local ======================= */
function applyToggleStateToDOM({ rangeOn, autoOn, scheduleOn }) {
  if (rangeModeSwitch) rangeModeSwitch.checked = rangeOn;
  if (autoModeSwitch)  autoModeSwitch.checked  = autoOn;
  if (scheduleSwitch)  scheduleSwitch.checked  = scheduleOn;

  setRangeEnabled(rangeOn);

  if (rangeOn) {
    setGlobalMode("range");
  } else if (autoOn) {
    setGlobalMode("mist");
  } else if (scheduleOn) {
    setGlobalMode("schedule");
  } else {
    setGlobalMode("none");
  }

  // nếu schedule ON thì set enabled trong local schedule
  if (scheduleOn) {
    const raw = localStorage.getItem(SCHEDULE_LS_KEY);
    let sch = { enabled: true };
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        parsed.enabled = true;
        sch = parsed;
      } catch (e) {}
    }
    localStorage.setItem(SCHEDULE_LS_KEY, JSON.stringify(sch));
  }
}

/* ======================= Setpoint ======================= */
function updateSetpoints() {
  if (applyingFromFirebase) return;

  let tmin = +Tmin.value,
      tmax = +Tmax.value,
      mmin = +Mmin.value,
      mmax = +Mmax.value;

  if (tmin >= tmax - 1) { tmin = tmax - 1; Tmin.value = tmin; }
  if (tmax <= tmin + 1) { tmax = tmin + 1; Tmax.value = tmax; }
  if (mmin >= mmax - 1) { mmin = mmax - 1; Mmin.value = mmin; }
  if (mmax <= mmin + 1) { mmax = mmin + 1; Mmax.value = mmax; }

  if (TminInput) TminInput.value = tmin;
  if (TmaxInput) TmaxInput.value = tmax;
  if (MminInput) MminInput.value = mmin;
  if (MmaxInput) MmaxInput.value = mmax;

  fillColor(Tmin, Tmax, Tmin.closest(".slider").querySelector(".slider-track"));
  fillColor(Mmin, Mmax, Mmin.closest(".slider").querySelector(".slider-track"));

  if (db) {
    update(ref(db, "Data/Auto"), {
      Tsetmin: tmin,
      Tsetmax: tmax,
      Msetmin: mmin,
      Msetmax: mmax
    });
  }

  const plantId = getActivePlantId();
  saveUserOverride(plantId, { tmin, tmax, hmin: mmin, hmax: mmax });

  if (setpointsLoaded && sensorCache) {
    runAuto(sensorCache.T, sensorCache.M);
  }
}

[Tmin, Tmax, Mmin, Mmax].forEach((s) => s && s.addEventListener("input", updateSetpoints));

function bindInput(inputEl, sliderEl, pairSliderEl, isMin = true) {
  if (!inputEl) return;

  inputEl.addEventListener("change", () => {
    if (applyingFromFirebase) return;
    let val = parseFloat(inputEl.value);
    if (isNaN(val)) val = parseFloat(sliderEl.value);
    val = clamp(val, parseFloat(sliderEl.min), parseFloat(sliderEl.max));
    const gap = 1;
    const pairVal = parseFloat(pairSliderEl.value);
    if (isMin) {
      if (val >= pairVal - gap) val = pairVal - gap;
    } else {
      if (val <= pairVal + gap) val = pairVal + gap;
    }
    sliderEl.value = val;
    updateSetpoints();
  });

  inputEl.addEventListener("input", () => {
    let val = parseFloat(inputEl.value);
    if (isNaN(val)) return;
    val = clamp(val, parseFloat(sliderEl.min), parseFloat(sliderEl.max));
    sliderEl.value = val;
    updateSetpoints();
  });
}

bindInput(TminInput, Tmin, Tmax, true);
bindInput(TmaxInput, Tmax, Tmin, false);
bindInput(MminInput, Mmin, Mmax, true);
bindInput(MmaxInput, Mmax, Mmin, false);

/* ======================= Boot setpoints (override > preset) ======================= */
(function bootSetpoints() {
  applyPlantHeaderFromLocalStorage();
  loadSetpointsForActivePlant();
})();

/* ======================= Sensor listener ======================= */
if (db) {
  onValue(ref(db, "Data/Sensor"), (snap) => {
    const v = snap.val(); if (!v) return;
    const T = parseFloat(v.Temperature);
    const M = parseFloat(v.Humminity);

    if (!isNaN(T) && Tnow) Tnow.textContent = T.toFixed(1);
    if (!isNaN(M) && Mnow) Mnow.textContent = M.toFixed(1);

    sensorCache = { T, M };
    if (setpointsLoaded) runAuto(T, M);
  });
}

if (db) {
  // 1) Data/Auto → Mode + (setpoints chỉ khi không có override)
  onValue(ref(db, "Data/Auto"), (snap) => {
    const v = snap.val(); if (!v) return;

    const plantId = getActivePlantId();
    const hasOverride = !!getUserOverride(plantId);

    if (!hasOverride) {
      applyingFromFirebase = true;
      if (v.Tsetmin !== undefined && Tmin) Tmin.value = v.Tsetmin;
      if (v.Tsetmax !== undefined && Tmax) Tmax.value = v.Tsetmax;
      if (v.Msetmin !== undefined && Mmin) Mmin.value = v.Msetmin;
      if (v.Msetmax !== undefined && Mmax) Mmax.value = v.Msetmax;
      applyingFromFirebase = false;

      if (TminInput && v.Tsetmin !== undefined) TminInput.value = v.Tsetmin;
      if (TmaxInput && v.Tsetmax !== undefined) TmaxInput.value = v.Tsetmax;
      if (MminInput && v.Msetmin !== undefined) MminInput.value = v.Msetmin;
      if (MmaxInput && v.Msetmax !== undefined) MmaxInput.value = v.Msetmax;

      fillColor(Tmin, Tmax, Tmin?.closest(".slider")?.querySelector(".slider-track"));
      fillColor(Mmin, Mmax, Mmin?.closest(".slider")?.querySelector(".slider-track"));
    }

    if (!setpointsLoaded) setpointsLoaded = true;
    if (sensorCache) runAuto(sensorCache.T, sensorCache.M);

    if (typeof v.Mode === "boolean") {
      const curr = getCurrentToggleStateFromDOM();
      const next = {
        rangeOn: v.Mode,
        autoOn: v.Mode ? false : curr.autoOn,
        scheduleOn: v.Mode ? false : curr.scheduleOn,
      };
      applyToggleStateToDOM(next);
    }
  });

  // 2) Data/MistConfig → auto/schedule
  onValue(ref(db, "Data/MistConfig"), (snap) => {
    const v = snap.val(); if (!v) return;

    const rtdbAuto     = !!v.auto;
    const rtdbSchedule = !!v.schedule;
    const curr         = getCurrentToggleStateFromDOM();

    if (!rtdbAuto && !rtdbSchedule) {
      applyToggleStateToDOM({
        rangeOn: curr.rangeOn,
        autoOn: false,
        scheduleOn: false
      });
      return;
    }

    if (rtdbAuto) {
      applyToggleStateToDOM({
        rangeOn: false,
        autoOn: true,
        scheduleOn: false
      });
      return;
    }

    if (rtdbSchedule) {
      applyToggleStateToDOM({
        rangeOn: false,
        autoOn: false,
        scheduleOn: true
      });
      return;
    }
  });
}

/***** ========== PID & Anti-chatter Config ========== *****/
// --- Lọc cảm biến (EMA) ---
const EMA_ALPHA_T = 0.2;    // 0..1 (cao hơn = bám nhanh hơn, nhiễu hơn)
const EMA_ALPHA_H = 0.25;

// --- Deadband (vùng chết) ---
const DB_T = 2;             // °C quanh [tmin, tmax] (nhiệt)
const DB_H_ON  = 2.0;       // %RH: ON khi M < mmin - DB_H_ON
const DB_H_OFF = 2.0;       // %RH: OFF khi M > mmax + DB_H_OFF

// --- PID cho nhiệt độ (2 nhánh nóng/lạnh) ---
const Kp_hot = 18, Ki_hot = 0.08, Kd_hot = 6;   // quá nóng -> Fan/Servo
const Kp_cold = 14, Ki_cold = 0.06, Kd_cold = 4; // quá lạnh -> LED
const I_CLAMP = 200;                             // kẹp tích phân
const OUT_MIN = 0, OUT_MAX = 100;                // % duty logic UI/thiết bị

// --- Giới hạn tốc độ thay đổi output (%/chu kỳ runAuto) ---
const SLEW_MAX = 10;

// --- Misting (boolean) chống nháy ---
const MIST_MIN_ON_MS  = 4000; // bật tối thiểu 4s
const MIST_MIN_OFF_MS = 4000; // tắt tối thiểu 4s

/***** ========== PID State ========== *****/
let emaT = null, emaH = null;
let errPrevHot = 0, errPrevCold = 0;
let iHot = 0, iCold = 0;

// nhớ output trước để slew
let yFanPrev = 0, yLedPrev = 0, servoPrev = 0;

// nhớ trạng thái & thời gian phun sương để dwell
let mistPrev = false;
let mistLastToggleMs = 0;

/***** ========== Helpers PID ========== *****/
function ema(prev, x, alpha) {
  return (prev == null) ? x : (prev + alpha * (x - prev));
}
function clampNum(x, a, b) { return Math.min(Math.max(x, a), b); }
function slew(prev, target, step) {
  if (target > prev + step) return prev + step;
  if (target < prev - step) return prev - step;
  return target;
}
function nowMs() { return Date.now(); }

/***** ========== runAuto (PID + chống nháy) ========== *****/
function runAuto(Traw, Hraw) {
  // 1) Lọc EMA
  emaT = ema(emaT, Traw, EMA_ALPHA_T);
  emaH = ema(emaH, Hraw, EMA_ALPHA_H);
  const T = emaT, M = emaH;

  const tmin = +Tmin.value, tmax = +Tmax.value;
  const mmin = +Mmin.value, mmax = +Mmax.value;

  // 2) Tính lỗi so với dải an toàn (dùng setpoint giữa dải)
  const Tsp = (tmin + tmax) / 2;

  // Deadband cho nhiệt: nếu nằm trong [tmin-DB_T, tmax+DB_T] thì coi là OK
  const tooCold = (T < (tmin - DB_T));
  const tooHot  = (T > (tmax + DB_T));

  // 3) PID nhánh nóng/lạnh (chỉ một nhánh hoạt động tại một thời điểm)
  let uHot = 0, uCold = 0;

  // dt giả định theo chu kỳ gọi ~1s → dùng 1.0
  const dt = 1.0;

  if (tooHot) {
    const errHot = T - Tsp; // dương khi nóng
    iHot += errHot * dt;
    iHot = clampNum(iHot, -I_CLAMP, I_CLAMP);
    const dHot = (errHot - errPrevHot) / dt;
    uHot = Kp_hot * errHot + Ki_hot * iHot + Kd_hot * dHot;
    errPrevHot = errHot;

    // khi chạy HOT nhánh → reset nhánh lạnh để tránh “ký ức”
    errPrevCold = 0; iCold = 0;
    uCold = 0;
  } else if (tooCold) {
    const errCold = Tsp - T; // dương khi lạnh
    iCold += errCold * dt;
    iCold = clampNum(iCold, -I_CLAMP, I_CLAMP);
    const dCold = (errCold - errPrevCold) / dt;
    uCold = Kp_cold * errCold + Ki_cold * iCold + Kd_cold * dCold;
    errPrevCold = errCold;

    // reset nhánh nóng
    errPrevHot = 0; iHot = 0;
    uHot = 0;
  } else {
    // trong vùng chết: reset nhẹ tích phân để không tràn
    iHot *= 0.9; iCold *= 0.9;
    uHot = 0; uCold = 0;
  }

  // 4) Map PID → thiết bị
  //   - Quá nóng: Fan (0..100%), Servo (0..180) theo mức “nóng”
  //   - Quá lạnh: LED (0..100%)
  let yFan   = clampNum(uHot, OUT_MIN, OUT_MAX);
  let yLed   = clampNum(uCold, OUT_MIN, OUT_MAX);

  // Servo mở theo mức nóng (tuyến tính 0..90)
  let servoTarget = Math.round((yFan / 100) * 90);

  // 5) Slew-rate limit để mượt
  yFan = Math.round(slew(yFanPrev, yFan, SLEW_MAX));
  yLed = Math.round(slew(yLedPrev, yLed, SLEW_MAX));
  const servo = Math.round(slew(servoPrev, servoTarget, Math.round((SLEW_MAX/100)*90)));

  yFanPrev = yFan;
  yLedPrev = yLed;
  servoPrev = servo;

  // 6) Phun sương (boolean) với Schmitt + dwell
  //    - ON khi M < mmin - DB_H_ON
  //    - OFF khi M > mmax + DB_H_OFF
  const wantMistOn = (M < (mmin - DB_H_ON));
  const wantMistOff = (M > (mmax + DB_H_OFF));

  let mist = mistPrev;
  const tNow = nowMs();
  const sinceToggle = tNow - mistLastToggleMs;

  if (!mist) {
    // đang OFF → chỉ cho bật nếu đúng điều kiện và đã qua tối thiểu OFF dwell
    if (wantMistOn && sinceToggle >= MIST_MIN_OFF_MS) {
      mist = true;
      mistLastToggleMs = tNow;
    }
  } else {
    // đang ON → chỉ cho tắt nếu đúng điều kiện và đã qua tối thiểu ON dwell
    if (wantMistOff && sinceToggle >= MIST_MIN_ON_MS) {
      mist = false;
      mistLastToggleMs = tNow;
    }
  }
  mistPrev = mist;

  // 7) CẬP NHẬT UI
  if (LedA)   { LedA.textContent = yLed;   LedA.classList.toggle("on", yLed>0);   LedA.classList.toggle("off", !(yLed>0)); }
  if (FanA)   { FanA.textContent = yFan;   FanA.classList.toggle("on", yFan>0);   FanA.classList.toggle("off", !(yFan>0)); }
  if (ServoA) { ServoA.textContent = servo; ServoA.classList.toggle("on", servo>0); ServoA.classList.toggle("off", !(servo>0)); }
  if (MistingA) {
    MistingA.textContent = mist ? "ON" : "OFF";
    MistingA.classList.toggle("on",  mist);
    MistingA.classList.toggle("off", !mist);
  }

  // 8) GỬI RTDB
  if (db) {
    update(ref(db, "Data/Auto"), {
      LedA: yLed,
      FanA: yFan,
      ServoA: servo,
      MistingA: mist   // boolean
    });
  }
}

/* ======================= init UI + gắn event ======================= */
window.addEventListener("DOMContentLoaded", () => {
  fillColor(Tmin, Tmax, Tmin?.closest(".slider")?.querySelector(".slider-track"));
  fillColor(Mmin, Mmax, Mmin?.closest(".slider")?.querySelector(".slider-track"));

  applyPlantHeaderFromLocalStorage();

  // khởi tạo theo GLOBAL_MODE_KEY
  const gMode = localStorage.getItem(GLOBAL_MODE_KEY);
  if (gMode === "range") {
    applyToggleStateToDOM({ rangeOn: true, autoOn: false, scheduleOn: false });
  } else if (gMode === "mist") {
    applyToggleStateToDOM({ rangeOn: false, autoOn: true, scheduleOn: false });
  } else if (gMode === "schedule") {
    applyToggleStateToDOM({ rangeOn: false, autoOn: false, scheduleOn: true });
  } else {
    applyToggleStateToDOM({ rangeOn: false, autoOn: false, scheduleOn: false });
  }

  // 1) RANGE
  if (rangeModeSwitch) {
    rangeModeSwitch.addEventListener("change", () => {
      if (rangeModeSwitch.checked) {
        // bật range → 2 cái còn lại off
        const state = { rangeOn: true, autoOn: false, scheduleOn: false };
        applyToggleStateToDOM(state);
        push3TogglesToRTDB(state);
        updateSetpoints();
      } else {
        // tắt range → 3 cái đều off
        const state = { rangeOn: false, autoOn: false, scheduleOn: false };
        applyToggleStateToDOM(state);
        push3TogglesToRTDB(state);
      }
    });
  }

  // 2) AUTO
  if (autoModeSwitch) {
    autoModeSwitch.addEventListener("change", () => {
      if (autoModeSwitch.checked) {
        const state = { rangeOn: false, autoOn: true, scheduleOn: false };
        applyToggleStateToDOM(state);
        push3TogglesToRTDB(state);
      } else {
        const state = { rangeOn: false, autoOn: false, scheduleOn: false };
        applyToggleStateToDOM(state);
        push3TogglesToRTDB(state);
      }
    });
  }

  // 3) SCHEDULE
  if (scheduleSwitch) {
    scheduleSwitch.addEventListener("change", () => {
      if (scheduleSwitch.checked) {
        const state = { rangeOn: false, autoOn: false, scheduleOn: true };
        applyToggleStateToDOM(state);
        push3TogglesToRTDB(state);

        // đánh dấu schedule enabled trong local
        const raw = localStorage.getItem(SCHEDULE_LS_KEY);
        let sch = { enabled: true };
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            parsed.enabled = true;
            sch = parsed;
          } catch (e) {}
        }
        localStorage.setItem(SCHEDULE_LS_KEY, JSON.stringify(sch));
      } else {
        const state = { rangeOn: false, autoOn: false, scheduleOn: false };
        applyToggleStateToDOM(state);
        push3TogglesToRTDB(state);
      }
    });
  }

  // sync giữa tab
  window.addEventListener("storage", (e) => {
    // 👉 Chỉ khi đổi cây mới nạp preset/override cho cây đó.
    if (e.key === "information.js_activePlant") {
      applyPlantHeaderFromLocalStorage();
      loadSetpointsForActivePlant(); // ưu tiên override cây mới; nếu chưa có thì preset cây mới
    }
    if (e.key === "information.js_plantName") {
      applyPlantHeaderFromLocalStorage();
    }

    // đổi mode
    if (e.key === GLOBAL_MODE_KEY) {
      const val = e.newValue;
      if (val === "range") {
        applyToggleStateToDOM({ rangeOn: true, autoOn: false, scheduleOn: false });
      } else if (val === "mist") {
        applyToggleStateToDOM({ rangeOn: false, autoOn: true, scheduleOn: false });
      } else if (val === "schedule") {
        applyToggleStateToDOM({ rangeOn: false, autoOn: false, scheduleOn: true });
      } else {
        applyToggleStateToDOM({ rangeOn: false, autoOn: false, scheduleOn: false });
      }
    }
  });
});

/* ======================= auth state ======================= */
if (auth) {
  onAuthStateChanged(auth, (user) => {
    authed = !!user;
    refreshConnPills();
  });
}

/* ======================= RTDB .info ======================= */
if (db) {
  onValue(ref(db, ".info/connected"), (snap) => {
    rtdbOnline = snap.val() === true;
    refreshConnPills();
  });
}
