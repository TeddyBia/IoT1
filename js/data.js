document.addEventListener("DOMContentLoaded", () => {
  const API_BASE   = "https://nick-legendary-typically-connectors.trycloudflare.com";

  const API_DETECT = `${API_BASE}/api/rasp-detect`;
  const API_LOGIN  = `${API_BASE}/api/login-stat`;
  const API_PLANT  = `${API_BASE}/api/plant-details-sensor`;

  const statusEl    = document.getElementById("status");
  const tbodyDetect = document.getElementById("tbody-detect");
  const tbodyLogin  = document.getElementById("tbody-login");
  const tbodyEvents = document.getElementById("tbody-events");
  const tbodyWifi   = document.getElementById("tbody-wifi");

  // ===== UTIL: đảm bảo có db Firebase để đọc RTDB (ưu tiên dùng firebase-core.js nếu đã gắn window.db) =====
  let _db = null, _onValue = null, _ref = null;
  async function ensureFirebaseDb() {
    if (_db) return _db;

    // Trường hợp firebase-core.js đã init và gắn sẵn
    if (window.db && window.firebaseOnValue && window.firebaseRef) {
      _db = window.db;
      _onValue = window.firebaseOnValue;
      _ref = window.firebaseRef;
      return _db;
    }

    // Fallback: tự import module (ES dynamic import)
    try {
      const [{ initializeApp }, { getDatabase, ref, onValue }] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js"),
      ]);

      // Nếu firebase-core.js có public config trên window, ưu tiên dùng
      const firebaseConfig = window.firebaseConfig || {
        apiKey: "AIzaSyC-wfBTitH3VO9hbINx7dUqgUMNJi_BYVo",
        authDomain: "kc326e-1.firebaseapp.com",
        databaseURL: "https://kc326e-1-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "kc326e-1",
        storageBucket: "kc326e-1.firebasestorage.app",
        messagingSenderId: "758660267895",
        appId: "1:758660267895:web:10a708ab2d5aff3ecceb72"
      };

      const app = initializeApp(firebaseConfig);
      _db = getDatabase(app);
      _onValue = onValue;
      _ref = ref;

      // gắn tạm vào window để các file khác có thể dùng lại
      window.db = _db;
      window.firebaseOnValue = _onValue;
      window.firebaseRef = _ref;

      return _db;
    } catch (e) {
      console.error("Firebase init error:", e);
      return null;
    }
  }

  // ===== LOAD DETECT =====
  async function loadDetect() {
    try {
      const res = await fetch(API_DETECT);
      if (!res.ok) {
        if (statusEl) statusEl.textContent = "HTTP error (detect): " + res.status;
        return;
      }
      const data = await res.json();
      if (tbodyDetect) tbodyDetect.innerHTML = "";

      const sum = { a1:0, a2:0, a3:0, a4:0, l1:"", l2:"", l3:"", l4:"" };

      data.forEach(row => {
        const a1 = Number(row.area1) || 0;
        const a2 = Number(row.area2) || 0;
        const a3 = Number(row.area3) || 0;
        const a4 = Number(row.area4) || 0;

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${row.id}</td>
          <td><span class="tag area1 ${a1 > 0 ? "danger" : ""}">${a1}</span></td>
          <td><span class="tag area2 ${a2 > 0 ? "danger" : ""}">${a2}</span></td>
          <td><span class="tag area3 ${a3 > 0 ? "danger" : ""}">${a3}</span></td>
          <td><span class="tag area4 ${a4 > 0 ? "danger" : ""}">${a4}</span></td>
          <td>${row.time ? new Date(row.time).toLocaleString() : ""}</td>
        `;
        if (tbodyDetect) tbodyDetect.appendChild(tr);

        const timeStr = row.time ? new Date(row.time).toLocaleString() : "";
        if (a1) { sum.a1++; sum.l1 = timeStr; }
        if (a2) { sum.a2++; sum.l2 = timeStr; }
        if (a3) { sum.a3++; sum.l3 = timeStr; }
        if (a4) { sum.a4++; sum.l4 = timeStr; }
      });
    } catch (err) {
      if (statusEl) statusEl.textContent = "❌ Cannot reach detection API";
      console.error(err);
    }
  }

  // ===== LOAD LOGIN =====
  async function loadLogin() {
    if (!tbodyLogin) return;
    try {
      const res = await fetch(API_LOGIN);
      if (!res.ok) {
        console.warn("login api error", res.status);
        return;
      }
      const data = await res.json();
      tbodyLogin.innerHTML = "";

      if (!data.length) {
        tbodyLogin.innerHTML = `<tr><td colspan="4" style="opacity:.6;">No login record found</td></tr>`;
        return;
      }

      data.forEach(item => {
        const status = (item.loginStat || "").toLowerCase();
        const isSuccess = status.includes("success");
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${item.id}</td>
          <td>${item.email || "-"}</td>
          <td>
            <span class="login-pill ${isSuccess ? "login-success" : "login-fail"}">
              <i class="fa-solid ${isSuccess ? "fa-circle-check" : "fa-triangle-exclamation"}"></i>
              ${item.loginStat || "-"}
            </span>
          </td>
          <td>${item.time ? new Date(item.time).toLocaleString() : ""}</td>
        `;
        tbodyLogin.appendChild(tr);
      });
    } catch (err) {
      console.error("login load error:", err);
    }
  }

  // ===== LOAD PLANT / SENSOR → EVENTS =====
  async function loadPlantEvents() {
    if (!tbodyEvents) return;
    try {
      const res = await fetch(API_PLANT);
      if (!res.ok) {
        console.warn("plant api error", res.status);
        return;
      }
      const data = await res.json();
      tbodyEvents.innerHTML = "";

      if (!data.length) {
        tbodyEvents.innerHTML = `<tr><td colspan="11" style="opacity:.55;">No plant/sensor record</td></tr>`;
        return;
      }

      data.forEach(row => {
        // ép về số để so sánh
        const tmin = Number(row.tmin);
        const tmax = Number(row.tmax);
        const hmin = Number(row.hmin);
        const hmax = Number(row.hmax);
        const temp = Number(row.temperature);
        const hum  = Number(row.humidity);

        // điều kiện cảnh báo
        let isAlert = false;

        if (!Number.isNaN(temp) && !Number.isNaN(tmin) && !Number.isNaN(tmax)) {
          if (temp < tmin || temp > tmax) isAlert = true;
        }
        if (!Number.isNaN(hum) && !Number.isNaN(hmin) && !Number.isNaN(hmax)) {
          if (hum < hmin || hum > hmax) isAlert = true;
        }

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${row.id}</td>
          <td>${row.plantName || "-"}</td>
          <td>${row.tmin ?? "-"}</td>
          <td>${row.tmax ?? "-"}</td>
          <td>${row.hmin ?? "-"}</td>
          <td>${row.hmax ?? "-"}</td>
          <td>${row.temperature ?? "-"}</td>
          <td>${row.humidity ?? "-"}</td>
          <td>${row.ldr ?? "-"}</td>
          <td>${row.airQuality ?? "-"}</td>
          <td>${row.time ? new Date(row.time).toLocaleString() : ""}</td>
        `;
        if (isAlert) {
          tr.classList.add("row-alert");
          tr.style.background = "rgba(237,71,71,0.12)";
          tr.style.boxShadow  = "inset 0 1px 0 rgba(237,71,71,0.35)";
        }
        tbodyEvents.appendChild(tr);
      });
    } catch (err) {
      console.error("plant/sensor load error:", err);
    }
  }

  // ===== WIFI LIST (RTDB: Data/Flash) =====
  async function initWifiRealtime() {
    if (!tbodyWifi) return;

    const db = await ensureFirebaseDb();
    if (!db || !_onValue || !_ref) {
      console.warn("Firebase DB not ready – cannot read Data/Flash");
      tbodyWifi.innerHTML = `<tr><td colspan="4" style="opacity:.6;">Firebase not ready</td></tr>`;
      return;
    }

    const flashRef = _ref(db, "Data/Flash");
    // Lắng nghe realtime
    _onValue(flashRef, (snap) => {
      const val = snap.val() || {};
      renderWifiRows(val);
    }, (err) => {
      console.error("onValue(Data/Flash) error:", err);
      tbodyWifi.innerHTML = `<tr><td colspan="4" style="opacity:.6;">RTDB error</td></tr>`;
    });
  }

  function renderWifiRows(flashObj) {
    if (!tbodyWifi) return;

    // Lọc các key bắt đầu bằng 'Wifi' (không phân biệt hoa thường)
    const entries = Object.entries(flashObj)
      .filter(([k]) => /^wifi\d+/i.test(k))
      // sắp xếp theo số phía sau Wifi (Wifi0, Wifi1, ...)
      .sort(([k1], [k2]) => {
        const n1 = parseInt(k1.replace(/^\D+/g, ""), 10);
        const n2 = parseInt(k2.replace(/^\D+/g, ""), 10);
        return (isNaN(n1) ? 0 : n1) - (isNaN(n2) ? 0 : n2);
      });

    tbodyWifi.innerHTML = "";

    if (!entries.length) {
      tbodyWifi.innerHTML = `<tr><td colspan="4" style="opacity:.6;">No Wifi entries under Data/Flash</td></tr>`;
      return;
    }

    let idx = 1;
    for (const [key, val] of entries) {
      const ssid = (val && (val.ssid ?? val.SSID)) ?? "-";
      const pwd  = (val && (val.pwd  ?? val.password ?? val.pass)) ?? "-";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${idx++}</td>
        <td>${key}</td>
        <td>${ssid}</td>
        <td>${pwd}</td>
      `;
      tbodyWifi.appendChild(tr);
    }
  }

  // ===== gọi lần đầu (3 panel từ SQL qua Flask) =====
  loadDetect();
  loadLogin();
  loadPlantEvents();

  // ===== lặp 5s cho 3 panel SQL =====
  setInterval(() => {
    loadDetect();
    loadLogin();
    loadPlantEvents();
  }, 2000);

  // ====== OVERLAY (dim) + MENU ======
  const dimLayer = document.createElement("div");
  dimLayer.className = "data-dim-layer";
  document.body.appendChild(dimLayer);

  createSemiMenu();
  setupPanelSwitching();

  // Khởi tạo realtime Wi-Fi ngay từ đầu (độc lập panel)
  initWifiRealtime();

  function createSemiMenu() {
    const menu = document.createElement("div");
    menu.className = "radial-menu";
    menu.innerHTML = `
      <!-- MAIN BTN -->
      <div class="menu-toggle" aria-label="Open data menu">
        <div class="menu-toggle-inner">
          <i class="fa-solid fa-chart-line main-icon"></i>
        </div>
        <span class="menu-label">Panels</span>
      </div>

      <!-- 4 ITEMS -->
      <div class="menu-items">
        <div class="menu-item item-1" data-target="detect" title="Detection stream">
          <i class="fa-solid fa-bug"></i>
        </div>
        <div class="menu-item item-2" data-target="events" title="Plant & sensor snapshot">
          <i class="fa-solid fa-seedling"></i>
        </div>
        <div class="menu-item item-3" data-target="login" title="Login activity">
          <i class="fa-solid fa-user-shield"></i>
        </div>
        <div class="menu-item item-4" data-target="wifi" title="Wi-Fi list (RTDB)">
          <i class="fa-solid fa-wifi"></i>
        </div>
      </div>
    `;
    document.body.appendChild(menu);

    const toggle = menu.querySelector(".menu-toggle");
    toggle.addEventListener("click", () => {
      const isOpen = menu.classList.toggle("open");
      if (isOpen) {
        dimLayer.classList.add("show");
      } else {
        dimLayer.classList.remove("show");
      }
    });

    // click ra ngoài để đóng
    dimLayer.addEventListener("click", () => {
      menu.classList.remove("open");
      dimLayer.classList.remove("show");
    });
  }

  function setupPanelSwitching() {
    const panels = document.querySelectorAll(".data-panel");
    const menu = document.querySelector(".radial-menu");
    const items = menu.querySelectorAll(".menu-item");

    items.forEach(item => {
      item.addEventListener("click", () => {
        const target = item.getAttribute("data-target");

        // active nút
        items.forEach(i => i.classList.remove("active"));
        item.classList.add("active");

        // show panel
        panels.forEach(p => {
          if (p.getAttribute("data-panel") === target) {
            p.classList.remove("hidden");
          } else {
            p.classList.add("hidden");
          }
        });

        // close menu
        menu.classList.remove("open");
        dimLayer.classList.remove("show");
      });
    });

    // mặc định mở detect
    const first = menu.querySelector('.menu-item[data-target="detect"]');
    if (first) first.classList.add("active");
  }
  // link tham khảo: https://www.jsdelivr.com/package/npm/xlsx-js-style
  // ====== EXPORT (có style, auto-fit, dùng XLSX.writeFile) ======
function timestampName(){
  const d = new Date();
  const pad = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

// ===== STYLE PRESET =====
const borderThin = { style: "thin", color: { rgb: "FFB7B7B7" } };
const baseCell = {
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: { top: borderThin, right: borderThin, bottom: borderThin, left: borderThin }
};
const styleHeader = {
  font: { bold: true, color: { rgb: "FF103A23" } },
  fill: { patternType: "solid", fgColor: { rgb: "FFE6F7EE" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: { top: borderThin, right: borderThin, bottom: borderThin, left: borderThin }
};
const styleDangerCell = {
  font: { color: { rgb: "FFFFFFFF" }, bold: true },
  fill: { patternType: "solid", fgColor: { rgb: "FFED4747" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: { top: borderThin, right: borderThin, bottom: borderThin, left: borderThin }
};
const styleRowAlert = {
  fill: { patternType: "solid", fgColor: { rgb: "FFFDE3E3" } },
  alignment: { horizontal: "center", vertical: "center", wrapText: true },
  border: { top: borderThin, right: borderThin, bottom: borderThin, left: borderThin }
};

// gộp style (deep merge)
function mergeStyle(a={}, b={}) {
  const out = JSON.parse(JSON.stringify(a));
  for (const k in b) {
    if (typeof b[k] === "object" && b[k] && !Array.isArray(b[k])) {
      out[k] = mergeStyle(out[k] || {}, b[k]);
    } else out[k] = b[k];
  }
  return out;
}

// tính độ rộng ký tự để auto-fit
function charW(str) {
  if (!str) return 0;
  let w = 0;
  for (const ch of String(str)) w += /[ -~]/.test(ch) ? 1 : 1.6;
  return w;
}

// lấy AOA + style matrix từ bảng
function tableToAOAAndStyles(tableEl){
  const aoa = [], styles = [];

  // THEAD
  const thead = tableEl.querySelector("thead");
  if (thead){
    const tr = thead.querySelector("tr");
    const row = [], sty = [];
    tr.querySelectorAll("th").forEach(th=>{
      row.push((th.textContent || "").trim());
      sty.push(styleHeader);
    });
    aoa.push(row); styles.push(sty);
  }

  // TBODY
  const tbody = tableEl.querySelector("tbody");
  if (tbody){
    tbody.querySelectorAll("tr").forEach(tr=>{
      const row = [], sty = [];
      const isRowAlert = tr.classList.contains("row-alert");

      tr.querySelectorAll("td").forEach(td=>{
        let txt = td.innerText ?? td.textContent ?? "";
        txt = String(txt).replace(/\r/g,"").replace(/\u00A0/g," ").trim();
        row.push(txt);

        const hasDanger = td.querySelector(".tag.danger, .tag.has-detect");
        const isLogout  = /Logout/i.test(td.textContent || ""); 
        let cellStyle = baseCell;
        if (hasDanger || isLogout) cellStyle = mergeStyle(cellStyle, styleDangerCell);
        else if (isRowAlert) cellStyle = mergeStyle(cellStyle, styleRowAlert);
        sty.push(cellStyle);
      });

      aoa.push(row);
      styles.push(sty);
    });
  }
  return { aoa, styles };
}

// tạo worksheet từ bảng HTML (có style + auto-fit)
function sheetFromTableStyled(tableEl, sheetName="Sheet1"){
  const { aoa, styles } = tableToAOAAndStyles(tableEl);
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  for (let r=0; r<styles.length; r++){
    for (let c=0; c<styles[r].length; c++){
      const addr = XLSX.utils.encode_cell({r,c});
      if (!ws[addr]) ws[addr] = { t:'s', v:'' };
      const st = styles[r][c];
      if (st && Object.keys(st).length) ws[addr].s = st;
    }
  }

  // auto-fit column width
  const colCount = aoa.reduce((m,r)=>Math.max(m,r.length),0);
  const maxW = Array(colCount).fill(8);
  for (let r=0;r<aoa.length;r++){
    for (let c=0;c<colCount;c++){
      const val = (aoa[r] && aoa[r][c]!=null)?String(aoa[r][c]):"";
      maxW[c] = Math.max(maxW[c], charW(val));
    }
  }
  ws["!cols"] = maxW.map(w=>({wch: Math.max(6,Math.min(Math.round(w+2),40))}));
  if (aoa.length) ws["!rows"] = [{ hpt: 22 }];
  return ws;
}

// ===== EXPORT 1 BẢNG =====
function exportTableToXLSX(tableEl, sheetName="Sheet1"){
  if (!tableEl) return;
  const wb = XLSX.utils.book_new();
  const ws = sheetFromTableStyled(tableEl, sheetName.slice(0,31));
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0,31));
  const file = `greenhouse_${sheetName}_${timestampName()}.xlsx`;
  XLSX.writeFile(wb, file);   // <-- lưu trực tiếp như ví dụ của bạn
}

// ===== EXPORT TẤT CẢ =====
function exportAllPanelsToOneWorkbook(){
  const wb = XLSX.utils.book_new();
  const addSheet = (selector, name)=>{
    const table = document.querySelector(selector);
    if (!table) return;
    const ws = sheetFromTableStyled(table, name.slice(0,31));
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0,31));
  };
  addSheet('[data-panel="detect"] table',"detect");
  addSheet('[data-panel="events"] table',"events");
  addSheet('[data-panel="login"] table',"login");
  addSheet('[data-panel="wifi"] table',"wifi");
  const file = `greenhouse_all_${timestampName()}.xlsx`;
  XLSX.writeFile(wb, file);   // <-- ghi file trực tiếp
}

// gắn sự kiện cho các nút export
function setupExportButtons(){
  document.querySelectorAll(".btn-export").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const card = btn.closest(".data-panel");
      const table = card?.querySelector("table");
      const name  = btn.dataset.filename || card?.dataset.panel || "data";
      exportTableToXLSX(table, name);
    });
  });
  document.querySelectorAll(".btn-export-all").forEach(btn=>{
    btn.addEventListener("click", exportAllPanelsToOneWorkbook);
  });
}

// gọi sau khi DOM sẵn sàng
setupExportButtons();

});

