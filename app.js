const map = L.map('map').setView([37.5665, 126.9780], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);
const startBtn = document.getElementById('startBtn');

startBtn.addEventListener('click', function () {
  console.log('러닝 시작 버튼 클릭됨');

navigator.geolocation.getCurrentPosition(
  function (position) {
    console.log('GPS 성공');
    console.log(position);

    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;

    console.log(latitude, longitude);

    map.setView([latitude, longitude], 16);

    L.marker([latitude, longitude]).addTo(map)
      .bindPopup('현재 위치')
      .openPopup();
  },

  function (error) {
    console.log('GPS 에러 발생');
    console.log(error);
  },

  {
    enableHighAccuracy: true
  }
);
});
console.log('VERCEL TEST SUCCESS');

