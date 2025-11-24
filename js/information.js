const members = [
  {
    name: "Nguyễn Hải Sản",
    job: "Viết báo cáo, thiết lập phần cứng",
    gender: "Nam",
    hobby: "Đá bóng, nghe nhạc, du lịch",
    img: "image/mytran.png"
  },
  {
    name: "Lâm Nhã Trúc",
    job: "Viết chương trình ESP32, làm Powerpoint thuyết trình",
    gender: "Nữ",
    hobby: "Đọc sách, du lịch, chụp ảnh",
    img: "image/truc.png"
  },
  {
    name: "Nguyễn Phúc Vinh",
    job: "Viết chương trình ESP32 & kết nối dữ liệu",
    gender: "Nam",
    hobby: "Lập trình, chơi game, đá bóng",
    img: "image/vinh.png"
  },
  {
    name: "Trần Hữu Triết",
    job: "Thiết kế mạch điện, thiết kế phần cứng",
    gender: "Nam",
    hobby: "Chơi game, nghe nhạc, đi phượt",
    img: "image/Triet.png"
  },
  {
    name: "Nguyễn Quốc Tứ",
    job: "Thiết kế giao diện & kết nối dữ liệu",
    gender: "Nam",
    hobby: "Đá bóng, nghe nhạc, đi phượt",
    img: "image/tu.png"
  }
];

const cards = document.querySelectorAll(".member-card");
const popup = document.getElementById("popup");
const popupImg = document.getElementById("popupImg");
const popupName = document.getElementById("popupName");
const popupJob = document.getElementById("popupJob");
const popupGender = document.getElementById("popupGender");
const popupHobby = document.getElementById("popupHobby");
const closePopup = document.getElementById("closePopup");

cards.forEach(card => {
  card.addEventListener("click", () => {
    const id = parseInt(card.dataset.member) - 1;
    const member = members[id];

    popupImg.src = member.img;
    popupName.textContent = member.name;
    popupJob.textContent = member.job;
    popupGender.textContent = member.gender;
    popupHobby.textContent = member.hobby;

    popup.style.display = "flex";
  });
});

closePopup.addEventListener("click", () => {
  popup.style.display = "none";
});

window.addEventListener("click", e => {
  if (e.target === popup) popup.style.display = "none";
});
