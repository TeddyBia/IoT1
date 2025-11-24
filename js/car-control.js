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

// để giữ đồng bộ wifi-floating
if (db) {
  const wifiRef = ref(db, "Data/Wifi");
  onValue(wifiRef, () => {});
}

const CAR_PATH = "Data/Car";

document.addEventListener("DOMContentLoaded", () => {
  // ===== DOM =====
  const carStatus = document.getElementById("carStatus");
  const dpadBtns  = document.querySelectorAll(".dpad .d");
  const btnLights = document.getElementById("btnLights");
  const pwmRange  = document.getElementById("pwmRange");
  const pwmInput  = document.getElementById("pwmInput");
  const pwmVal    = document.getElementById("pwmVal");

  // HUD elements
  const sF = document.getElementById("s-forward");
  const sL = document.getElementById("s-left");
  const sR = document.getElementById("s-right");
  const sB = document.getElementById("s-back");
  const sLi= document.getElementById("s-lights");
  const sP = document.getElementById("s-pwm");
  const sC = document.getElementById("s-combo");

  // ===== State local =====
  const carState = { forward:0, left:0, right:0, back:0, lights:0, pwm:0 };

  const setStatus = (text = "Local") => {
    if (!carStatus) return;
    carStatus.classList.remove("waiting","ok","error");
    carStatus.classList.add("ok");
    carStatus.innerHTML = `<span class="dot"></span>${text}`;
  };

  const btnOf = (dir) => document.querySelector(`.d[data-move="${dir}"]`);
  const visual = (dir, on) => {
    const el = btnOf(dir);
    if (el) el.classList.toggle("on", !!on);
  };

  // ===== Render HUD =====
  function setBadge(el, val){
    if (!el) return;
    el.textContent = String(val);
    el.classList.toggle("on", !!val);
    el.classList.toggle("off", !val);
  }
  function renderState() {
    setBadge(sF, carState.forward);
    setBadge(sL, carState.left);
    setBadge(sR, carState.right);
    setBadge(sB, carState.back);
    setBadge(sLi,carState.lights);
    if (sP) sP.textContent = String(carState.pwm);

    const active = [];
    if (carState.forward) active.push("Forward");
    if (carState.left)    active.push("Left");
    if (carState.right)   active.push("Right");
    if (carState.back)    active.push("Back");
    sC.textContent = active.length ? active.join(" + ") : "-";
  }

  function applyState(next) {
    let changed = false;
    for (const k of ["forward","left","right","back","lights","pwm"]) {
      if (carState[k] !== next[k]) {
        carState[k] = next[k];
        changed = true;
        if (k !== "pwm" && k !== "lights") visual(k, carState[k] === 1);
        if (k === "lights" && btnLights) btnLights.classList.toggle("active", !!carState.lights);
      }
    }
    if (changed) renderState();
  }

  function stopAll() {
    applyState({ ...carState, forward:0, left:0, right:0, back:0 });
  }

  // ===== DPAD: Mouse/Touch (cho phép giữ nhiều nút) =====
  dpadBtns.forEach(btn => {
    const dir = btn.dataset.move; // forward/left/right/back/stop

    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      btn.classList.add("hold");
      if (dir === "stop") { stopAll(); return; }
      applyState({ ...carState, [dir]:1 });
    });
    btn.addEventListener("mouseup", () => {
      btn.classList.remove("hold");
      if (dir !== "stop") applyState({ ...carState, [dir]:0 });
    });
    btn.addEventListener("mouseleave", () => btn.classList.remove("hold"));

    btn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      btn.classList.add("hold");
      if (dir === "stop") { stopAll(); return; }
      applyState({ ...carState, [dir]:1 });
    }, { passive:false });
    const endTouch = () => {
      btn.classList.remove("hold");
      if (dir !== "stop") applyState({ ...carState, [dir]:0 });
    };
    btn.addEventListener("touchend", endTouch);
    btn.addEventListener("touchcancel", endTouch);
  });

  // ===== Keyboard (2 phím đồng thời + huỷ đối nghịch) =====
  const keyToDir = (key) => {
    const k = (key || "").toLowerCase();
    if (k === "w" || key === "ArrowUp")    return "forward";
    if (k === "a" || key === "ArrowLeft")  return "left";
    if (k === "s" || key === "ArrowDown")  return "back";
    if (k === "d" || key === "ArrowRight") return "right";
    return null;
  };
  const pressed = new Set(); // chứa tên hướng

  function recomputeFromPressed() {
    let f = pressed.has("forward") ? 1 : 0;
    let b = pressed.has("back")    ? 1 : 0;
    let l = pressed.has("left")    ? 1 : 0;
    let r = pressed.has("right")   ? 1 : 0;

    // Huỷ đối nghịch
    if (f && b) { f = 0; b = 0; }
    if (l && r) { l = 0; r = 0; }

    applyState({ ...carState, forward:f, back:b, left:l, right:r });
    if (db) {
      const carRef = ref(db, CAR_PATH);
      update(carRef, {
        forward: f,
        back: b,
        left: l,
        right: r,
        ts: Date.now()   // thêm timestamp để debug thời điểm cập nhật
      }).catch(err => console.error("[RTDB update]", err));
    }
  }

  document.addEventListener("keydown", (e) => {
    // Dừng nhanh
    if (e.code === "Space" || e.key === "x" || e.key === "X") {
      e.preventDefault();
      if (pressed.size) pressed.clear();
      stopAll();
      return;
    }
    const dir = keyToDir(e.key);
    if (!dir) return;

    if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key)) {
      e.preventDefault();
    }
    if (e.repeat) return;

    if (!pressed.has(dir)) {
      pressed.add(dir);
      recomputeFromPressed();
    }
  });

  document.addEventListener("keyup", (e) => {
    const dir = keyToDir(e.key);
    if (!dir) return;
    pressed.delete(dir);
    recomputeFromPressed();
  });

  window.addEventListener("blur", () => { pressed.clear(); stopAll(); });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") { pressed.clear(); stopAll(); }
  });

  // ===== Lights toggle =====
  btnLights?.addEventListener("click", () => {
    applyState({ ...carState, lights: carState.lights ? 0 : 1 });
  });

  // ===== PWM % ⇒ hiển thị & lưu local =====
  function setPwmUI(percent) {
    percent = Math.max(0, Math.min(100, Number(percent) || 0));
    pwmRange.value = String(percent);
    pwmInput.value = String(percent);
    pwmVal.textContent = `${percent}%`;
    pwmRange.style.setProperty("--pwm-fill", `${percent}%`);
  }
  function setPwm(percent) {
    const p = Math.max(0, Math.min(100, Number(percent) || 0));
    applyState({ ...carState, pwm: Math.round(p * 2.55) });
  }
  setPwmUI(0);

  pwmRange?.addEventListener("input", (e) => {
    const v = Number(e.target.value);
    setPwmUI(v);
    setPwm(v);
  });
  pwmInput?.addEventListener("input", (e) => {
    let v = Number(e.target.value);
    if (isNaN(v)) v = 0;
    v = Math.max(0, Math.min(100, v));
    setPwmUI(v);
    setPwm(v);
  });

  // Init
  setStatus("Local (no RTDB)");
  renderState();
});
