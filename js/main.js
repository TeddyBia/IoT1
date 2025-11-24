// ===== Firebase setup =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDAPC5R3FZdiwmzO26T2gvVMUHO98CChdA",
  authDomain: "kc326e.firebaseapp.com",
  databaseURL: "https://kc326e-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kc326e",
  storageBucket: "kc326e.firebasestorage.app",
  messagingSenderId: "1073378109515",
  appId: "1:1073378109515:web:fba12dc5702ded368a85ce"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const wifiRef = ref(db, "Data/Wifi");

// DOM elements
const wifiIcon = document.getElementById("wifiIcon");
const wifiText = document.getElementById("wifiText");

// Biến theo dõi thời gian cập nhật
let lastTimeStamp = 0;
let lastUpdateTime = Date.now();
let disconnectTimer = null;

// Cập nhật icon theo state
function updateWifiState(state) {
  wifiIcon.className = "wifi-icon";
  switch (state) {
    case 1:
      wifiIcon.textContent = "3"; // 3 vạch
      wifiIcon.classList.add("wifi-strong");
      wifiText.textContent = "Wi-Fi mạnh";
      break;
    case 2:
      wifiIcon.textContent = "2"; // 2 vạch
      wifiIcon.classList.add("wifi-medium");
      wifiText.textContent = "Wi-Fi trung bình";
      break;
    case 3:
      wifiIcon.textContent = "1"; // 1 vạch
      wifiIcon.classList.add("wifi-weak");
      wifiText.textContent = "Wi-Fi yếu";
      break;
    default:
      wifiIcon.textContent = "📴"; // mất kết nối
      wifiIcon.classList.add("wifi-off");
      wifiText.textContent = "Không có kết nối Wi-Fi";
  }
}

// Theo dõi Firebase
onValue(wifiRef, (snapshot) => {
  const data = snapshot.val();
  if (!data) return;

  const { state, timeStamp } = data;

  // Nếu timestamp thay đổi → cập nhật thời gian cuối cùng
  if (timeStamp !== lastTimeStamp) {
    lastTimeStamp = timeStamp;
    lastUpdateTime = Date.now();
    updateWifiState(state);
  }

  // Kiểm tra nếu quá 3s không đổi → mất kết nối
  clearTimeout(disconnectTimer);
  disconnectTimer = setTimeout(() => {
    const diff = Date.now() - lastUpdateTime;
    if (diff >= 3000) {
      wifiIcon.textContent = "📴";
      wifiIcon.className = "wifi-icon wifi-off";
      wifiText.textContent = "Wi-Fi mất kết nối";
    }
  }, 3100);
});
