const map = L.map('map').setView([37.5665, 126.9780], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const timer = document.getElementById('timer');

let seconds = 0;
let timerInterval;
let isRunning = false;
let currentMarker;
let routeCoordinates = [];
let routeLine;
let watchId;
startBtn.addEventListener('click', function () {
  console.log('러닝 시작 버튼 클릭됨');
if (!isRunning) {
  isRunning = true;

  timerInterval = setInterval(function () {
    seconds++;

    const minutes = String(Math.floor(seconds / 60)).padStart(2, '0');
    const remainingSeconds = String(seconds % 60).padStart(2, '0');

    timer.textContent = `${minutes}:${remainingSeconds}`;

    console.log('타이머 실행 중:', timer.textContent);
  }, 1000);
watchId = navigator.geolocation.watchPosition(
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
}
console.log('VERCEL TEST SUCCESS');
});
pauseBtn.addEventListener('click', function () {
  console.log('일시정지 버튼 클릭됨');
  clearInterval(timerInterval);
  navigator.geolocation.clearWatch(watchId);
  console.log('pause watchId 종료:', watchId);
  isRunning = false;
});
stopBtn.addEventListener('click', function () {
  console.log('러닝 종료 버튼 클릭됨');
clearInterval(timerInterval);
navigator.geolocation.clearWatch(watchId);
console.log('watchId 종료:', watchId);

seconds = 0;
timer.textContent = '00:00';

routeCoordinates = [];

if (routeLine) {
  map.removeLayer(routeLine);
  routeLine = null;
}

if (currentMarker) {
  map.removeLayer(currentMarker);
  currentMarker = null;
}

isRunning = false;
});