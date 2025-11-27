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

// ===== DATA (mock) =====
const MEMBERS = [
  {
    id: 1,
    name: "Nguyen Hai San",
    studentId: "B2207426",
    role: "Presentation slides (Main), Hardware design",
    gender: "Male",
    hobby: "Electronics, football",
    img: "image/mytran.png"
  },
  {
    id: 2,
    name: "Lam Nha Truc",
    studentId: "B2207445",
    role: "Code Programming ESP32 + Raspberry (Main), Presentation slides",
    gender: "Female",
    hobby: "Read book, Cooking",
    img: "image/truc.png"
  },
  {
    id: 3,
    name: "Nguyen Phuc Vinh",
    studentId: "B2207449",
    role: "Code Programming ESP32 + Raspberry, Web interface / UI (Main), Code React-Native",
    gender: "Male",
    hobby: "Backend stuff, gaming 🎮",
    img: "image/vinh.png"
  },
  {
    id: 4,
    name: "Tran Huu Triet",
    studentId: "B2207444",
    role: "Circuit and Hardware design (Main)",
    gender: "Male",
    hobby: "Robotics, 3D models",
    img: "image/Triet.png"
  },
  {
    id: 5,
    name: "Nguyen Quoc Tu",
    studentId: "B2207447",
    role: "Web interface / UI, Hardware design, Code React-native (Main)",
    gender: "Male",
    hobby: "Frontend, animations, music 🎧",
    img: "image/tu.png"
  },
];

const cards = document.querySelectorAll(".member-card");
const carousel = document.getElementById("teamCarousel");

// popup
const popup = document.getElementById("popup");
const popupImg = document.getElementById("popupImg");
const popupName = document.getElementById("popupName");
const popupId = document.getElementById("popupId");
const popupJob = document.getElementById("popupJob");
const popupGender = document.getElementById("popupGender");
const popupHobby = document.getElementById("popupHobby");
const closePopup = document.getElementById("closePopup");

// ===== helper: sắp xếp vị trí 5 card =====
function setPositions(activeIndex) {
  // ta sẽ map 5 vị trí: 0..4 -> pos-1 .. pos-5
  const order = [ "pos-1", "pos-2", "pos-3", "pos-4", "pos-5" ];

  cards.forEach((card, idx) => {
    // clear pos cũ
    order.forEach(c => card.classList.remove(c));
    card.classList.remove("active");
  });

  // với 5 phần tử, ta xoay vòng được
  // activeIndex -> pos-3
  // (activeIndex -1) -> pos-2
  // (activeIndex -2) -> pos-1
  // (activeIndex +1) -> pos-4
  // (activeIndex +2) -> pos-5

  const total = cards.length;

  function norm(i) {
    return (i + total) % total;
  }

  cards[norm(activeIndex - 2)].classList.add("pos-1");
  cards[norm(activeIndex - 1)].classList.add("pos-2");
  cards[norm(activeIndex     )].classList.add("pos-3", "active");
  cards[norm(activeIndex + 1)].classList.add("pos-4");
  cards[norm(activeIndex + 2)].classList.add("pos-5");
}

// ===== hiển thị popup =====
function showPopup(memberId) {
  const m = MEMBERS.find(m => m.id === memberId);
  if (!m) return;
  popupImg.src = m.img;
  popupName.textContent = m.name;
  popupId.textContent = m.studentId;
  popupJob.textContent = m.role;
  popupGender.textContent = m.gender;
  popupHobby.textContent = m.hobby;
  popup.style.display = "flex";
}

closePopup.addEventListener("click", () => {
  popup.style.display = "none";
});
popup.addEventListener("click", (e) => {
  if (e.target === popup) popup.style.display = "none";
});

// ===== init =====
let currentIndex = 0;
setPositions(currentIndex);

// hover: chỉ đổi focus (không mở popup)
cards.forEach((card, idx) => {
  card.addEventListener("mouseenter", () => {
    currentIndex = idx;
    setPositions(currentIndex);
  });

  card.addEventListener("click", () => {
    const id = Number(card.dataset.member);
    showPopup(id);
  });
});

// optional: auto-slide nhẹ cho sinh động
let autoTimer = setInterval(() => {
  currentIndex = (currentIndex + 1) % cards.length;
  setPositions(currentIndex);
}, 8000);

// nếu user hover cả carousel -> dừng auto
carousel.addEventListener("mouseenter", () => {
  clearInterval(autoTimer);
});
carousel.addEventListener("mouseleave", () => {
  autoTimer = setInterval(() => {
    currentIndex = (currentIndex + 1) % cards.length;
    setPositions(currentIndex);
  }, 8000);
});
