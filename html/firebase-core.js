// js/firebase-core.js
// ===== Firebase setup (dùng chung) =====
import {
  initializeApp,
  getApps,
  getApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  set
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import {
  getAuth
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyC-wfBTitH3VO9hbINx7dUqgUMNJi_BYVo",
  authDomain: "kc326e-1.firebaseapp.com",
  databaseURL: "https://kc326e-1-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kc326e-1",
  storageBucket: "kc326e-1.firebasestorage.app",
  messagingSenderId: "758660267895",
  appId: "1:758660267895:web:10a708ab2d5aff3ecceb72"
};

// ✅ KHÔNG khởi tạo lại nếu đã có app trước đó
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// ✅ hàm log dùng v10, GHI ĐÈ 1 tag
async function logLoginAttemptV10(email, status) {
  const now = new Date();
  const formattedTime =
    now.getFullYear() + "-" +
    String(now.getMonth() + 1).padStart(2, "0") + "-" +
    String(now.getDate()).padStart(2, "0") + " " +
    String(now.getHours()).padStart(2, "0") + ":" +
    String(now.getMinutes()).padStart(2, "0") + ":" +
    String(now.getSeconds()).padStart(2, "0");

  const loginRef = ref(db, "Login");
  await set(loginRef, {
    email: email || "(empty)",
    loginStat: status,
    time: formattedTime
  });
}

// ✅ expose ra global
// thêm .ready để file khác WAIT được
const coreObj = {
  app,
  db,
  auth,
  logLoginAttempt: logLoginAttemptV10,
  ready: Promise.resolve()  // để chỗ khác await được
};

window.kc326e = coreObj;
