const map = L.map('map').setView([37.5665, 126.9780], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);
const startBtn = document.getElementById('startBtn');

startBtn.addEventListener('click', function () {
  console.log('러닝 시작 버튼 클릭됨');
});
