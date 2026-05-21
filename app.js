const map = L.map('map').setView([37.5665, 126.9780], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);
const startBtn = document.getElementById('startBtn');
let currentMarker;
let routeCoordinates = [];
let routeLine;
startBtn.addEventListener('click', function () {
  console.log('러닝 시작 버튼 클릭됨');

navigator.geolocation.watchPosition(
  function (position) {
    console.log('GPS 성공');
    console.log(position);

    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;

    console.log(latitude, longitude);
    routeCoordinates.push([latitude, longitude]);

console.log(routeCoordinates);

    map.setView([latitude, longitude], 16);

   if (!currentMarker) {
  currentMarker = L.marker([latitude, longitude]).addTo(map);
routeLine = L.polyline(routeCoordinates).addTo(map);
  currentMarker
    .bindPopup('현재 위치')
    .openPopup();

} else {
  currentMarker.setLatLng([latitude, longitude]);
  routeLine.setLatLngs(routeCoordinates);
}
},

function (error) {
    console.log('GPS 에러 발생');
    console.log(error);
  },

  {
    enableHighAccuracy: true
  }
);
console.log('VERCEL TEST SUCCESS');
});

