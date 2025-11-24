// ============ FIREBASE =============
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-app.js";
import { getDatabase, ref, onValue, update } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-database.js";

const firebaseConfig = {
  apiKey:"AIzaSyDAPC5R3FZdiwmzO26T2gvVMUHO98CChdA",
  authDomain:"kc326e.firebaseapp.com",
  databaseURL:"https://kc326e-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:"kc326e",
  storageBucket:"kc326e.firebasestorage.app",
  messagingSenderId:"1073378109515",
  appId:"1:1073378109515:web:fba12dc5702ded368a85ce"
};
initializeApp(firebaseConfig);
const db = getDatabase();

// ============ DOM ===================
const Tmin = document.getElementById("Tsetmin");
const Tmax = document.getElementById("Tsetmax");
const Mmin = document.getElementById("Msetmin");
const Mmax = document.getElementById("Msetmax");

const TminVal = document.getElementById("TminVal");
const TmaxVal = document.getElementById("TmaxVal");
const MminVal = document.getElementById("MminVal");
const MmaxVal = document.getElementById("MmaxVal");

const Tnow = document.getElementById("Tnow");
const Mnow = document.getElementById("Mnow");

const LedA = document.getElementById("LedA");
const FanA = document.getElementById("FanA");
const MistingA = document.getElementById("MistingA");
const ServoA = document.getElementById("ServoA");

// ====== TRẠNG THÁI ĐỒNG BỘ ======
let setpointsLoaded = false;  // đã tải xong Tset/Mset từ Firebase chưa?
let sensorCache = null;       // cache {T, M} mới nhất
let applyingFromFirebase = false; // đang gán giá trị từ Firebase (không ghi ngược)

// ============ VẼ MÀU VÙNG SÁNG giữa MIN—MAX ============
function fillColor(minSlider, maxSlider, track) {
  const min = parseFloat(minSlider.value);
  const max = parseFloat(maxSlider.value);
  const maxRange = parseFloat(minSlider.max);

  const minPct = (min / maxRange) * 100;
  const maxPct = (max / maxRange) * 100;

  track.style.background = `linear-gradient(to right,
    #222 0%,
    #222 ${minPct}%,
    #00e5ff ${minPct}%,
    #00e5ff ${maxPct}%,
    #222 ${maxPct}%,
    #222 100%)`;
}

// ============ CẬP NHẬT GIÁ TRỊ SLIDER + MÀU + GỬI RTDB ============
function updateSetpoints() {
  // nếu đang gán từ Firebase thì không ghi ngược
  if (applyingFromFirebase) return;

  let tmin = +Tmin.value, tmax = +Tmax.value, mmin = +Mmin.value, mmax = +Mmax.value;

  // Không cho chồng thumb
  if (tmin >= tmax - 1) { tmin = tmax - 1; Tmin.value = tmin; }
  if (tmax <= tmin + 1) { tmax = tmin + 1; Tmax.value = tmax; }
  if (mmin >= mmax - 1) { mmin = mmax - 1; Mmin.value = mmin; }
  if (mmax <= mmin + 1) { mmax = mmin + 1; Mmax.value = mmax; }

  // Update label
  TminVal.textContent = tmin;  TmaxVal.textContent = tmax;
  MminVal.textContent = mmin;  MmaxVal.textContent = mmax;

  // Vẽ vùng sáng
  fillColor(Tmin, Tmax, Tmin.closest(".slider").querySelector(".slider-track"));
  fillColor(Mmin, Mmax, Mmin.closest(".slider").querySelector(".slider-track"));

  // Ghi setpoint
  update(ref(db,"Data/Auto"), { Tsetmin:tmin, Tsetmax:tmax, Msetmin:mmin, Msetmax:mmax });

  // Nếu đã có sensor thì chạy lại logic ngay
  if (setpointsLoaded && sensorCache) runAuto(sensorCache.T, sensorCache.M);
}

// Lắng nghe thay đổi slider
[Tmin,Tmax,Mmin,Mmax].forEach(s => s.addEventListener("input", updateSetpoints));

// ============ ĐỌC SENSOR ============
onValue(ref(db,"Data/Sensor"), snap => {
  const v = snap.val(); if (!v) return;
  const T = parseFloat(v.Temperature);
  const M = parseFloat(v.Humminity);   // giữ đúng key Firebase

  if (!isNaN(T)) Tnow.textContent = T.toFixed(1);
  if (!isNaN(M)) Mnow.textContent = M.toFixed(1);

  sensorCache = { T, M };
  if (setpointsLoaded) runAuto(T, M); // chỉ chạy khi setpoint đã sẵn sàng
});

// ============ ĐỌC GIÁ TRỊ SETPOINT TỪ FIREBASE ============
onValue(ref(db, "Data/Auto"), snap => {
  const v = snap.val(); if (!v) return;

  applyingFromFirebase = true; // chặn ghi ngược trong lúc set
  if (v.Tsetmin !== undefined) Tmin.value = v.Tsetmin;
  if (v.Tsetmax !== undefined) Tmax.value = v.Tsetmax;
  if (v.Msetmin !== undefined) Mmin.value = v.Msetmin;
  if (v.Msetmax !== undefined) Mmax.value = v.Msetmax;
  applyingFromFirebase = false;

  // Cập nhật hiển thị & màu
  TminVal.textContent = Tmin.value;
  TmaxVal.textContent = Tmax.value;
  MminVal.textContent = Mmin.value;
  MmaxVal.textContent = Mmax.value;

  fillColor(Tmin, Tmax, Tmin.closest(".slider").querySelector(".slider-track"));
  fillColor(Mmin, Mmax, Mmin.closest(".slider").querySelector(".slider-track"));

  // Đánh dấu đã load setpoint, nếu đã có sensor thì chạy logic ngay
  if (!setpointsLoaded) setpointsLoaded = true;
  if (sensorCache) runAuto(sensorCache.T, sensorCache.M);
});

// ============ LOGIC AUTO ============
function runAuto(T, M){
  const tmin=+Tmin.value, tmax=+Tmax.value, mmin=+Mmin.value, mmax=+Mmax.value;
  let led=0, fan=0, mist=0, servo=0;

  if (T < tmin) led = 80;
  if (T > tmax) fan = 80;
  if (M < mmin) mist = 80;
  if (M > mmax) { servo = 180; fan = 80; }

  // Hiển thị + màu
  LedA.textContent = led; FanA.textContent = fan; MistingA.textContent = mist; ServoA.textContent = servo;
  setStateColor(LedA, led); setStateColor(FanA, fan); setStateColor(MistingA, mist); setStateColor(ServoA, servo);

  // Gửi điều khiển
  update(ref(db,"Data/Auto"), { LedA:led, FanA:fan, MistingA:mist, ServoA:servo });
}

function setStateColor(el,val){ el.classList.toggle("on", val>0); el.classList.toggle("off", !(val>0)); }

// ============ KHỞI TẠO: vẽ màu lần đầu (phòng khi setpoint chưa về) ============
window.addEventListener("DOMContentLoaded", ()=>{
  fillColor(Tmin, Tmax, Tmin.closest(".slider").querySelector(".slider-track"));
  fillColor(Mmin, Mmax, Mmin.closest(".slider").querySelector(".slider-track"));
});
