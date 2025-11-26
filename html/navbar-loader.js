import {
  ref,
  get,
  set,
  child,
  onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// chờ firebase-core
async function waitForFirebase() {
  if (!window.kc326e) return null;
  if (window.kc326e.ready && typeof window.kc326e.ready.then === "function") {
    await window.kc326e.ready;
  }
  return window.kc326e;
}

function readThresholds() {
  const tmin = Number(localStorage.getItem("information.js_tmin"));
  const tmax = Number(localStorage.getItem("information.js_tmax"));
  const hmin = Number(localStorage.getItem("information.js_hmin"));
  const hmax = Number(localStorage.getItem("information.js_hmax"));

  return {
    tmin: Number.isFinite(tmin) ? tmin : null,
    tmax: Number.isFinite(tmax) ? tmax : null,
    hmin: Number.isFinite(hmin) ? hmin : null,
    hmax: Number.isFinite(hmax) ? hmax : null,
  };
}

// ===== Helpers tên cây / alias / badge text =====
function getActivePlantName() {
  return localStorage.getItem("information.js_plantName") || "Unknown";
}
function getPlantAliasVi(enName) {
  const map = {
    "Radish": "Cải củ",
    "Pak Choi": "Cải Thìa",
    "Malabar Spinach": "Mồng tơi",
    "Cucumber": "Dưa leo",
    "Tomato": "Cà chua",
  };
  return map[enName] || null;
}
function buildPlantLines() {
  const name = getActivePlantName();
  const alias = getPlantAliasVi(name);
  const { tmin, tmax, hmin, hmax } = readThresholds();

  const tPart = (tmin != null && tmax != null) ? `${tmin}–${tmax}°C` : `--°C`;
  const hPart = (hmin != null && hmax != null) ? `${hmin}–${hmax}%` : `--%`;

  return {
    line1: alias ? `${name} (${alias})` : name,
    line2: `tmin–tmax: ${tPart}`,
    line3: `hmin–hmax: ${hPart}`
  };
}
function refreshPlantBadgeText() {
  const { line1, line2, line3 } = buildPlantLines();
  const el1 = document.getElementById("plantBadgeLine1");
  const el2 = document.getElementById("plantBadgeLine2");
  const el3 = document.getElementById("plantBadgeLine3");
  if (el1) el1.textContent = line1;
  if (el2) el2.textContent = line2;
  if (el3) el3.textContent = line3;
}
function refreshAlertPlantName() {
  const el = document.getElementById("alertPlantName");
  if (el) el.textContent = getActivePlantName();
}

function getPageName(path) {
  // path có thể là "/index.html" hoặc "/" hoặc "/auto.html"
  const parts = path.split("/");
  let last = parts.pop() || parts.pop(); // xử lý trường hợp có dấu "/" ở cuối
  if (!last || last === "") return "details.html";
  return last;
}

async function loadNavbar() {
  const navbarEl = document.getElementById("navbar");
  if (!navbarEl) return;

  const res = await fetch("./html/navbar.html");
  const html = await res.text();
  navbarEl.innerHTML = html;

  const current = getPageName(window.location.pathname);
  const links = document.querySelectorAll(".nav-links a");
  links.forEach((link) => {
    if (link.getAttribute("href") === current) link.classList.add("active");
  });

  // logout
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      const fb = await waitForFirebase();
      if (!fb || !fb.auth) return (window.location.href = "index.html");

      if (!confirm("Are you sure you want to log out?")) return;

      const { auth, logLoginAttempt } = fb;
      try {
        const user = auth.currentUser;
        const email = user ? user.email : "(unknown)";
        if (typeof logLoginAttempt === "function")
          await logLoginAttempt(email, "Logout");

        await auth.signOut();
        window.location.href = "index.html";
      } catch (err) {
        console.error("Logout error:", err);
        alert("Logout failed!");
      }
    });
  }

    // ================== 🌐 WIFI MANAGER CARD ==================
  (function initWifiCard() {
    const card        = document.getElementById("wifiCard");
    if (!card) return; // nếu navbar.html chưa có wifiCard thì bỏ qua

    const modeBtns    = card.querySelectorAll(".wifi-card-modes button");
    const hintEl      = document.getElementById("wifiHintText");
    const ssidInput   = document.getElementById("wifiSsidInput");
    const pwdInput    = document.getElementById("wifiPwdInput");
    const newPwdWrap  = document.getElementById("newPwdWrap");
    const newPwdInput = document.getElementById("wifiNewPwdInput");
    const saveBtn     = document.getElementById("wifiSaveBtn");

    let currentMode = "add"; // mặc định

    function updateModeUI(mode) {
      currentMode = mode;

      // active button
      modeBtns.forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.mode === mode);
      });

      // ẩn/hiện ô "New password"
      if (mode === "change") {
        newPwdWrap.style.display = "flex";
        if (hintEl) hintEl.textContent = "Mode: Change password";
      } else if (mode === "add") {
        newPwdWrap.style.display = "none";
        if (hintEl) hintEl.textContent = "Mode: Add WiFi";
      } else if (mode === "delete") {
        newPwdWrap.style.display = "none";
        if (hintEl) hintEl.textContent = "Mode: Delete WiFi";
      }
    }

    // click đổi mode
    modeBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.mode || "add";
        updateModeUI(mode);
      });
    });

    // 👁️ toggle hiện/ẩn password
    card.querySelectorAll(".toggle-eye").forEach((icon) => {
      icon.addEventListener("click", () => {
        const targetId = icon.dataset.target;
        const input = document.getElementById(targetId);
        if (!input) return;

        const isPassword = input.type === "password";
        input.type = isPassword ? "text" : "password";

        // đổi icon
        icon.classList.toggle("fa-eye-slash", !isPassword);
        icon.classList.toggle("fa-eye", isPassword);
      });
    });

    // helper: đọc list wifi hiện tại từ Data/Flash
    async function fetchFlashList(db) {
      const flashRootRef = ref(db, "Data/Flash");
      const snap = await get(flashRootRef);
      const flash = snap.exists() ? snap.val() : {};
      const list = Object.entries(flash).map(([key, v]) => ({
        key,
        ssid: (v && v.ssid) || "",
        pwd:  (v && v.pwd)  || ""
      }));
      return { flashRootRef, list };
    }

    // helper: tìm key WifiN trống (Wifi0..n)
    function findNewWifiKey(list) {
      const usedIdx = list
        .map(e => {
          const m = e.key.match(/^Wifi(\d+)$/i);
          return m ? parseInt(m[1], 10) : null;
        })
        .filter(n => Number.isInteger(n));

      let idx = 0;
      while (usedIdx.includes(idx)) idx++;
      return "Wifi" + idx;
    }

    // click SAVE: gửi lệnh lên RTDB với logic add/delete/change
    if (saveBtn) {
      saveBtn.addEventListener("click", async () => {
        const fb = await waitForFirebase();
        if (!fb || !fb.db) {
          alert("Firebase not ready (db missing)");
          return;
        }

        const ssid   = (ssidInput?.value || "").trim();
        const pwd    = (pwdInput?.value || "").trim();
        const newPwd = (newPwdInput?.value || "").trim();

        // ==== validate cơ bản ====
        if (!ssid) {
          alert("Vui lòng nhập SSID");
          return;
        }

        if (currentMode === "add" && !pwd) {
          alert("Vui lòng nhập mật khẩu (Add mode)");
          return;
        }

        if (currentMode === "change" && (!pwd || !newPwd)) {
          alert("Vui lòng nhập mật khẩu hiện tại và mật khẩu mới");
          return;
        }

        try {
          const { flashRootRef, list } = await fetchFlashList(fb.db);
          const existing = list.find(e => e.ssid === ssid);

          // ========== ADD ==========
          if (currentMode === "add") {
            if (existing) {
              alert("SSID này đã tồn tại, không thể thêm trùng.");
              return;
            }

            const newKey = findNewWifiKey(list);
            await set(child(flashRootRef, newKey), {
              ssid: ssid,
              pwd: pwd
            });

            if (hintEl) hintEl.textContent = `Đã thêm WiFi "${ssid}" tại ${newKey}`;
          }

          // ========== DELETE ==========
          else if (currentMode === "delete") {
            if (!existing) {
              alert("SSID không tồn tại, không thể xóa.");
              return;
            }
            if (existing.pwd !== pwd) {
              alert("Mật khẩu không đúng, không thể xóa.");
              return;
            }

            await set(child(flashRootRef, existing.key), null);
            if (hintEl) hintEl.textContent = `Đã xóa WiFi "${ssid}" (${existing.key})`;
          }

          // ========== CHANGE PASSWORD ==========
          else if (currentMode === "change") {
            if (!existing) {
              alert("SSID không tồn tại, không thể đổi mật khẩu.");
              return;
            }
            if (existing.pwd !== pwd) {
              alert("Mật khẩu hiện tại không đúng, không thể đổi.");
              return;
            }
            if (!newPwd) {
              alert("Vui lòng nhập mật khẩu mới.");
              return;
            }

            await set(child(flashRootRef, existing.key), {
              ssid: existing.ssid,
              pwd: newPwd
            });

            if (hintEl) hintEl.textContent = `Đã đổi mật khẩu cho "${ssid}"`;
          }

          // tùy chọn: clear input sau khi thao tác
          // pwdInput.value    = "";
          // newPwdInput.value = "";

        } catch (err) {
          console.error("WiFi save error:", err);
          alert("Lỗi khi cập nhật WiFi lên RTDB");
        }
      });
    }

    // set UI mặc định
    updateModeUI("add");
  })();
  // ================== END WIFI MANAGER CARD ==================


  // 🌿 Top-left PLANT BADGE
  (function injectPlantBadgeStyles() {
    const style = document.createElement("style");
    style.textContent = `
  #plantBadge {
    position: fixed;
    top: 100px;
    left: 16px;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 3px;
    padding: 10px 14px;
    border-radius: 14px;

    /* 🌫️ nền mờ trong suốt */
    background: rgba(255, 255, 255, 0.35);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);

    border: 1px solid rgba(255, 255, 255, 0.25);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);

    font: 600 14px 'Poppins', sans-serif;
    color: #1b2a3a;
    user-select: none;
    transition: all 0.3s ease;
  }

  #plantBadge:hover {
    background: rgba(255, 255, 255, 0.45);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }

  #plantBadge i { opacity: .8; margin-right: 4px; }
  #plantBadge span { display: block; }
  #plantBadge .line2, 
  #plantBadge .line3 { 
    font-weight: 500; 
    opacity: .85; 
  }
      `;
    document.head.appendChild(style);
  })();

  const plantBadge = document.createElement("div");
  plantBadge.id = "plantBadge";
  plantBadge.innerHTML = `
    <span class="line1" id="plantBadgeLine1"></span>
    <span class="line2" id="plantBadgeLine2"></span>
    <span class="line3" id="plantBadgeLine3"></span>
  `;
  document.body.appendChild(plantBadge);
  refreshPlantBadgeText();

  window.addEventListener("storage", (e) => {
    if (
      e.key?.startsWith("information.js_")
    ) {
      refreshPlantBadgeText();
      refreshAlertPlantName();
    }
  });

  // 🔔 ENV ALERT (Temp/Hum)
  (function injectEnvAlertStyles() {
    const style = document.createElement("style");
    style.textContent = `
      #envAlert {
        position: fixed;
        top: 200px;
        right: 20px;
        display: none;
        flex-direction: column;
        align-items: flex-start;
        gap: 6px;
        padding: 12px 14px;
        width: 200px;
        border-radius: 12px;
        font-family: 'Poppins', sans-serif;
        font-size: 14px;
        font-weight: 600;
        background: rgba(255, 255, 255, 0.95);
        border: 2px solid rgba(100, 100, 100, 0.18);
        box-shadow: 0 8px 20px rgba(25,65,120,.15);
        z-index: 999;
      }
      #envAlert.warn  { color: #ec1212ff; border-color: rgba(255,107,107,.6); background: rgba(219,206,206,0.4); }
      @keyframes pulse-alert {
        0%   { box-shadow: 0 0 0 0 rgba(255,107,107,0.45); }
        70%  { box-shadow: 0 0 0 10px rgba(255,107,107,0); }
        100% { box-shadow: 0 0 0 0 rgba(255,107,107,0); }
      }
      #envAlert.blink { animation: pulse-alert 1.3s ease-out infinite; }
      #envAlert .title { font-weight:700; font-size:15px; display:flex; align-items:center; gap:8px; }
      #envAlert .detail { font-weight:600; }
      #envAlert .plant  { font-weight:600; opacity:.85; }
    `;
    document.head.appendChild(style);
  })();

  const alertEl = document.createElement("div");
  alertEl.id = "envAlert";
  alertEl.innerHTML = `
    <div class="title">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <span id="alertTitleText">Warning</span>
    </div>
    <div id="alertPlant" class="plant">Plant: <span id="alertPlantName">Unknown</span></div>
    <div id="alertTemp" class="detail"></div>
    <div id="alertHum" class="detail"></div>
  `;
  document.body.appendChild(alertEl);
  refreshAlertPlantName();

  // 💧 WATER LEVEL ALERT (mực nước phun sương – bên dưới envAlert)
  ;(function injectWaterAlertStyles() {
    const style = document.createElement("style");
    style.textContent = `
      #waterAlert {
        position: fixed;
        top: 430px;           /* dưới envAlert (200px) */
        right: 20px;
        display: none;
        flex-direction: column;
        align-items: flex-start;
        gap: 6px;
        padding: 12px 14px;
        width: 200px;
        border-radius: 12px;
        font-family: 'Poppins', sans-serif;
        font-size: 14px;
        font-weight: 600;
        background: rgba(255, 255, 255, 0.95);
        border: 2px solid rgba(100, 100, 100, 0.18);
        box-shadow: 0 8px 20px rgba(25,65,120,.15);
        z-index: 999;
      }
      #waterAlert.warn  { 
        color: #ec1212ff; 
        border-color: rgba(255,107,107,.6); 
        background: rgba(219,206,206,0.4); 
      }
      #waterAlert.blink { 
        animation: pulse-alert 1.3s ease-out infinite;  /* dùng chung keyframes với envAlert */
      }
      #waterAlert .title { 
        font-weight:700; 
        font-size:15px; 
        display:flex; 
        align-items:center; 
        gap:8px; 
      }
      #waterAlert .detail { 
        font-weight:600; 
        opacity:.9; 
      }
    `;
    document.head.appendChild(style);
  })();

  const waterEl = document.createElement("div");
  waterEl.id = "waterAlert";
  waterEl.innerHTML = `
    <div class="title">
      <i class="fa-solid fa-water"></i>
      <span>Mực nước phun sương</span>
    </div>
    <div class="detail" id="waterText"></div>
  `;
  document.body.appendChild(waterEl);

  function updateWaterAlertUI(minLvl, maxLvl) {
    const textEl = document.getElementById("waterText");
    if (!waterEl || !textEl) return;

    const isMin = Number(minLvl) === 1;
    const isMax = Number(maxLvl) === 1;

    // ❌ Không cảnh báo
    if (!isMin && !isMax) {
      waterEl.style.display = "none";
      waterEl.className = "";
      textEl.textContent = "";
      return;
    }

    // ✅ Có cảnh báo
    waterEl.style.display = "flex";
    waterEl.className = "warn blink";

    if (isMin) {
      textEl.textContent = "Mực nước thấp – cần châm thêm / Ngừng phun sương";
    } else if (isMax) {
      textEl.textContent = "Mực nước cao – ngưng bơm";
    }
  }

  function evaluateEnv(temp, hum) {
    const { tmin, tmax, hmin, hmax } = readThresholds();

    const problems = [];

    let tempMsg = "";
    if (Number.isFinite(temp)) {
      if (tmin != null && temp < tmin)
        problems.push((tempMsg = `Temperature: ${temp.toFixed(1)} °C (LOW < ${tmin}°C)`));
      else if (tmax != null && temp > tmax)
        problems.push((tempMsg = `Temperature: ${temp.toFixed(1)} °C (HIGH > ${tmax}°C)`));
    }

    let humMsg = "";
    if (Number.isFinite(hum)) {
      if (hmin != null && hum < hmin)
        problems.push((humMsg = `Humidity: ${hum.toFixed(1)} % (LOW < ${hmin}%)`));
      else if (hmax != null && hum > hmax)
        problems.push((humMsg = `Humidity: ${hum.toFixed(1)} % (HIGH > ${hmax}%)`));
    }

    return { problems, tempMsg, humMsg };
  }

  function updateAlertUI(status) {
    const titleEl = alertEl.querySelector("#alertTitleText");
    const tempEl = alertEl.querySelector("#alertTemp");
    const humEl = alertEl.querySelector("#alertHum");

    if (status.problems.length === 0) {
      alertEl.style.display = "none";
      alertEl.className = "";
      return;
    }

    alertEl.style.display = "flex";
    alertEl.className = "warn blink";
    titleEl.textContent = "Warning";

    tempEl.textContent = status.tempMsg || "";
    humEl.textContent = status.humMsg || "";

    alertEl.title = status.problems.join(" • ");
  }

  try {
    const fb = await waitForFirebase();
    if (fb && fb.db) {
      const sensorRef = ref(fb.db, "Data/Sensor");
      onValue(sensorRef, (snap) => {
        const data = snap.val() || {};
        const temp = Number(data.Temperature ?? 0);
        const hum  = Number(data.Humidity   ?? 0);
        const minLvl = Number(data.minLvl ?? 0);
        const maxLvl = Number(data.maxLvl ?? 0);

        refreshPlantBadgeText();
        refreshAlertPlantName();

        const status = evaluateEnv(temp, hum);
        updateAlertUI(status);
        updateWaterAlertUI(minLvl, maxLvl);
      });
    }
  } catch (err) {
    console.error("Env alert init error:", err);
  }

    // 🎙️ AUDIO BADGE (rasp/audio: { record: boolean, talk: string })
  (function injectAudioBadgeStyles() {
    const style = document.createElement("style");
    style.textContent = `
      #audioBadge {
        position: fixed;
        top: 200px;  /* 👈 đặt dưới plantBadge */
        left: 16px;
        z-index: 1000;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 6px;
        padding: 10px 14px;
        border-radius: 12px;

        /* hiệu ứng nền kính mờ */
        background: rgba(255,255,255,0.35);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(255,255,255,0.25);
        box-shadow: 0 6px 18px rgba(0,0,0,0.08);

        font-family: 'Poppins', sans-serif;
        color: #1b2a3a;
        user-select: none;
        transition: all 0.3s ease;
        width: 190px;
      }

      #audioBadge .row {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
        font-size: 14px;
      }

      #audioBadge .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #e74c3c;
        box-shadow: 0 0 0 0 rgba(231,76,60,0.7);
      }

      /* chớp khi đang ghi âm */
      @keyframes pulse-dot {
        0% { box-shadow: 0 0 0 0 rgba(231,76,60,0.7); }
        70% { box-shadow: 0 0 0 10px rgba(231,76,60,0); }
        100% { box-shadow: 0 0 0 0 rgba(231,76,60,0); }
      }

      #audioBadge.recording .dot {
        animation: pulse-dot 1.2s ease-out infinite;
      }

      #audioBadge.finished .dot {
        background: #2ecc71; /* xanh khi ghi xong */
      }

      #audioBadge .talk {
        font-weight: 500;
        opacity: .9;
        line-height: 1.3;
        max-width: 280px;
        word-break: break-word;
        white-space: pre-wrap;
      }

      body.dark #audioBadge {
        background: rgba(30,30,30,0.35);
        border-color: rgba(255,255,255,0.15);
        color: #eef2f7;
      }
    `;
    document.head.appendChild(style);
  })();

  const audioEl = document.createElement("div");
  audioEl.id = "audioBadge";
  audioEl.innerHTML = `
    <div class="row">
      <span class="dot"></span>
      <span id="audioStatus">Recording …</span>
    </div>
    <div class="talk" id="audioTalk"></div>
  `;
  document.body.appendChild(audioEl);

  function updateAudioBadge({ record, talk }) {
    const badge = document.getElementById("audioBadge");
    const statusEl = document.getElementById("audioStatus");
    const talkEl = document.getElementById("audioTalk");
    if (!badge || !statusEl || !talkEl) return;

    badge.style.display = "flex"; // luôn hiện badge

    // ⚙️ cập nhật trạng thái ghi âm
    if (record) {
      badge.classList.add("recording");
      badge.classList.remove("finished");
      statusEl.textContent = "Recording …";
    } else {
      badge.classList.remove("recording");
      badge.classList.add("finished");
      statusEl.textContent = "Recording finished!";
    }

    // 💬 hiển thị nội dung talk (luôn hiển thị)
    const talkStr = (talk || "").trim();
    if (talkStr.length > 0) {
      talkEl.textContent = `Request received: ${talkStr}`;
    } else {
      talkEl.textContent = "Request received: (none)";
    }
  }

  // 🔊 Lắng nghe RTDB: /rasp/audio
  try {
    const fb = await waitForFirebase();
    if (fb && fb.db)  {
      const audioRef = ref(fb.db, "rasp/audio");
      onValue(audioRef, (snap) => {
        const v = snap.val() || {};
        updateAudioBadge({
          record: !!v.record,
          talk: v.talk ?? ""
        });
      }, (err) => {
        console.error("audio listener error:", err);
      });
    }
  } catch (e) {
    console.error("init audio badge failed:", e);
  }

    // 🐛 PEST ALERT (insect/pest by area)
  (function injectPestAlertStyles() {
    const style = document.createElement("style");
    style.textContent = `
      #pestAlert {
        position: fixed;
        top: 350px;     /* 👈 đặt dưới envAlert (200px) — tùy chỉnh */
        left: 20px;
        display: none;
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        padding: 12px 14px;
        width: 190px;
        border-radius: 12px;
        font-family: 'Poppins', sans-serif;
        font-size: 14px;
        font-weight: 600;
        background: rgba(255, 255, 255, 0.95);
        border: 2px solid rgba(100, 100, 100, 0.18);
        box-shadow: 0 8px 20px rgba(25,65,120,.15);
        z-index: 999;
        user-select: none;
      }
      #pestAlert.warn { color: #ec1212ff; border-color: rgba(255,107,107,.6); background: rgba(219,206,206,0.4); }
      #pestAlert.blink { animation: pulse-alert 1.3s ease-out infinite; }
      #pestAlert .title { font-weight: 700; font-size: 15px; display: flex; align-items: center; gap: 8px; }
      #pestAlert .list { display: flex; flex-direction: column; gap: 6px; width: 100%; }
      #pestAlert .item {
        display: flex; justify-content: space-between; align-items: center;
        padding: 6px 8px; border-radius: 8px; background: rgba(255,255,255,0.6);
        border: 1px solid rgba(20,40,80,.12);
        font-weight: 600;
      }
      #pestAlert .item .area { opacity: .9; }
      #pestAlert .item .cnt  { font-weight: 700; }
    `;
    document.head.appendChild(style);
  })();

  const pestEl = document.createElement("div");
  pestEl.id = "pestAlert";
  pestEl.innerHTML = `
    <div class="title">
      <i class="fa-solid fa-bug"></i>
      <span>Pests detected</span>
    </div>
    <div class="list" id="pestList"></div>
  `;
  document.body.appendChild(pestEl);

  function areaLabel(n) {
    return `Area ${n}`;
  }

  // Nhận mọi kiểu cấu trúc thường gặp ở /rasp/detect
  function normalizePestCounts(raw) {
    const out = [];
    if (!raw || typeof raw !== "object") return out;

    for (const [k, v] of Object.entries(raw)) {
      let a = null;

      // key: "1","2","3","4"
      if (/^\d+$/.test(k)) {
        a = parseInt(k, 10);
      }
      // key: "detect_1", "detect-2"
      else if (/^detect[_-]?(\d+)$/i.test(k)) {
        a = parseInt(RegExp.$1, 10);
      }
      // key: "area1","area_2"
      else if (/^area[_-]?(\d+)$/i.test(k)) {
        a = parseInt(RegExp.$1, 10);
      }

      if (a == null) continue;

      let count = 0;
      if (typeof v === "number") count = v;
      else if (typeof v === "object") {
        // tìm field hợp lý: count/value/num...
        count = Number(v.count ?? v.value ?? v.num ?? v.cnt ?? 0);
      }

      if (Number.isFinite(count)) {
        out.push({ area: a, count });
      }
    }

    // sắp xếp theo area tăng dần
    out.sort((x, y) => x.area - y.area);
    return out;
  }

  function updatePestAlertUI(items) {
    const list = pestEl.querySelector("#pestList");
    if (!list) return;

    // chỉ giữ các ô có count > 0
    const bad = items.filter(it => Number(it.count) > 0);

    if (bad.length === 0) {
      pestEl.style.display = "none";
      pestEl.className = "";        // remove warn/blink
      list.innerHTML = "";
      return;
    }

    // render danh sách
    list.innerHTML = bad.map(it => {
      const n = it.count;
      const label = n === 1 ? "pest" : "pests";
      return `
        <div class="item">
          <span class="area">${areaLabel(it.area)}</span>
          <span class="cnt">${n} ${label}</span>
        </div>
      `;
    }).join("");

    pestEl.style.display = "flex";
    pestEl.className = "warn blink";
    pestEl.title = bad.map(it => `${areaLabel(it.area)}: ${it.count}`).join(" • ");
  }

  // Lắng nghe RTDB: /rasp/detect
  try {
    const fb = await waitForFirebase();
    if (fb && fb.db) {
      const detectRef = ref(fb.db, "rasp/detect");
      onValue(detectRef, (snap) => {
        const raw = snap.val() || {};
        const items = normalizePestCounts(raw);
        updatePestAlertUI(items);
      }, (err) => {
        console.error("pest listener error:", err);
      });
    }
  } catch (e) {
    console.error("init pest alert failed:", e);
  }

}

document.addEventListener("DOMContentLoaded", loadNavbar);
