// ===== Firebase setup =====
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyC-wfBTitH3VO9hbINx7dUqgUMNJi_BYVo",
  authDomain: "kc326e-1.firebaseapp.com",
  databaseURL: "https://kc326e-1-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kc326e-1",
  storageBucket: "kc326e-1.firebasestorage.app",
  messagingSenderId: "758660267895",
  appId: "1:758660267895:web:10a708ab2d5aff3ecceb72"
};

// dùng lại app nếu đã init ở file khác
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

document.addEventListener("DOMContentLoaded", () => {
  const wifiBox  = document.getElementById("wifiMonitor");
  const wifiHint = document.getElementById("wifiHint");

  let currentWifiState = 0;  // đọc từ Data/Wifi/state
  let prevTimeStamp    = 0;  // giá trị timeStamp gần nhất từ ESP
  let lastPacketAt     = 0;  // THỜI ĐIỂM (trên browser) nhận được gói mới gần nhất

  const STALE_MS   = 4000;   // quá 4s không có gói mới -> offline
  const CHECK_MS   = 1500;   // chu kỳ kiểm tra

  function setWifiState(state) {
    if (!wifiBox) return;

    wifiBox.classList.remove("wifi-offline", "wifi-weak", "wifi-medium", "wifi-strong");

    switch (state) {
      case 1:
        wifiBox.classList.add("wifi-weak");
        if (wifiHint) wifiHint.textContent = "WiFi: weak";
        break;
      case 2:
        wifiBox.classList.add("wifi-medium");
        if (wifiHint) wifiHint.textContent = "WiFi: medium";
        break;
      case 3:
        wifiBox.classList.add("wifi-strong");
        if (wifiHint) wifiHint.textContent = "WiFi: strong";
        break;
      default:
        wifiBox.classList.add("wifi-offline");
        if (wifiHint) wifiHint.textContent = "WiFi: offline";
        break;
    }
  }

  // 1) nghe mức sóng
  const wifiStateRef = ref(db, "Data/Wifi/state");
  onValue(wifiStateRef, (snap) => {
    const val = snap.val();
    currentWifiState = Number(val) || 0;

    // nếu đang ONLINE (tức là đã có gói trong 4s gần đây) thì cập nhật luôn UI
    if (lastPacketAt && Date.now() - lastPacketAt <= STALE_MS) {
      setWifiState(currentWifiState);
    }
  });

  // 2) nghe biến thay đổi
  const wifiTsRef = ref(db, "Data/Wifi/timeStamp");
  onValue(wifiTsRef, (snap) => {
    const ts = Number(snap.val()) || 0;
    if (ts !== prevTimeStamp) {
      prevTimeStamp = ts;
      lastPacketAt = Date.now();
      setWifiState(currentWifiState);     // hiển thị theo mức sóng hiện tại
    }
  });

  // 3) timer: nếu quá lâu không có gói mới -> offline
  setInterval(() => {
    if (!lastPacketAt) {
      // chưa từng nhận gói nào
      setWifiState(0);
      return;
    }

    const diff = Date.now() - lastPacketAt;
    if (diff > STALE_MS) {
      setWifiState(0);
    }
  }, CHECK_MS);
});
