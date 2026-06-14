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
let routeLines = [];
let paused = false;
let watchId;
let lastValidPosition = null;
let totalDistance = 0; // meters
let recentPositions = [];
const SMOOTHING_COUNT = 3;
const distanceDisplay = document.getElementById('distance');
const paceDisplay = document.getElementById('pace');
const recordsList = document.getElementById('recordsList');
const recordsSection = document.getElementById('records');
const recordDetail = document.getElementById('recordDetail');
const backToRecordsBtn = document.getElementById('backToRecordsBtn');
const detailDate = document.getElementById('detailDate');
const detailTimeRange = document.getElementById('detailTimeRange');
const detailDistance = document.getElementById('detailDistance');
const detailDuration = document.getElementById('detailDuration');
const detailNumericPace = document.getElementById('detailNumericPace');
const detailMapElement = document.getElementById('detailMap');

let detailMap = null;
let detailRouteLine = null;

const MAX_ACCURACY = 100; // meters
const MIN_DISTANCE = 5; // meters
let runRecords = JSON.parse(localStorage.getItem('runRecords')) || [];
let runStartTime = null;
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
function getSmoothedPosition(latitude, longitude) {
  recentPositions.push({
    latitude: latitude,
    longitude: longitude
  });

  if (recentPositions.length > SMOOTHING_COUNT) {
    recentPositions.shift();
  }

  let latitudeSum = 0;
  let longitudeSum = 0;

  recentPositions.forEach(function (position) {
    latitudeSum += position.latitude;
    longitudeSum += position.longitude;
  });

  return {
    latitude: latitudeSum / recentPositions.length,
    longitude: longitudeSum / recentPositions.length
  };
}
function getEmotionalPaceLabel() {
  const labels = [
    '생각 정리 Pace',
    '마음 환기 Pace',
    '퇴근 후 회복 Pace',
    '감정 정돈 Pace',
    '오늘도 잘 버틴 Pace',
    '낭만 충전 Pace',
    '나를 돌보는 Pace'
  ];

  const randomIndex = Math.floor(Math.random() * labels.length);

  return labels[randomIndex];
}
function saveRunRecord() {
  const runEndTime = new Date();

  const record = {
    id: Date.now(),

    date: runEndTime.toLocaleDateString(),

    startTime: runStartTime.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    }),

    endTime: runEndTime.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    }),

    duration: timer.textContent,

    distance: (totalDistance / 1000).toFixed(2),

    pace: paceDisplay.textContent,

    emotionalPace: getEmotionalPaceLabel(),

    routeCoordinates: routeCoordinates.slice()
  };

  runRecords.unshift(record);

  localStorage.setItem(
    'runRecords',
    JSON.stringify(runRecords)
  );

  renderRunRecords();
renderRecordProfileFeed();

console.log('저장된 러닝 기록:', record);
}
function showDetailMap(record) {
  if (!record.routeCoordinates || record.routeCoordinates.length === 0) {
    detailMapElement.innerHTML = '';
    return;
  }

  if (!detailMap) {
    detailMap = L.map('detailMap');

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(detailMap);
  }

  if (detailRouteLine) {
    detailMap.removeLayer(detailRouteLine);
  }

  detailRouteLine = L.polyline(record.routeCoordinates, {
    color: '#facc15',
    weight: 6,
    opacity: 0.9,
    lineCap: 'round',
    lineJoin: 'round'
  }).addTo(detailMap);

  detailMap.fitBounds(detailRouteLine.getBounds(), {
    padding: [20, 20]
  });

  setTimeout(function () {
    detailMap.invalidateSize();
  }, 100);
}
function renderRunRecords() {
  recordsList.innerHTML = '';

 runRecords.sort(function (a, b) {
  return (b.id || 0) - (a.id || 0);
});

  runRecords.forEach(function (record) {
    const recordCard = document.createElement('div');
    recordCard.className = 'record-card';

    recordCard.innerHTML = `
      <div>${record.date}</div>
      <div>${record.startTime} ~ ${record.endTime}</div>
      <div>${record.distance} km</div>
      <div>${record.duration}</div>
      <div class="pace-toggle" data-showing="emotional">
  ${record.emotionalPace || '마음 환기 Pace'}
</div>
    `;
    recordCard.addEventListener('click', function () {
  detailDate.textContent = record.date;
  detailTimeRange.textContent = record.startTime + ' ~ ' + record.endTime;
  detailDistance.textContent = record.distance + ' km';
  detailDuration.textContent = record.duration;
  detailNumericPace.textContent = record.pace;
detailNumericPace.dataset.showing = 'number';
detailNumericPace.dataset.numericPace = record.pace;
detailNumericPace.dataset.emotionalPace = record.emotionalPace || '마음 환기 Pace';

  recordsSection.classList.add('hidden');
  recordDetail.classList.remove('hidden');
  showDetailMap(record);
});
const paceToggle = recordCard.querySelector('.pace-toggle');

paceToggle.addEventListener('click', function (event) {
  event.stopPropagation();

  if (paceToggle.dataset.showing === 'emotional') {
    paceToggle.textContent = record.pace;
    paceToggle.dataset.showing = 'number';
  } else {
    paceToggle.textContent = record.emotionalPace || '마음 환기 Pace';
    paceToggle.dataset.showing = 'emotional';
  }
});
    recordsList.appendChild(recordCard);
  });
}

function renderRecordProfileFeed() {
  const profileTotalDistanceHero = document.getElementById('profileTotalDistanceHero');
  const profileRunCountHero = document.getElementById('profileRunCountHero');
  const profileTotalDistance = document.getElementById('profileTotalDistance');
  const profileRunCount = document.getElementById('profileRunCount');
  const profileFollowers = document.getElementById('profileFollowers');
  const profileRecentRuns = document.getElementById('profileRecentRuns');

  const runCount = runRecords.length;

  const totalDistanceKm = runRecords.reduce(function (sum, record) {
    return sum + (Number(record.distance) || 0);
  }, 0);

  if (profileTotalDistanceHero) {
    profileTotalDistanceHero.textContent = totalDistanceKm.toFixed(1);
  }

  if (profileRunCountHero) {
    profileRunCountHero.textContent = runCount;
  }

  if (profileTotalDistance) {
    profileTotalDistance.textContent = totalDistanceKm.toFixed(1) + 'km';
  }

  if (profileRunCount) {
    profileRunCount.textContent = runCount;
  }

  if (profileFollowers) {
    profileFollowers.textContent = '0';
  }

  if (!profileRecentRuns) {
    return;
  }

  if (runRecords.length === 0) {
    profileRecentRuns.innerHTML = `
      <div class="feed-card small-feed-card">
        <strong>0.00km</strong>
        <span>아직 저장된 러닝 기록이 없습니다</span>
      </div>
    `;
    return;
  }

  profileRecentRuns.innerHTML = runRecords
    .slice(0, 3)
    .map(function (record) {
      return `
        <div class="feed-card small-feed-card">
          <strong>${record.distance}km</strong>
          <span>${record.emotionalPace || '마음 환기 Pace'}</span>
        </div>
      `;
    })
    .join('');
}

renderRunRecords();
renderRecordProfileFeed();

startBtn.addEventListener('click', function () {
  console.log('러닝 시작 버튼 클릭됨');
if (!isRunning) {
    if (seconds === 0) {
    runStartTime = new Date();
  }
if (paused) {
  routeCoordinates = [];
  routeLine = null;
  lastValidPosition = null;
  recentPositions = [];
  paused = false;
}
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
const smoothedPosition = getSmoothedPosition(latitude, longitude);
if (lastValidPosition) {
  const distanceFromLast = calculateDistance(
    lastValidPosition.latitude,
    lastValidPosition.longitude,
    smoothedPosition.latitude,
smoothedPosition.longitude
  );

  if (distanceFromLast < MIN_DISTANCE) {
    console.log('이동 거리 너무 짧음, 좌표 무시:', distanceFromLast);
    return;
  }
    totalDistance += distanceFromLast;
  distanceDisplay.textContent = (totalDistance / 1000).toFixed(2) + ' km';
  if (totalDistance > 0 && seconds > 0) {
  const paceSeconds = seconds / (totalDistance / 1000);

  const paceMinutes = Math.floor(paceSeconds / 60);
  const paceRemainingSeconds = Math.floor(paceSeconds % 60);

  paceDisplay.textContent =
    'Pace: ' +
    paceMinutes +
    "'" +
    String(paceRemainingSeconds).padStart(2, '0') +
    '"';
}
  console.log('총 이동거리:', totalDistance);
}

lastValidPosition = {
  latitude: smoothedPosition.latitude,
  longitude: smoothedPosition.longitude
};

routeCoordinates.push([
  smoothedPosition.latitude,
  smoothedPosition.longitude
]);

console.log(routeCoordinates);

map.panTo(
  [
    smoothedPosition.latitude,
    smoothedPosition.longitude
  ],
  {
    animate: true,
    duration: 0.8
  }
);
  if (!currentMarker) {
  currentMarker = L.marker([
    smoothedPosition.latitude,
    smoothedPosition.longitude
  ]).addTo(map);
} else {
  currentMarker.setLatLng([
    smoothedPosition.latitude,
    smoothedPosition.longitude
  ]);
}

if (!routeLine) {
  routeLine = L.polyline(routeCoordinates, {
    color: '#1f6feb',
    weight: 6,
    opacity: 0.85,
    lineCap: 'round',
    lineJoin: 'round'
  }).addTo(map);

  routeLines.push(routeLine);
} else {
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
  paused = true;
  isRunning = false;
});
stopBtn.addEventListener('click', function () {
  console.log('러닝 종료 버튼 클릭됨');
clearInterval(timerInterval);
navigator.geolocation.clearWatch(watchId);

console.log('watchId 종료:', watchId);
watchId = null;
saveRunRecord();
seconds = 0;
timer.textContent = '00:00';
totalDistance = 0;
distanceDisplay.textContent = '0.00 km';
paceDisplay.textContent = 'Pace: --\'--"';
routeCoordinates = [];
recentPositions = [];
lastValidPosition = null;
routeLines.forEach(function (line) {
  map.removeLayer(line);
});

routeLines = [];
routeLine = null;

if (currentMarker) {
  map.removeLayer(currentMarker);
  currentMarker = null;
}

isRunning = false;
runStartTime = null;
paused = false;
});
detailNumericPace.addEventListener('click', function () {
  if (detailNumericPace.dataset.showing === 'number') {
    detailNumericPace.textContent = detailNumericPace.dataset.emotionalPace;
    detailNumericPace.dataset.showing = 'emotional';
  } else {
    detailNumericPace.textContent = detailNumericPace.dataset.numericPace;
    detailNumericPace.dataset.showing = 'number';
  }
});
backToRecordsBtn.addEventListener('click', function () {
  recordDetail.classList.add('hidden');
  recordsSection.classList.remove('hidden');
});
const profileFeedBtn = document.getElementById('profileFeedBtn');
const profileFeedScreen = document.getElementById('profileFeedScreen');
const backFromProfileFeedBtn = document.getElementById('backFromProfileFeedBtn');
const controlsSection = document.getElementById('controls');

profileFeedBtn.addEventListener('click', function () {
  map.getContainer().style.display = 'none';
  controlsSection.style.display = 'none';
  recordsSection.classList.add('hidden');
  recordDetail.classList.add('hidden');

  profileFeedScreen.classList.remove('hidden');
});

backFromProfileFeedBtn.addEventListener('click', function () {
  profileFeedScreen.classList.add('hidden');

  map.getContainer().style.display = 'block';
  controlsSection.style.display = 'flex';
  recordsSection.classList.remove('hidden');
});