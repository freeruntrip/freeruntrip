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
let routeSegments = [];
let activeRouteSegment = [];
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
const controlsSection = document.getElementById('controls');
const recordDetail = document.getElementById('recordDetail');
const backToRecordsBtn = document.getElementById('backToRecordsBtn');
const detailDate = document.getElementById('detailDate');
const detailTimeRange = document.getElementById('detailTimeRange');
const detailDistance = document.getElementById('detailDistance');
const detailDuration = document.getElementById('detailDuration');
const detailNumericPace = document.getElementById('detailNumericPace');
const detailPaceTitle = document.getElementById('detailPaceTitle');
const detailPaceHint = document.getElementById('detailPaceHint');
const detailMapElement = document.getElementById('detailMap');
const detailMemory = document.getElementById('detailMemory');
const detailMapSection = document.getElementById('detailMapSection');
const toggleDetailMapBtn = document.getElementById('toggleDetailMapBtn');
const detailRunPhoto = document.getElementById('detailRunPhoto');
const detailRunMemoWrap = document.getElementById('detailRunMemoWrap');
const detailRunMemo = document.getElementById('detailRunMemo');
const detailSplits = document.getElementById('detailSplits');
const detailSplitsList = document.getElementById('detailSplitsList');
const paceMoodModal = document.getElementById('paceMoodModal');
const saveRunWithMoodBtn = document.getElementById('saveRunWithMoodBtn');
const runPhotoInput = document.getElementById('runPhotoInput');
const runPhotoFileName = document.getElementById('runPhotoFileName');
const runMemoInput = document.getElementById('runMemoInput');
const runMemoCount = document.getElementById('runMemoCount');

let pendingRunPhoto = '';
let isPhotoProcessing = false;
let detailMap = null;
let detailRouteLines = [];
let detailStartMarker = null;
let detailFinishMarker = null;
let detailDirectionMarkers = [];
let selectedDetailRecord = null;
const MAX_ACCURACY = 100; // meters
const MIN_DISTANCE = 5; // meters
let runRecords = JSON.parse(localStorage.getItem('runRecords')) || [];

let selectedPaceMood =
  localStorage.getItem('selectedPaceMood') ||
  '마음 환기 Pace';

let runStartTime = null;
let splitRecords = [];
let nextSplitDistanceMeters = 1000;
let splitStartElapsedSeconds = 0;
let lastGpsElapsedSeconds = 0;
function compressRunPhoto(file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();

    reader.onload = function (event) {
      const image = new Image();

      image.onload = function () {
        const maxSize = 960;
        let width = image.width;
        let height = image.height;

        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round(height * (maxSize / width));
            width = maxSize;
          } else {
            width = Math.round(width * (maxSize / height));
            height = maxSize;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, width, height);

        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };

      image.onerror = function () {
        reject(new Error('이미지를 불러오지 못했습니다.'));
      };

      image.src = event.target.result;
    };

    reader.onerror = function () {
      reject(new Error('사진 파일을 읽지 못했습니다.'));
    };

    reader.readAsDataURL(file);
  });
}

function resetRunMemoryInputs() {
  pendingRunPhoto = '';
  runPhotoInput.value = '';
  runMemoInput.value = '';
  runMemoCount.textContent = '0';
  runPhotoFileName.textContent = '사진을 선택하면 기록에 함께 저장됩니다.';
}

runPhotoInput.addEventListener('change', async function () {
  const file = runPhotoInput.files[0];

  if (!file) {
    pendingRunPhoto = '';
    runPhotoFileName.textContent = '사진을 선택하면 기록에 함께 저장됩니다.';
    return;
  }

  isPhotoProcessing = true;
  saveRunWithMoodBtn.disabled = true;
  runPhotoFileName.textContent = '사진을 기록용 크기로 준비하고 있습니다…';

  try {
    pendingRunPhoto = await compressRunPhoto(file);
    runPhotoFileName.textContent = `${file.name} 선택 완료`;
  } catch (error) {
    pendingRunPhoto = '';
    runPhotoInput.value = '';
    runPhotoFileName.textContent = '사진을 준비하지 못했습니다. 다시 선택해 주세요.';
  } finally {
    isPhotoProcessing = false;
    saveRunWithMoodBtn.disabled = false;
  }
});

runMemoInput.addEventListener('input', function () {
  runMemoCount.textContent = runMemoInput.value.length;
});
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
  return selectedPaceMood;
}
function formatDurationFromSeconds(totalSeconds) {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, '0');
  const secondsPart = String(safeSeconds % 60).padStart(2, '0');

  return `${minutes}:${secondsPart}`;
}

function formatPaceFromSeconds(durationSeconds, distanceMeters) {
  if (!distanceMeters || distanceMeters <= 0) {
    return `--'--"`;
  }

  const paceSeconds = durationSeconds / (distanceMeters / 1000);
  const paceMinutes = Math.floor(paceSeconds / 60);
  const paceRemainingSeconds = Math.floor(paceSeconds % 60);

  return `${paceMinutes}'${String(paceRemainingSeconds).padStart(2, '0')}"`;
}

function addCompletedSplits(
  previousDistance,
  segmentDistance,
  previousElapsedSeconds,
  currentElapsedSeconds
) {
  if (segmentDistance <= 0) {
    return;
  }

  const currentDistance = previousDistance + segmentDistance;

  while (currentDistance >= nextSplitDistanceMeters) {
    const progressToSplit =
      (nextSplitDistanceMeters - previousDistance) / segmentDistance;

    const splitEndElapsedSeconds =
      previousElapsedSeconds +
      (currentElapsedSeconds - previousElapsedSeconds) * progressToSplit;

    const splitDurationSeconds =
      splitEndElapsedSeconds - splitStartElapsedSeconds;

    splitRecords.push({
      index: splitRecords.length + 1,
      distanceMeters: 1000,
      durationSeconds: Math.round(splitDurationSeconds),
      duration: formatDurationFromSeconds(splitDurationSeconds),
      pace: formatPaceFromSeconds(splitDurationSeconds, 1000)
    });

    splitStartElapsedSeconds = splitEndElapsedSeconds;
    nextSplitDistanceMeters += 1000;
  }
}

function getSplitsForSave() {
  const savedSplits = splitRecords.map(function (split) {
    return { ...split };
  });

  const completedDistanceMeters = nextSplitDistanceMeters - 1000;
  const remainingDistanceMeters = totalDistance - completedDistanceMeters;

  if (remainingDistanceMeters >= 10) {
    const finalSplitDurationSeconds =
      seconds - splitStartElapsedSeconds;

    savedSplits.push({
      index: savedSplits.length + 1,
      distanceMeters: Math.round(remainingDistanceMeters),
      durationSeconds: Math.round(finalSplitDurationSeconds),
      duration: formatDurationFromSeconds(finalSplitDurationSeconds),
      pace: formatPaceFromSeconds(
        finalSplitDurationSeconds,
        remainingDistanceMeters
      )
    });
  }

  return savedSplits;
}

function renderDetailSplits(record) {
  const splits = Array.isArray(record.splits) ? record.splits : [];

  if (splits.length === 0) {
    detailSplits.classList.add('hidden');
    detailSplitsList.innerHTML = '';
    return;
  }

  detailSplits.classList.remove('hidden');

  detailSplitsList.innerHTML = splits
    .map(function (split) {
      const isFullKilometer = split.distanceMeters >= 995;

      const label = isFullKilometer
        ? `${split.index}km`
        : `마지막 ${(split.distanceMeters / 1000).toFixed(2)}km`;

      return `
        <div class="split-row">
          <span class="split-label">${label}</span>
          <span class="split-duration">${split.duration}</span>
          <strong class="split-pace">${split.pace}</strong>
        </div>
      `;
    })
    .join('');
}
function createRunMarkerIcon(label, className) {
  return L.divIcon({
    className: `run-marker ${className}`,
    html: `<div>${label}</div>`,
    iconSize: [64, 28],
    iconAnchor: [32, 14]
  });
}

function clearDetailRouteDecorations() {
  if (detailStartMarker) {
    detailMap.removeLayer(detailStartMarker);
    detailStartMarker = null;
  }

  if (detailFinishMarker) {
    detailMap.removeLayer(detailFinishMarker);
    detailFinishMarker = null;
  }

  detailDirectionMarkers.forEach(function (marker) {
    detailMap.removeLayer(marker);
  });

  detailDirectionMarkers = [];
}

function addDirectionArrowsToDetailMap(points) {
  if (!points || points.length < 2) {
    return;
  }

  const interval = Math.max(1, Math.floor(points.length / 6));

  for (let i = interval; i < points.length - 1; i += interval) {
    const prev = points[i - 1];
    const next = points[i];

    const angle =
      Math.atan2(next[0] - prev[0], next[1] - prev[1]) * (180 / Math.PI);

    const arrowIcon = L.divIcon({
      className: 'direction-arrow',
      html: `<div style="transform: rotate(${angle}deg)">➤</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    const marker = L.marker(next, {
      icon: arrowIcon
    }).addTo(detailMap);

    detailDirectionMarkers.push(marker);
  }
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

    photo: pendingRunPhoto,

  memo: runMemoInput.value.trim(),

splits: getSplitsForSave(),

routeCoordinates: routeCoordinates.slice(),

routeSegments: routeSegments
  .filter(function (segment) {
    return segment.length > 0;
  })
  .map(function (segment) {
    return segment.slice();
  })
  };

  runRecords.unshift(record);

  localStorage.setItem(
    'runRecords',
    JSON.stringify(runRecords)
  );

renderRunRecords();
renderRecordProfileFeed();
renderMonthlyReport();

  console.log('저장된 러닝 기록:', record);
}
function showDetailMap(record) {
  const savedSegments =
    Array.isArray(record.routeSegments) &&
    record.routeSegments.length > 0
      ? record.routeSegments
      : [record.routeCoordinates || []];

  const validSegments = savedSegments.filter(function (segment) {
    return Array.isArray(segment) && segment.length > 0;
  });

  if (validSegments.length === 0) {
    detailMapElement.innerHTML = '';
    return;
  }

  if (!detailMap) {
    detailMap = L.map('detailMap');

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(detailMap);
  }

  detailRouteLines.forEach(function (line) {
    detailMap.removeLayer(line);
  });

  detailRouteLines = [];

  clearDetailRouteDecorations();

  const allPoints = [];

  validSegments.forEach(function (segment) {
    segment.forEach(function (point) {
      allPoints.push(point);
    });

    if (segment.length >= 2) {
      const routeLine = L.polyline(segment, {
        color: '#facc15',
        weight: 6,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(detailMap);

      detailRouteLines.push(routeLine);
    }

    addDirectionArrowsToDetailMap(segment);
  });

  const startPoint = validSegments[0][0];
  const lastSegment = validSegments[validSegments.length - 1];
  const finishPoint = lastSegment[lastSegment.length - 1];

  detailStartMarker = L.marker(startPoint, {
    icon: createRunMarkerIcon('START', 'start-marker')
  }).addTo(detailMap);

  detailFinishMarker = L.marker(finishPoint, {
    icon: createRunMarkerIcon('FINISH', 'finish-marker')
  }).addTo(detailMap);

  const bounds = L.latLngBounds(allPoints);

  if (bounds.isValid()) {
    detailMap.fitBounds(bounds, {
      padding: [20, 20]
    });
  }

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
  detailPaceTitle.textContent = 'Pace Mood';
detailNumericPace.textContent = record.emotionalPace || '마음 환기 Pace';
detailPaceHint.textContent = '터치하면 숫자 Pace로 바뀝니다';

detailNumericPace.dataset.showing = 'emotional';
detailNumericPace.dataset.numericPace = record.pace;
detailNumericPace.dataset.emotionalPace = record.emotionalPace || '마음 환기 Pace';
renderDetailSplits(record);
const hasPhoto = Boolean(record.photo);
const hasMemo = Boolean(record.memo);

if (hasPhoto || hasMemo) {
  detailMemory.classList.remove('hidden');

  if (hasPhoto) {
    detailRunPhoto.src = record.photo;
    detailRunPhoto.classList.remove('hidden');
  } else {
    detailRunPhoto.removeAttribute('src');
    detailRunPhoto.classList.add('hidden');
  }

  if (hasMemo) {
    detailRunMemo.textContent = record.memo;
    detailRunMemoWrap.classList.remove('hidden');
  } else {
    detailRunMemo.textContent = '';
    detailRunMemoWrap.classList.add('hidden');
  }
} else {
  detailMemory.classList.add('hidden');
  detailRunPhoto.removeAttribute('src');
  detailRunMemo.textContent = '';
}
selectedDetailRecord = record;

detailMapSection.classList.add('hidden');
toggleDetailMapBtn.textContent = '지도 보기';

const hasRoute =
  (Array.isArray(record.routeSegments) &&
    record.routeSegments.some(function (segment) {
      return Array.isArray(segment) && segment.length > 0;
    })) ||
  (Array.isArray(record.routeCoordinates) &&
    record.routeCoordinates.length > 0);

toggleDetailMapBtn.disabled = !hasRoute;

if (!hasRoute) {
  toggleDetailMapBtn.textContent = '경로 데이터가 없습니다';
}

map.getContainer().style.display = 'none';
controlsSection.style.display = 'none';

recordsSection.classList.add('hidden');
recordDetail.classList.remove('hidden');
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
    const mood = record.emotionalPace || '마음 환기 Pace';
    const memo = record.memo || '';

    if (record.photo) {
      return `
        <div class="feed-card recent-run-card">
          <img
            class="recent-run-photo"
            src="${record.photo}"
            alt="러닝 기록 사진"
          />

          <div class="recent-run-content">
            <div class="recent-run-topline">
              <strong class="recent-run-distance">${record.distance}km</strong>
              <span class="recent-run-mood">${mood}</span>
            </div>

            ${memo ? `<p class="recent-run-memo">${memo}</p>` : ''}
          </div>
        </div>
      `;
    }

    return `
      <div class="feed-card recent-run-card no-photo">
        <div class="recent-run-topline">
          <strong class="recent-run-distance">${record.distance}km</strong>
          <span class="recent-run-mood">${mood}</span>
        </div>

        ${memo ? `<p class="recent-run-memo">${memo}</p>` : ''}
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

    routeCoordinates = [];
    routeSegments = [];
    activeRouteSegment = [];
    routeSegments.push(activeRouteSegment);

    splitRecords = [];
    nextSplitDistanceMeters = 1000;
    splitStartElapsedSeconds = 0;
    lastGpsElapsedSeconds = 0;
  }

  if (paused) {
    routeLine = null;
    lastValidPosition = null;
    recentPositions = [];

    activeRouteSegment = [];
    routeSegments.push(activeRouteSegment);

    lastGpsElapsedSeconds = seconds;
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

  const previousDistance = totalDistance;
  const previousElapsedSeconds = lastGpsElapsedSeconds;

  totalDistance += distanceFromLast;

  addCompletedSplits(
    previousDistance,
    distanceFromLast,
    previousElapsedSeconds,
    seconds
  );

  distanceDisplay.textContent =
    (totalDistance / 1000).toFixed(2) + ' km';

  if (totalDistance > 0 && seconds > 0) {
    paceDisplay.textContent =
      'Pace: ' + formatPaceFromSeconds(seconds, totalDistance);
  }

  console.log('총 이동거리:', totalDistance);
}

lastValidPosition = {
  latitude: smoothedPosition.latitude,
  longitude: smoothedPosition.longitude
};

lastGpsElapsedSeconds = seconds;

const currentRoutePoint = [
  smoothedPosition.latitude,
  smoothedPosition.longitude
];

routeCoordinates.push(currentRoutePoint);

activeRouteSegment.push(currentRoutePoint);

console.log(routeCoordinates);

if (!currentMarker) {
  map.setView(
    [
      smoothedPosition.latitude,
      smoothedPosition.longitude
    ],
    17
  );
} else {
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
}
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
  routeLine = L.polyline(activeRouteSegment, {
    color: '#1f6feb',
    weight: 6,
    opacity: 0.85,
    lineCap: 'round',
    lineJoin: 'round'
  }).addTo(map);

  routeLines.push(routeLine);
} else {
  routeLine.setLatLngs(activeRouteSegment);
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

paceMoodModal.classList.remove('hidden');

});
saveRunWithMoodBtn.addEventListener('click', function () {
  const activeMoodButton = document.querySelector('.pace-mood-option.active');

  if (activeMoodButton) {
    selectedPaceMood = activeMoodButton.dataset.mood;

    localStorage.setItem(
      'selectedPaceMood',
      selectedPaceMood
    );
  }

saveRunRecord();

resetRunMemoryInputs();

paceMoodModal.classList.add('hidden');

  seconds = 0;
  timer.textContent = '00:00';
  totalDistance = 0;
  distanceDisplay.textContent = '0.00 km';
  paceDisplay.textContent = 'Pace: --\'--"';
 routeCoordinates = [];
routeSegments = [];
activeRouteSegment = [];
recentPositions = [];
lastValidPosition = null;

splitRecords = [];
nextSplitDistanceMeters = 1000;
splitStartElapsedSeconds = 0;
lastGpsElapsedSeconds = 0;

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
    detailPaceTitle.textContent = 'Pace Mood';
    detailNumericPace.textContent = detailNumericPace.dataset.emotionalPace;
    detailPaceHint.textContent = '터치하면 숫자 Pace로 바뀝니다';
    detailNumericPace.dataset.showing = 'emotional';
  } else {
    detailPaceTitle.textContent = 'Average Pace';
    detailNumericPace.textContent = detailNumericPace.dataset.numericPace;
    detailPaceHint.textContent = '터치하면 Pace Mood로 바뀝니다';
    detailNumericPace.dataset.showing = 'number';
  }
});
toggleDetailMapBtn.addEventListener('click', function () {
  if (!selectedDetailRecord) {
    return;
  }

  const isHidden = detailMapSection.classList.contains('hidden');

  if (isHidden) {
    detailMapSection.classList.remove('hidden');
    toggleDetailMapBtn.textContent = '지도 닫기';

    showDetailMap(selectedDetailRecord);
  } else {
    detailMapSection.classList.add('hidden');
    toggleDetailMapBtn.textContent = '지도 보기';
  }
});
backToRecordsBtn.addEventListener('click', function () {
  detailMapSection.classList.add('hidden');
  toggleDetailMapBtn.textContent = '지도 보기';

  recordDetail.classList.add('hidden');

  map.getContainer().style.display = 'block';
  controlsSection.style.display = 'flex';

  recordsSection.classList.remove('hidden');

  selectedDetailRecord = null;
});
const profileFeedBtn = document.getElementById('profileFeedBtn');
const profileFeedScreen = document.getElementById('profileFeedScreen');
const backFromProfileFeedBtn = document.getElementById('backFromProfileFeedBtn');
const monthlyReportBtn = document.getElementById('monthlyReportBtn');
const monthlyReportScreen = document.getElementById('monthlyReportScreen');
const backFromMonthlyReportBtn = document.getElementById('backFromMonthlyReportBtn');

const monthlyReportTitle = document.getElementById('monthlyReportTitle');
const monthlyReportSubtitle = document.getElementById('monthlyReportSubtitle');
const monthlyDistance = document.getElementById('monthlyDistance');
const monthlyRunCount = document.getElementById('monthlyRunCount');
const monthlyTotalDuration = document.getElementById('monthlyTotalDuration');
const monthlyAveragePace = document.getElementById('monthlyAveragePace');
const monthlyDistanceChart = document.getElementById('monthlyDistanceChart');
const monthlyReportRecentRuns = document.getElementById('monthlyReportRecentRuns');
function parseRecordDate(dateText) {
  const match = String(dateText || '').match(
    /(\d{4})\D+(\d{1,2})\D+(\d{1,2})/
  );

  if (!match) {
    return null;
  }

  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );
}

function durationToSeconds(durationText) {
  const parts = String(durationText || '0:00')
    .split(':')
    .map(Number);

  if (parts.length !== 2 || parts.some(isNaN)) {
    return 0;
  }

  return parts[0] * 60 + parts[1];
}

function formatMonthlyDuration(totalSeconds) {
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}시간 ${minutes}분`;
  }

  return `${minutes}분`;
}

function formatAveragePace(totalSeconds, totalDistanceKm) {
  if (!totalDistanceKm || totalDistanceKm <= 0) {
    return `--'--"`;
  }

  const paceSeconds = totalSeconds / totalDistanceKm;
  const minutes = Math.floor(paceSeconds / 60);
  const seconds = Math.floor(paceSeconds % 60);

  return `${minutes}'${String(seconds).padStart(2, '0')}"`;
}

function renderMonthlyReport() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const monthlyRecords = runRecords
    .filter(function (record) {
      const recordDate = parseRecordDate(record.date);

      return (
        recordDate &&
        recordDate.getFullYear() === currentYear &&
        recordDate.getMonth() === currentMonth
      );
    })
    .sort(function (a, b) {
      return (b.id || 0) - (a.id || 0);
    });

  const totalDistanceKm = monthlyRecords.reduce(function (sum, record) {
    return sum + (Number(record.distance) || 0);
  }, 0);

  const totalDurationSeconds = monthlyRecords.reduce(function (sum, record) {
    return sum + durationToSeconds(record.duration);
  }, 0);

  monthlyReportTitle.textContent =
    `${currentYear}년 ${currentMonth + 1}월 러닝 리포트`;

  monthlyReportSubtitle.textContent =
    monthlyRecords.length > 0
      ? `${monthlyRecords.length}번의 러닝이 이번 달을 채우고 있어요`
      : '이번 달 첫 러닝을 기다리고 있어요';

  monthlyDistance.textContent = `${totalDistanceKm.toFixed(1)}km`;
  monthlyRunCount.textContent = `${monthlyRecords.length}회`;
  monthlyTotalDuration.textContent =
    formatMonthlyDuration(totalDurationSeconds);

  monthlyAveragePace.textContent =
    formatAveragePace(totalDurationSeconds, totalDistanceKm);

  const dailyDistances = {};

  monthlyRecords.forEach(function (record) {
    const recordDate = parseRecordDate(record.date);

    if (!recordDate) {
      return;
    }

    const day = recordDate.getDate();

    if (!dailyDistances[day]) {
      dailyDistances[day] = 0;
    }

    dailyDistances[day] += Number(record.distance) || 0;
  });

  const chartDays = Object.keys(dailyDistances)
    .map(Number)
    .sort(function (a, b) {
      return a - b;
    });

  if (chartDays.length === 0) {
    monthlyDistanceChart.innerHTML = `
      <p class="monthly-empty-message">
        이번 달 러닝 기록이 아직 없습니다.
      </p>
    `;
  } else {
    const maxDistance = Math.max(
      ...chartDays.map(function (day) {
        return dailyDistances[day];
      })
    );

    monthlyDistanceChart.innerHTML = chartDays
      .map(function (day) {
        const distance = dailyDistances[day];
        const height = Math.max(
          14,
          Math.round((distance / maxDistance) * 125)
        );

        return `
          <div class="monthly-bar-column">
            <span class="monthly-bar-value">${distance.toFixed(1)}</span>
            <div
              class="monthly-bar"
              style="height: ${height}px"
            ></div>
            <span class="monthly-bar-date">${day}일</span>
          </div>
        `;
      })
      .join('');
  }

  if (monthlyRecords.length === 0) {
    monthlyReportRecentRuns.innerHTML = `
      <p class="monthly-empty-message">
        저장된 러닝 기록이 아직 없습니다.
      </p>
    `;
    return;
  }

  monthlyReportRecentRuns.innerHTML = monthlyRecords
    .slice(0, 3)
    .map(function (record) {
      return `
        <div class="monthly-recent-run">
          <div>
            <span class="monthly-recent-run-date">${record.date}</span>
            <strong class="monthly-recent-run-mood">
              ${record.emotionalPace || '마음 환기 Pace'}
            </strong>
          </div>

          <strong class="monthly-recent-run-distance">
            ${record.distance}km
          </strong>
        </div>
      `;
    })
    .join('');
}
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
monthlyReportBtn.addEventListener('click', function () {
  renderMonthlyReport();

  map.getContainer().style.display = 'none';
  controlsSection.style.display = 'none';
  recordsSection.classList.add('hidden');
  recordDetail.classList.add('hidden');
  profileFeedScreen.classList.add('hidden');

  monthlyReportScreen.classList.remove('hidden');
});

backFromMonthlyReportBtn.addEventListener('click', function () {
  monthlyReportScreen.classList.add('hidden');

  map.getContainer().style.display = 'block';
  controlsSection.style.display = 'flex';
  recordsSection.classList.remove('hidden');
});
const paceMoodOptions = document.querySelectorAll('.pace-mood-option');

paceMoodOptions.forEach(function (button) {
  button.addEventListener('click', function () {

    paceMoodOptions.forEach(function (btn) {
  btn.classList.remove('active');
});

button.classList.add('active');

    selectedPaceMood = button.dataset.mood;

    localStorage.setItem(
      'selectedPaceMood',
      selectedPaceMood
    );

    console.log('선택된 Pace Mood:', selectedPaceMood);
  });
});
