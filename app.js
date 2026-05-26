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
let lastValidPosition = null;
let totalDistance = 0; // meters
const distanceDisplay = document.getElementById('distance');

const MAX_ACCURACY = 200; // meters
const MIN_DISTANCE = 5; // meters
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;

  const toRad = function (value) {
    return value * Math.PI / 180;
  };

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
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
const accuracy = position.coords.accuracy;

console.log(latitude, longitude, accuracy);

if (accuracy > MAX_ACCURACY) {
  console.log('GPS 정확도 낮음, 좌표 무시:', accuracy);
  return;
}

if (lastValidPosition) {
  const distanceFromLast = calculateDistance(
    lastValidPosition.latitude,
    lastValidPosition.longitude,
    latitude,
    longitude
  );

  if (distanceFromLast < MIN_DISTANCE) {
    console.log('이동 거리 너무 짧음, 좌표 무시:', distanceFromLast);
    return;
  }
    totalDistance += distanceFromLast;
  distanceDisplay.textContent = (totalDistance / 1000).toFixed(2) + ' km';
  console.log('총 이동거리:', totalDistance);
}

lastValidPosition = {
  latitude: latitude,
  longitude: longitude
};

routeCoordinates.push([latitude, longitude]);

console.log(routeCoordinates);

    map.panTo([latitude, longitude]);

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
});
pauseBtn.addEventListener('click', function () {
  console.log('일시정지 버튼 클릭됨');
  clearInterval(timerInterval);
  navigator.geolocation.clearWatch(watchId);
  console.log('pause watchId 종료:', watchId);
  watchId = null;
  isRunning = false;
});
stopBtn.addEventListener('click', function () {
  console.log('러닝 종료 버튼 클릭됨');
clearInterval(timerInterval);
navigator.geolocation.clearWatch(watchId);
console.log('watchId 종료:', watchId);
watchId = null;
seconds = 0;
timer.textContent = '00:00';
totalDistance = 0;
distanceDisplay.textContent = '0.00 km';
routeCoordinates = [];
lastValidPosition = null;
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