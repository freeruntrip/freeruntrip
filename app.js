const map = L.map('map', {
  zoomControl: false,
  preferCanvas: true
}).setView([37.5665, 126.9780], 13);

function createFreeRunTripTileLayer() {
  return L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
      attribution: '&copy; OpenStreetMap contributors',
      className: 'freeruntrip-map-tile',
      maxZoom: 19
    }
  );
}

createFreeRunTripTileLayer().addTo(map);
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const timer = document.getElementById('timer');
const runningIdlePanel = document.getElementById(
  'runningIdlePanel'
);

const runningDashboard = document.getElementById(
  'runningDashboard'
);
const runningInfoView = document.getElementById(
  'runningInfoView'
);

const runningMapView = document.getElementById(
  'runningMapView'
);

const showRunningMapBtn = document.getElementById(
  'showRunningMapBtn'
);

const showRunningInfoBtn = document.getElementById(
  'showRunningInfoBtn'
);

const runningMapTimer = document.getElementById(
  'runningMapTimer'
);

const runningMapDistance = document.getElementById(
  'runningMapDistance'
);

const runningMapPace = document.getElementById(
  'runningMapPace'
);

const runningMapCadence = document.getElementById(
  'runningMapCadence'
);

const runningMapPauseBtn = document.getElementById(
  'runningMapPauseBtn'
);

const runningMapStopBtn = document.getElementById(
  'runningMapStopBtn'
);
function syncRunningMapStats() {
  runningMapTimer.textContent =
    timer.textContent;

  runningMapDistance.textContent =
    distanceDisplay.textContent;

  runningMapPace.textContent =
    paceDisplay.textContent;

  runningMapCadence.textContent =
    runningCadence.textContent;

  runningMapPauseBtn.textContent =
    pauseBtn.textContent;
}

function showRunningInfoView() {
  runningMapView.classList.add('hidden');
  runningInfoView.classList.remove('hidden');
}

function showRunningMapView() {
  syncRunningMapStats();

  runningInfoView.classList.add('hidden');
  runningMapView.classList.remove('hidden');

  requestAnimationFrame(function () {
    map.invalidateSize({
      pan: false
    });
  });
}
showRunningMapBtn.addEventListener(
  'click',
  function () {
    showRunningMapView();
  }
);

showRunningInfoBtn.addEventListener(
  'click',
  function () {
    showRunningInfoView();
  }
);

runningMapPauseBtn.addEventListener(
  'click',
  function () {
    pauseBtn.click();
  }
);

runningMapStopBtn.addEventListener(
  'click',
  function () {
    stopBtn.click();
  }
);
let seconds = 0;
let timerInterval;
let isRunning = false;
let currentMarker;
let routeCoordinates = [];
let routeSegments = [];
let activeRouteSegment = [];
let routeLine;
let routeLines = [];
function beginNewRouteSegment() {
  activeRouteSegment = [];
  routeSegments.push(activeRouteSegment);
  routeLine = null;
}

function appendRoutePointToActiveSegment(point) {
  if (!activeRouteSegment) {
    beginNewRouteSegment();
  }

  routeCoordinates.push(point);
  activeRouteSegment.push(point);

  if (!routeLine) {
    routeLine = L.polyline(activeRouteSegment, {
      color: '#facc15',
      weight: 6,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);

    routeLines.push(routeLine);
  } else {
    routeLine.setLatLngs(activeRouteSegment);
  }
}
let paused = false;
let watchId;
let lastValidPosition = null;
let totalDistance = 0; // meters
let totalElevationGain = 0;
let lastValidAltitude = null;
let recentPositions = [];

const SMOOTHING_COUNT = 3;
const DEFAULT_RUNNER_WEIGHT_KG = 70;

const distanceDisplay = document.getElementById('distance');
const paceDisplay = document.getElementById('pace');
const runningGpsStatus = document.getElementById(
  'runningGpsStatus'
);

const runningCalories = document.getElementById(
  'runningCalories'
);

const runningElevationGain = document.getElementById(
  'runningElevationGain'
);

const runningHeartRate = document.getElementById(
  'runningHeartRate'
);

const runningCadence = document.getElementById(
  'runningCadence'
);

const runningGpsAccuracy = document.getElementById(
  'runningGpsAccuracy'
);
const recordsList = document.getElementById('recordsList');
const recordsSection = document.getElementById('records');
const recordsTotalDistance = document.getElementById(
  'recordsTotalDistance'
);

const recordsTotalCount = document.getElementById(
  'recordsTotalCount'
);

const recordsAnalysisBtn = document.getElementById(
  'recordsAnalysisBtn'
);

const recordsListTitle = document.getElementById(
  'recordsListTitle'
);

const recordsFilteredCount = document.getElementById(
  'recordsFilteredCount'
);

const recordsFilterTabs = document.querySelectorAll(
  '.records-filter-tab'
);

let selectedRecordFilter = 'all';
const controlsSection = document.getElementById('controls');
const recordDetail = document.getElementById('recordDetail');
const backToRecordsBtn = document.getElementById('backToRecordsBtn');
const detailActivityType = document.getElementById(
  'detailActivityType'
);

const detailDate = document.getElementById(
  'detailDate'
);

const detailTimeRange = document.getElementById(
  'detailTimeRange'
);

const detailRouteSummary = document.getElementById(
  'detailRouteSummary'
);

const detailDistance = document.getElementById(
  'detailDistance'
);
const detailDuration = document.getElementById('detailDuration');
const detailCalories = document.getElementById(
  'detailCalories'
);

const detailPlannedDistanceCard = document.getElementById(
  'detailPlannedDistanceCard'
);

const detailPlannedDistance = document.getElementById(
  'detailPlannedDistance'
);

const detailRunTripInfo = document.getElementById(
  'detailRunTripInfo'
);

const detailRunTripOrigin = document.getElementById(
  'detailRunTripOrigin'
);

const detailRunTripDestination = document.getElementById(
  'detailRunTripDestination'
);

const detailRunTripWaypointsWrap = document.getElementById(
  'detailRunTripWaypointsWrap'
);

const detailRunTripWaypoints = document.getElementById(
  'detailRunTripWaypoints'
);

const detailPlannedDuration = document.getElementById(
  'detailPlannedDuration'
);

const detailDistanceDifference = document.getElementById(
  'detailDistanceDifference'
);
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
const backFromPaceMoodBtn = document.getElementById(
  'backFromPaceMoodBtn'
);
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
let detailWaypointMarkers = [];
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
function createRunTripDetailMarkerIcon(
  label,
  type
) {
  return L.divIcon({
    className:
      `runtrip-preview-marker ${type}`,

    html: `
      <div class="runtrip-preview-marker-body">
        <span>
          ${escapePlaceSearchText(label)}
        </span>
      </div>

      <div
        class="runtrip-preview-marker-tip"
      ></div>
    `,

    iconSize: [42, 50],
    iconAnchor: [21, 48]
  });
}
function clearDetailRouteDecorations() {
  if (detailStartMarker) {
    detailMap.removeLayer(
      detailStartMarker
    );

    detailStartMarker = null;
  }

  if (detailFinishMarker) {
    detailMap.removeLayer(
      detailFinishMarker
    );

    detailFinishMarker = null;
  }

  detailWaypointMarkers.forEach(
    function (marker) {
      detailMap.removeLayer(marker);
    }
  );

  detailWaypointMarkers = [];

  detailDirectionMarkers.forEach(
    function (marker) {
      detailMap.removeLayer(marker);
    }
  );

  detailDirectionMarkers = [];
}
function getSavedRunTripPlaceLatLng(
  place
) {
  if (!place) {
    return null;
  }

  const latitude =
    Number(
      place.latitude ??
      place.lat ??
      place.y
    );

  const longitude =
    Number(
      place.longitude ??
      place.lng ??
      place.x
    );

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  return [
    latitude,
    longitude
  ];
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

    activityType: 'running',

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

    calories: calculateCalories(
      totalDistance
    ),

    pace: paceDisplay.textContent,

    emotionalPace: getEmotionalPaceLabel(),

    photo: pendingRunPhoto,

  memo: runMemoInput.value.trim(),

splits: getSplitsForSave(),

routeCoordinates: routeCoordinates.slice(),

routeSegments: routeSegments
  .filter(function (segment) {
    return Array.isArray(segment) && segment.length >= 2;
  })
  .map(function (segment) {
    return segment.map(function (point) {
      return [point[0], point[1]];
    });
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
function getDetailRouteData(record) {
  const isRunTrip =
    getRecordActivityType(record) ===
    'runtrip';

  const actualDistanceKm =
    Number(record.distance) || 0;

  const hasMeasuredRunTripDistance =
    !isRunTrip ||
    actualDistanceKm >= 0.01;

  const savedSegments =
    Array.isArray(record.routeSegments)
      ? record.routeSegments.filter(
          function (segment) {
            return (
              Array.isArray(segment) &&
              segment.length > 0
            );
          }
        )
      : [];

  const savedCoordinates =
    Array.isArray(record.routeCoordinates)
      ? record.routeCoordinates
      : [];

  const plannedCoordinates =
    Array.isArray(
      record.plannedRouteCoordinates
    )
      ? record.plannedRouteCoordinates
      : [];

  let actualSegments = [];
  let plannedSegments = [];

  if (
    hasMeasuredRunTripDistance &&
    savedSegments.length > 0
  ) {
    actualSegments =
      savedSegments;
  } else if (
    hasMeasuredRunTripDistance &&
    savedCoordinates.length > 0
  ) {
    actualSegments = [
      savedCoordinates
    ];
  }

  if (
    isRunTrip &&
    plannedCoordinates.length > 0
  ) {
    plannedSegments = [
      plannedCoordinates
    ];
  }

  /*
    과거 RunTrip 기록은 실제 이동 거리가 없고
    예정 경로가 routeCoordinates 또는
    routeSegments에 저장되어 있을 수 있다.
  */
  if (
    isRunTrip &&
    !hasMeasuredRunTripDistance &&
    plannedSegments.length === 0
  ) {
    if (savedSegments.length > 0) {
      plannedSegments =
        savedSegments;
    } else if (
      savedCoordinates.length > 0
    ) {
      plannedSegments = [
        savedCoordinates
      ];
    }
  }

  return {
    isRunTrip: isRunTrip,
    actualSegments: actualSegments,
    plannedSegments: plannedSegments,
    hasActual:
      actualSegments.length > 0,
    hasPlanned:
      plannedSegments.length > 0
  };
}
function showDetailMap(record) {
  const routeData =
    getDetailRouteData(record);

  if (
    !routeData.hasActual &&
    !routeData.hasPlanned
  ) {
    detailMapElement.innerHTML = '';
    return;
  }

  if (!detailMap) {
    detailMap = L.map('detailMap');

    createFreeRunTripTileLayer().addTo(
      detailMap
    );
  }

  detailRouteLines.forEach(
    function (line) {
      detailMap.removeLayer(line);
    }
  );

  detailRouteLines = [];

  clearDetailRouteDecorations();

  const allPoints = [];

  /*
    RunTrip 예정 경로:
    실제 이동 경로 아래에 보이도록
    먼저 회색 점선으로 그린다.
  */
  routeData.plannedSegments.forEach(
    function (segment) {
      segment.forEach(
        function (point) {
          allPoints.push(point);
        }
      );

      if (segment.length < 2) {
        return;
      }

      const plannedLine =
        L.polyline(segment, {
          color: '#64748b',
          weight: 5,
          opacity: 0.85,
          dashArray: '10 10',
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(detailMap);

      detailRouteLines.push(
        plannedLine
      );
    }
  );

  /*
    실제 이동 경로:
    노란색 실선으로 표시하고
    실제 이동 방향 화살표를 추가한다.
  */
  routeData.actualSegments.forEach(
    function (segment) {
      segment.forEach(
        function (point) {
          allPoints.push(point);
        }
      );

      if (segment.length >= 2) {
        const actualLine =
          L.polyline(segment, {
            color: '#facc15',
            weight: 6,
            opacity: 0.95,
            lineCap: 'round',
            lineJoin: 'round'
          }).addTo(detailMap);

        detailRouteLines.push(
          actualLine
        );
      }

      addDirectionArrowsToDetailMap(
        segment
      );
    }
  );

  const markerSegments =
    routeData.hasActual
      ? routeData.actualSegments
      : routeData.plannedSegments;

  const routeStartPoint =
    markerSegments[0][0];

  const lastSegment =
    markerSegments[
      markerSegments.length - 1
    ];

  const routeFinishPoint =
    lastSegment[
      lastSegment.length - 1
    ];

  if (routeData.isRunTrip) {
    const savedOriginPoint =
      getSavedRunTripPlaceLatLng(
        record.originPlace
      );

    const savedDestinationPoint =
      getSavedRunTripPlaceLatLng(
        record.destinationPlace
      );

    const startPoint =
      savedOriginPoint ||
      routeStartPoint;

    const finishPoint =
      savedDestinationPoint ||
      routeFinishPoint;

    detailStartMarker =
      L.marker(startPoint, {
        icon:
          createRunTripDetailMarkerIcon(
            'S',
            'start'
          )
      }).addTo(detailMap);

    const waypointPlaces =
      Array.isArray(
        record.waypointPlaces
      )
        ? record.waypointPlaces
        : [];

    waypointPlaces.forEach(
      function (waypoint, index) {
        const waypointPoint =
          getSavedRunTripPlaceLatLng(
            waypoint
          );

        if (!waypointPoint) {
          return;
        }

        const marker =
          L.marker(
            waypointPoint,
            {
              icon:
                createRunTripDetailMarkerIcon(
                  String(index + 1),
                  'waypoint'
                )
            }
          ).addTo(detailMap);

        detailWaypointMarkers.push(
          marker
        );

        allPoints.push(
          waypointPoint
        );
      }
    );

    detailFinishMarker =
      L.marker(finishPoint, {
        icon:
          createRunTripDetailMarkerIcon(
            'D',
            'destination'
          )
      }).addTo(detailMap);

    allPoints.push(
      startPoint,
      finishPoint
    );
  } else {
    detailStartMarker =
      L.marker(
        routeStartPoint,
        {
          icon:
            createRunMarkerIcon(
              'START',
              'start-marker'
            )
        }
      ).addTo(detailMap);

    detailFinishMarker =
      L.marker(
        routeFinishPoint,
        {
          icon:
            createRunMarkerIcon(
              'FINISH',
              'finish-marker'
            )
        }
      ).addTo(detailMap);
  }

  const bounds =
    L.latLngBounds(allPoints);

  if (bounds.isValid()) {
    detailMap.fitBounds(
      bounds,
      {
        padding: [20, 20]
      }
    );
  }

  setTimeout(function () {
    detailMap.invalidateSize();
  }, 100);
}
function getRecordActivityType(record) {
  if (
    record.activityType === 'runtrip' ||
    record.type === 'runtrip'
  ) {
    return 'runtrip';
  }

  return 'running';
}
function normalizeActivityRecord(record) {
  const activityType =
    getRecordActivityType(record);

  const distanceKm =
    Number(record.distance) || 0;

  const waypointNames =
    Array.isArray(record.waypointNames)
      ? record.waypointNames
          .filter(Boolean)
          .map(function (name) {
            return String(name);
          })
      : [];

  return {
    ...record,

    activityType: activityType,

    date:
      record.date ||
      '날짜 정보 없음',

    startTime:
      record.startTime ||
      '--:--',

    endTime:
      record.endTime ||
      '--:--',

    distance:
      distanceKm.toFixed(2),

    calories:
      Number.isFinite(
        Number(record.calories)
      )
        ? Math.round(
          Number(record.calories)
          )
        : Math.round(
             DEFAULT_RUNNER_WEIGHT_KG *
             distanceKm
          ),

    duration:
      record.duration ||
      '00:00',

    pace:
      record.pace ||
      `--'--"`,

    emotionalPace:
      record.emotionalPace ||
      (
        activityType === 'runtrip'
          ? 'RunTrip Journey'
          : '마음 환기 Pace'
      ),

    originName:
      record.originName ||
      '출발지',

    destinationName:
      record.destinationName ||
      '도착지',

    waypointNames: waypointNames
  };
}

function getRecordCardTitle(record) {
  if (
    record.activityType === 'runtrip'
  ) {
    return (
      `${record.originName} → ` +
      `${record.destinationName}`
    );
  }

  return '일반 러닝';
}

function getRecordCardSubtitle(record) {
  if (
    record.activityType !== 'runtrip'
  ) {
    return (
      `${record.startTime} ~ ` +
      `${record.endTime}`
    );
  }

  const waypointCount =
    record.waypointNames.length;

  const waypointText =
    waypointCount > 0
      ? `경유지 ${waypointCount}개 · `
      : '';

  return (
    waypointText +
    `${record.startTime} ~ ` +
    `${record.endTime}`
  );
}
function getSortedNormalizedRecords() {
  return runRecords
    .map(function (record) {
      return normalizeActivityRecord(
        record
      );
    })
    .sort(function (a, b) {
      return (
        Number(b.id || 0) -
        Number(a.id || 0)
      );
    });
}

function getFilteredRunRecords() {
  const sortedRecords =
    getSortedNormalizedRecords();

  if (
    selectedRecordFilter === 'all'
  ) {
    return sortedRecords;
  }

  return sortedRecords.filter(
    function (record) {
      return (
        record.activityType ===
        selectedRecordFilter
      );
    }
  );
}

function getRecordFilterTitle() {
  if (selectedRecordFilter === 'running') {
    return '러닝 기록';
  }

  if (selectedRecordFilter === 'runtrip') {
    return 'RunTrip 기록';
  }

  return '전체 기록';
}

function renderRecordsSummary() {
  const totalDistanceKm = runRecords.reduce(
    function (sum, record) {
      return (
        sum +
        (Number(record.distance) || 0)
      );
    },
    0
  );

  recordsTotalDistance.textContent =
    `${totalDistanceKm.toFixed(1)} km`;

  recordsTotalCount.textContent =
    `${runRecords.length}회`;
}

function renderRecordsEmptyState() {
  let title =
    '아직 저장된 활동이 없습니다.';

  let description =
    '러닝이나 RunTrip을 완료하면 이곳에서 활동 기록을 확인할 수 있어요.';

  if (
    selectedRecordFilter === 'running'
  ) {
    title =
      '아직 저장된 러닝 기록이 없습니다.';

    description =
      '일반 러닝을 완료하면 이곳에 기록됩니다.';
  }

  if (
    selectedRecordFilter === 'runtrip'
  ) {
    title =
      '아직 저장된 RunTrip 기록이 없습니다.';

    description =
      'RunTrip을 완료하면 이곳에 기록됩니다.';
  }

  recordsList.innerHTML = `
    <div class="records-empty-state">
      <span
        class="records-empty-icon"
        aria-hidden="true"
      >
        ${
          selectedRecordFilter ===
          'runtrip'
            ? '◆'
            : '▤'
        }
      </span>

      <strong>
        ${title}
      </strong>

      <p>
        ${description}
      </p>
    </div>
  `;
}
function renderRunRecords() {
  recordsList.innerHTML = '';

  renderRecordsSummary();

  const filteredRecords =
    getFilteredRunRecords();

  recordsListTitle.textContent =
    getRecordFilterTitle();

  recordsFilteredCount.textContent =
    `${filteredRecords.length}개`;

  if (filteredRecords.length === 0) {
    renderRecordsEmptyState();
    return;
  }

  filteredRecords.forEach(function (record) {
  const recordCard =
    document.createElement('article');

  const activityType =
    record.activityType;

  const isRunTrip =
    activityType === 'runtrip';

  const activityLabel =
    isRunTrip
      ? 'RUNTRIP'
      : 'RUNNING';

  const cardTitle =
    getRecordCardTitle(record);

  const cardSubtitle =
    getRecordCardSubtitle(record);

  const safeDate =
    escapePlaceSearchText(
      record.date
    );

  const safeTitle =
    escapePlaceSearchText(
      cardTitle
    );

  const safeSubtitle =
    escapePlaceSearchText(
      cardSubtitle
    );

  const safeDistance =
    escapePlaceSearchText(
      record.distance
    );

  const safeDuration =
    escapePlaceSearchText(
      record.duration
    );

  const safePace =
    escapePlaceSearchText(
      record.pace
    );

  const safeEmotionalPace =
    escapePlaceSearchText(
      record.emotionalPace
    );

  recordCard.className =
    `record-card ${activityType}-record-card`;

  recordCard.setAttribute(
    'tabindex',
    '0'
  );

  recordCard.setAttribute(
    'role',
    'button'
  );

  recordCard.setAttribute(
    'aria-label',
    `${activityLabel} ${cardTitle} 상세 보기`
  );

  recordCard.innerHTML = `
    <div class="record-card-header">
      <span
        class="record-activity-badge"
      >
        ${activityLabel}
      </span>

      <span class="record-card-date">
        ${safeDate}
      </span>
    </div>

    <div class="record-card-title-row">
      <div class="record-card-title-wrap">
        <strong class="record-card-title">
          ${safeTitle}
        </strong>

        <span class="record-card-subtitle">
          ${safeSubtitle}
        </span>
      </div>

      <span
        class="record-card-arrow"
        aria-hidden="true"
      >
        ›
      </span>
    </div>

    <div class="record-card-stats">
      <div class="record-card-stat">
        <span>거리</span>

        <strong>
          ${safeDistance}
          <small>km</small>
        </strong>
      </div>

      <div class="record-card-stat">
        <span>시간</span>

        <strong>
          ${safeDuration}
        </strong>
      </div>

      <div class="record-card-stat">
        <span>평균 Pace</span>

        <strong>
          ${safePace}
        </strong>
      </div>
    </div>

    <div class="record-card-footer">
      <button
        class="record-card-pace-toggle"
        type="button"
        data-showing="emotional"
        aria-label="Pace 표시 전환"
      >
        ${safeEmotionalPace}
      </button>

      ${
        isRunTrip
          ? `
            <span
              class="record-card-journey-label"
            >
              도시 여행 기록
            </span>
          `
          : ''
      }
    </div>
  `;

  function openRecordDetail() {
    detailActivityType.textContent =
  isRunTrip
    ? 'RUNTRIP'
    : 'RUNNING';

detailActivityType.classList.toggle(
  'runtrip-detail-type',
  isRunTrip
);

detailActivityType.classList.toggle(
  'running-detail-type',
  !isRunTrip
);

if (isRunTrip) {
  const waypointCount =
    record.waypointNames.length;

  const waypointText =
    waypointCount > 0
      ? ` · 경유지 ${waypointCount}개`
      : '';

  detailRouteSummary.textContent =
    `${record.originName} → ${record.destinationName}${waypointText}`;

  detailRouteSummary.classList.remove(
    'hidden'
  );
} else {
  detailRouteSummary.textContent = '';

  detailRouteSummary.classList.add(
    'hidden'
  );
}
    detailDate.textContent =
      record.date;

    detailTimeRange.textContent =
      `${record.startTime} ~ ${record.endTime}`;

    detailDistance.textContent =
      `${record.distance} km`;

    detailDuration.textContent =
      record.duration;

    detailCalories.textContent =
  `${record.calories} kcal`;

if (isRunTrip) {
  const rawPlannedDistance =
    Number(record.plannedDistance);

  const hasPlannedDistance =
    Number.isFinite(rawPlannedDistance) &&
    rawPlannedDistance > 0;

  const plannedDistanceKm =
    hasPlannedDistance
     ? rawPlannedDistance
     : 0;

  const actualDistanceKm =
    Number(record.distance) || 0;

  const distanceDifferenceKm =
    actualDistanceKm -
    plannedDistanceKm;

  if (hasPlannedDistance) {
    detailPlannedDistance.textContent =
    `${plannedDistanceKm.toFixed(2)} km`;

    detailPlannedDistanceCard.classList.remove(
      'hidden'
    );
  } else {
    detailPlannedDistance.textContent =
      '정보 없음';

     detailPlannedDistanceCard.classList.add(
      'hidden'
    );
  }

  detailRunTripInfo.classList.remove(
    'hidden'
  );

  detailRunTripOrigin.textContent =
    record.originName;

  detailRunTripDestination.textContent =
    record.destinationName;

  const rawPlannedDuration =
  Number(
    record.plannedDurationMinutes
  );

const hasPlannedDuration =
  Number.isFinite(
    rawPlannedDuration
  ) &&
  rawPlannedDuration > 0;

detailPlannedDuration.textContent =
  hasPlannedDuration
    ? `약 ${formatRunTripPlannedDuration(
        rawPlannedDuration
      )}`
    : '정보 없음';

  if (hasPlannedDistance) {
  const hasActualDistance =
    Number.isFinite(actualDistanceKm) &&
    actualDistanceKm >= 0.01;

  if (!hasActualDistance) {
    detailDistanceDifference.textContent =
      '측정 전';
  } else {
    const absoluteDifferenceKm =
      Math.abs(distanceDifferenceKm);

    if (absoluteDifferenceKm < 0.01) {
      detailDistanceDifference.textContent =
        '예상 거리와 동일';
    } else if (distanceDifferenceKm > 0) {
      detailDistanceDifference.textContent =
        `${absoluteDifferenceKm.toFixed(2)} km 더 김`;
    } else {
      detailDistanceDifference.textContent =
        `${absoluteDifferenceKm.toFixed(2)} km 더 짧음`;
    }
  }
} else {
  detailDistanceDifference.textContent =
    '정보 없음';
}

  if (
    Array.isArray(
      record.waypointNames
    ) &&
    record.waypointNames.length > 0
  ) {
    detailRunTripWaypointsWrap.classList.remove(
      'hidden'
    );

    detailRunTripWaypoints.innerHTML =
      record.waypointNames
        .map(function (
          waypointName,
          index
        ) {
          return `
            <div class="detail-runtrip-waypoint">
              <span
                class="detail-runtrip-waypoint-number"
              >
                ${index + 1}
              </span>

              <strong
                class="detail-runtrip-waypoint-name"
              >
                ${escapePlaceSearchText(
                  waypointName
                )}
              </strong>
            </div>
          `;
        })
        .join('');
  } else {
    detailRunTripWaypointsWrap.classList.add(
      'hidden'
    );

    detailRunTripWaypoints.innerHTML =
      '';
  }
} else {
  detailPlannedDistanceCard.classList.add(
    'hidden'
  );

  detailRunTripInfo.classList.add(
    'hidden'
  );

  detailRunTripWaypointsWrap.classList.add(
    'hidden'
  );

  detailRunTripWaypoints.innerHTML =
    '';
}

    detailPaceTitle.textContent =
      'Pace Mood';

    detailNumericPace.textContent =
      record.emotionalPace;

    detailPaceHint.textContent =
      '터치하면 숫자 Pace로 바뀝니다';

    detailNumericPace.dataset.showing =
      'emotional';

    detailNumericPace.dataset.numericPace =
      record.pace;

    detailNumericPace.dataset.emotionalPace =
      record.emotionalPace;

    renderDetailSplits(record);

    const hasPhoto =
      Boolean(record.photo);

    const hasMemo =
      Boolean(record.memo);

    if (hasPhoto || hasMemo) {
      detailMemory.classList.remove(
        'hidden'
      );

      if (hasPhoto) {
        detailRunPhoto.src =
          record.photo;

        detailRunPhoto.classList.remove(
          'hidden'
        );
      } else {
        detailRunPhoto.removeAttribute(
          'src'
        );

        detailRunPhoto.classList.add(
          'hidden'
        );
      }

      if (hasMemo) {
        detailRunMemo.textContent =
          record.memo;

        detailRunMemoWrap.classList.remove(
          'hidden'
        );
      } else {
        detailRunMemo.textContent = '';

        detailRunMemoWrap.classList.add(
          'hidden'
        );
      }
    } else {
      detailMemory.classList.add(
        'hidden'
      );

      detailRunPhoto.removeAttribute(
        'src'
      );

      detailRunMemo.textContent = '';
    }

    selectedDetailRecord =
      record;

    detailMapSection.classList.add(
      'hidden'
    );

    const detailRouteData =
      getDetailRouteData(record);

    const hasRoute =
      detailRouteData.hasActual ||
      detailRouteData.hasPlanned;

    toggleDetailMapBtn.disabled =
      !hasRoute;

if (!hasRoute) {
  toggleDetailMapBtn.textContent =
    '경로 데이터가 없습니다';
} else if (
  detailRouteData.hasActual &&
  detailRouteData.hasPlanned
) {
  toggleDetailMapBtn.textContent =
    '예정·실제 경로 비교';
} else if (
  detailRouteData.hasPlanned
) {
  toggleDetailMapBtn.textContent =
    '예정 경로 보기';
} else {
  toggleDetailMapBtn.textContent =
    '실제 경로 보기';
}

    map.getContainer().style.display =
      'none';

    controlsSection.style.display =
      'none';

    recordsSection.classList.add(
      'hidden'
    );

    recordDetail.classList.remove(
      'hidden'
    );
  }

  recordCard.addEventListener(
    'click',
    function () {
      openRecordDetail();
    }
  );

  recordCard.addEventListener(
    'keydown',
    function (event) {
      if (
        event.key !== 'Enter' &&
        event.key !== ' '
      ) {
        return;
      }

      event.preventDefault();

      openRecordDetail();
    }
  );

  const paceToggle =
    recordCard.querySelector(
      '.record-card-pace-toggle'
    );

  paceToggle.addEventListener(
    'click',
    function (event) {
      event.stopPropagation();

      if (
        paceToggle.dataset.showing ===
        'emotional'
      ) {
        paceToggle.textContent =
          record.pace;

        paceToggle.dataset.showing =
          'number';
      } else {
        paceToggle.textContent =
          record.emotionalPace;

        paceToggle.dataset.showing =
          'emotional';
      }
    }
  );

  recordsList.appendChild(
  recordCard
);
});
}
recordsFilterTabs.forEach(function (tab) {
  tab.addEventListener(
    'click',
    function () {
      selectedRecordFilter =
        tab.dataset.recordFilter ||
        'all';

      recordsFilterTabs.forEach(
        function (item) {
          const isActive =
            item === tab;

          item.classList.toggle(
            'active',
            isActive
          );

          item.setAttribute(
            'aria-selected',
            String(isActive)
          );
        }
      );

      renderRunRecords();
    }
  );
});
function renderRecordProfileFeed() {
  const profileTotalDistanceHero = document.getElementById('profileTotalDistanceHero');
  const profileRunCountHero = document.getElementById('profileRunCountHero');
  const profileTotalDistance = document.getElementById('profileTotalDistance');
  const profileRunCount = document.getElementById('profileRunCount');
  const profileFollowers = document.getElementById('profileFollowers');
  const profileRecentRuns = document.getElementById('profileRecentRuns');
  const publishedRecords =
  runRecords.filter(function (record) {
    return record.isPublished === true;
  });
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

  if (publishedRecords.length === 0) {
    profileRecentRuns.innerHTML = `
      <div class="feed-card small-feed-card">
        <strong>0.00km</strong>
        <span>아직 저장된 러닝 기록이 없습니다</span>
      </div>
    `;
    return;
  }

profileRecentRuns.innerHTML =
  publishedRecords
    .slice()
    .sort(function (a, b) {
      return (b.publishedAt || b.id || 0) -
        (a.publishedAt || a.id || 0);
    })
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
  runningIdlePanel.classList.add('hidden');
  runningDashboard.classList.remove('hidden');

  if (seconds === 0) {
    showRunningInfoView();
    syncRunningMapStats();
    runStartTime = new Date();
    totalElevationGain = 0;
lastValidAltitude = null;

runningCalories.textContent = '0 kcal';
runningElevationGain.textContent = '0 m';
runningHeartRate.textContent = '-- bpm';
runningCadence.textContent = '-- spm';
runningGpsStatus.textContent = 'GPS 위치 확인 중';
runningGpsAccuracy.textContent = '확인 중';
  routeCoordinates = [];
  routeSegments = [];
  activeRouteSegment = [];
  beginNewRouteSegment();

    splitRecords = [];
    nextSplitDistanceMeters = 1000;
    splitStartElapsedSeconds = 0;
    lastGpsElapsedSeconds = 0;
  }

  if (paused) {
  routeLine = null;
  lastValidPosition = null;
  lastValidAltitude = null;
  recentPositions = [];

  beginNewRouteSegment();

  lastGpsElapsedSeconds = seconds;
  paused = false;
}

pauseBtn.textContent = '일시정지';
runningMapPauseBtn.textContent = '일시정지';

isRunning = true;

  setTimeout(function () {
  map.invalidateSize();
}, 100);

  timerInterval = setInterval(function () {
    seconds++;

    const minutes = String(Math.floor(seconds / 60)).padStart(2, '0');
    const remainingSeconds = String(seconds % 60).padStart(2, '0');

    timer.textContent = `${minutes}:${remainingSeconds}`;
    syncRunningMapStats();
    console.log('타이머 실행 중:', timer.textContent);
  }, 1000);
watchId = navigator.geolocation.watchPosition(
function (position) {
  // 일시정지 직후 늦게 도착한 위치값은 저장하지 않는다.
  if (!isRunning || paused) {
    console.log('일시정지 상태 GPS 무시');
    return;
  }

  console.log('GPS 성공');
  console.log(position);

   const latitude = position.coords.latitude;
const longitude = position.coords.longitude;
const accuracy = position.coords.accuracy;

console.log(latitude, longitude, accuracy);

if (accuracy > MAX_ACCURACY) {
  console.log(
    'GPS 정확도 낮음, 좌표 무시:',
    accuracy
  );

  runningGpsStatus.textContent =
    'GPS 정확도 확인 중';

  runningGpsAccuracy.textContent =
    `${Math.round(accuracy)} m`;

  return;
}

runningGpsStatus.textContent =
  'GPS 연결됨';

runningGpsAccuracy.textContent =
  `${Math.round(accuracy)} m`;

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
  updateRunningElevation(position);
  addCompletedSplits(
    previousDistance,
    distanceFromLast,
    previousElapsedSeconds,
    seconds
  );

  distanceDisplay.textContent =
  `${(totalDistance / 1000).toFixed(2)} km`;

runningCalories.textContent =
  `${calculateCalories(totalDistance)} kcal`;

if (totalDistance > 0 && seconds > 0) {
  paceDisplay.textContent =
    formatPaceFromSeconds(
      seconds,
      totalDistance
    );
}

syncRunningMapStats();

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

appendRoutePointToActiveSegment(currentRoutePoint);

const currentLatLng = [
  smoothedPosition.latitude,
  smoothedPosition.longitude
];

if (!currentMarker) {
  currentMarker = L.marker(currentLatLng).addTo(map);
} else {
  currentMarker.setLatLng(currentLatLng);
}

map.setView(currentLatLng, Math.max(map.getZoom(), 17), {
  animate: false
});
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
  // 이미 일시정지 상태라면 기존 시작 로직으로 재개한다.
  if (paused && !isRunning) {
    console.log('러닝 다시 시작');

    startBtn.click();
    return;
  }

  if (!isRunning) {
    return;
  }

  console.log('일시정지 버튼 클릭됨');

  // 먼저 상태를 변경해 대기 중인 GPS 콜백도 무시한다.
  paused = true;
  isRunning = false;

  clearInterval(timerInterval);
  timerInterval = null;

  if (watchId !== null && watchId !== undefined) {
    navigator.geolocation.clearWatch(watchId);

    console.log(
      'pause watchId 종료:',
      watchId
    );
  }

  watchId = null;

  // 현재 경로 세그먼트를 닫는다.
  // 재시작할 때 새 세그먼트를 만들어
  // 일시정지 구간의 대각선 연결을 방지한다.
  routeLine = null;
  activeRouteSegment = null;

  lastValidPosition = null;
  lastValidAltitude = null;
  recentPositions = [];

  pauseBtn.textContent = '다시 시작';
  runningMapPauseBtn.textContent = '다시 시작';

  runningGpsStatus.textContent =
    'GPS 일시정지';

  syncRunningMapStats();
});
stopBtn.addEventListener('click', function () {
  console.log('러닝 종료 버튼 클릭됨');

  // 종료를 누른 순간부터 늦게 도착하는 GPS 좌표를 무시한다.
  isRunning = false;
  paused = true;

  clearInterval(timerInterval);

  if (watchId !== null && watchId !== undefined) {
    navigator.geolocation.clearWatch(watchId);
    console.log('watchId 종료:', watchId);
  }

  watchId = null;

  paceMoodModal.classList.remove('hidden');
});
backFromPaceMoodBtn.addEventListener(
  'click',
  function () {
    paceMoodModal.classList.add('hidden');

    // 종료 직전까지 측정한 시간·거리·경로를 유지한 채
    // 일반 러닝을 다시 시작한다.
    startBtn.click();
  }
);
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
totalElevationGain = 0;
lastValidAltitude = null;

distanceDisplay.textContent = '0.00 km';
paceDisplay.textContent = `--'--"`;

runningCalories.textContent = '0 kcal';
runningElevationGain.textContent = '0 m';
runningHeartRate.textContent = '-- bpm';
runningCadence.textContent = '-- spm';

runningGpsStatus.textContent =
  'GPS 연결 준비';

runningGpsAccuracy.textContent =
  '대기 중';
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
  showRunningInfoView();
  syncRunningMapStats();
  runningDashboard.classList.add('hidden');
  runningIdlePanel.classList.remove('hidden');
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

const routeData =
  getDetailRouteData(
    selectedDetailRecord
  );

if (
  routeData.hasActual &&
  routeData.hasPlanned
) {
  toggleDetailMapBtn.textContent =
    '예정·실제 경로 비교';
} else if (
  routeData.hasPlanned
) {
  toggleDetailMapBtn.textContent =
    '예정 경로 보기';
} else {
  toggleDetailMapBtn.textContent =
    '실제 경로 보기';
}
  }
});
backToRecordsBtn.addEventListener(
  'click',
  function () {
    detailMapSection.classList.add(
      'hidden'
    );

    toggleDetailMapBtn.textContent =
      '지도 보기';

    selectedDetailRecord = null;

    openAppPage('records');
  }
);
const profileFeedBtn = document.getElementById('profileFeedBtn');
const profileFeedScreen = document.getElementById('profileFeedScreen');
const backFromProfileFeedBtn = document.getElementById('backFromProfileFeedBtn');
const monthlyReportBtn = document.getElementById('monthlyReportBtn');
const runTripBtn = document.getElementById('runTripBtn');
const runTripPanel = document.getElementById('runTripPanel');
const backFromRunTripBtn = document.getElementById('backFromRunTripBtn');

const runTripWaypoints = document.getElementById('runTripWaypoints');
const runTripDestinationInput = document.getElementById(
  'runTripDestinationInput'
);
const runTripOriginInput = document.getElementById(
  'runTripOriginInput'
);

const useCurrentLocationBtn = document.getElementById(
  'useCurrentLocationBtn'
);
const addWaypointBtn = document.getElementById('addWaypointBtn');
const runTripReturnToggle = document.getElementById(
  'runTripReturnToggle'
);

const createRunTripBtn = document.getElementById('createRunTripBtn');
const runTripStatus = document.getElementById('runTripStatus');
const runTripOriginSearchResults = document.getElementById(
  'runTripOriginSearchResults'
);

const runTripDestinationSearchResults = document.getElementById(
  'runTripDestinationSearchResults'
);
const runTripSearchScreen = document.getElementById(
  'runTripSearchScreen'
);

const closeRunTripSearchBtn = document.getElementById(
  'closeRunTripSearchBtn'
);

const runTripSearchTitle = document.getElementById(
  'runTripSearchTitle'
);

const runTripSearchInput = document.getElementById(
  'runTripSearchInput'
);

const clearRunTripSearchBtn = document.getElementById(
  'clearRunTripSearchBtn'
);

const runTripSearchGuide = document.getElementById(
  'runTripSearchGuide'
);

const runTripSearchResults = document.getElementById(
  'runTripSearchResults'
);

let activeRunTripSearchTarget = null;
let runTripSearchTimer = null;
let runTripSearchRequestId = 0;
let selectedRunTripOrigin = null;
let selectedRunTripDestination = null;

let isGettingRunTripCurrentLocation = false;

const runTripPreviewLayer = L.layerGroup().addTo(map);
let runTripRouteRequestId = 0;
let latestRunTripRouteSummary = null;
let isRunTripConfirmed = false;
const runTripEditorCard = runTripPanel.querySelector(
  '.runtrip-editor-card'
);

const runTripEditorHeader = runTripPanel.querySelector(
  '.runtrip-editor-header'
);

const runTripConfirmedSummary = document.createElement('section');

runTripConfirmedSummary.id = 'runTripConfirmedSummary';
runTripConfirmedSummary.className =
  'runtrip-confirmed-summary hidden';

runTripConfirmedSummary.innerHTML = `
  <div class="runtrip-confirmed-route">
    <div class="runtrip-confirmed-place">
      <span class="runtrip-confirmed-dot start-dot">S</span>

      <strong id="confirmedRunTripOrigin">
        출발지
      </strong>
    </div>

    <div
      id="confirmedRunTripWaypointRow"
      class="runtrip-confirmed-place"
    >
      <span class="runtrip-confirmed-dot waypoint-dot">↕</span>

      <strong id="confirmedRunTripWaypoints">
        경유지 없음
      </strong>
    </div>

    <div class="runtrip-confirmed-place">
      <span class="runtrip-confirmed-dot destination-dot">D</span>

      <strong id="confirmedRunTripDestination">
        도착지
      </strong>
    </div>
  </div>

    <div class="runtrip-confirmed-metrics">
    <div>
      <span>예상 거리</span>
      <strong id="confirmedRunTripDistance">0.0km</strong>
    </div>

    <div>
      <span>예상 시간</span>
      <strong id="confirmedRunTripDuration">0분</strong>
    </div>
  </div>

  <div class="runtrip-follow-actions">
    <button
      id="startRunTripFollowBtn"
      class="runtrip-follow-btn"
      type="button"
    >
      RUNTRIP 시작
    </button>
  </div>
`;

runTripEditorHeader.insertAdjacentElement(
  'afterend',
  runTripConfirmedSummary
);
const runTripDashboard = document.createElement('section');

runTripDashboard.id = 'runTripDashboard';
runTripDashboard.className = 'runtrip-dashboard hidden';

runTripDashboard.innerHTML = `
  <div class="runtrip-dashboard-top">
    <div>
      <span class="runtrip-dashboard-badge">
        RUNTRIP ACTIVE
      </span>

      <strong id="runTripDashboardGps">
        GPS 연결 준비
      </strong>
    </div>

    <span
      id="runTripDashboardFollowState"
      class="runtrip-dashboard-follow-state"
    >
      따라가기 ON
    </span>
  </div>

  <div class="runtrip-dashboard-timer-card">
    <span>경과 시간</span>

    <strong id="runTripDashboardTimer">
      00:00
    </strong>
  </div>

  <div class="runtrip-dashboard-distance-card">
    <span>실제 이동 거리</span>

    <strong id="runTripDashboardDistance">
      0.00 km
    </strong>
  </div>

    <div class="runtrip-dashboard-stats">
  <div>
    <span>평균 Pace</span>
    <strong id="runTripDashboardAveragePace">
      --'--"
    </strong>
  </div>

  <div>
    <span>전체 거리</span>
    <strong id="runTripDashboardPlannedDistance">
      0.0 km
    </strong>
  </div>

  <div>
    <span>칼로리</span>
    <strong id="runTripDashboardCalories">
      0 kcal
    </strong>
  </div>

  <div>
    <span>고도 상승</span>
    <strong id="runTripDashboardElevationGain">
      0 m
    </strong>
  </div>

  <div>
    <span>심박수</span>
    <strong id="runTripDashboardHeartRate">
      -- bpm
    </strong>
  </div>

  <div>
    <span>케이던스</span>
    <strong id="runTripDashboardCadence">
      -- spm
    </strong>
  </div>
</div>

  <div class="runtrip-dashboard-actions">
    <button
      id="pauseRunTripBtn"
      class="runtrip-dashboard-pause-btn"
      type="button"
    >
      일시정지
    </button>

    <button
      id="endRunTripBtn"
      class="runtrip-dashboard-end-btn"
      type="button"
    >
      RUNTRIP 종료
    </button>
  </div>
`;

runTripEditorHeader.insertAdjacentElement(
  'afterend',
  runTripDashboard
);

const runTripDashboardTimer = document.getElementById(
  'runTripDashboardTimer'
);

const runTripDashboardDistance = document.getElementById(
  'runTripDashboardDistance'
);

const runTripDashboardAveragePace = document.getElementById(
  'runTripDashboardAveragePace'
);

const runTripDashboardPlannedDistance = document.getElementById(
  'runTripDashboardPlannedDistance'
);
const runTripDashboardCalories = document.getElementById(
  'runTripDashboardCalories'
);

const runTripDashboardElevationGain = document.getElementById(
  'runTripDashboardElevationGain'
);

const runTripDashboardHeartRate = document.getElementById(
  'runTripDashboardHeartRate'
);

const runTripDashboardCadence = document.getElementById(
  'runTripDashboardCadence'
);
const runTripDashboardGps = document.getElementById(
  'runTripDashboardGps'
);

const runTripDashboardFollowState = document.getElementById(
  'runTripDashboardFollowState'
);

const pauseRunTripBtn = document.getElementById(
  'pauseRunTripBtn'
);

const endRunTripBtn = document.getElementById(
  'endRunTripBtn'
);
const runTripConfirmedRoute =
  runTripConfirmedSummary.querySelector(
    '.runtrip-confirmed-route'
  );
const confirmedRunTripOrigin = document.getElementById(
  'confirmedRunTripOrigin'
);

const confirmedRunTripWaypointRow = document.getElementById(
  'confirmedRunTripWaypointRow'
);

const confirmedRunTripWaypoints = document.getElementById(
  'confirmedRunTripWaypoints'
);

const confirmedRunTripDestination = document.getElementById(
  'confirmedRunTripDestination'
);

const confirmedRunTripDistance = document.getElementById(
  'confirmedRunTripDistance'
);

const confirmedRunTripDuration = document.getElementById(
  'confirmedRunTripDuration'
);

const startRunTripFollowBtn = document.getElementById(
  'startRunTripFollowBtn'
);

let isRunTripFollowing = false;
let runTripFollowWatchId = null;
let runTripFollowMarker = null;
let isRunTripPaused = false;

let runTripElapsedSeconds = 0;
let runTripTimerInterval = null;

let runTripActualDistanceMeters = 0;
let runTripLastValidPosition = null;
let runTripStartTime = null;

let runTripActualRouteCoordinates = [];
let runTripActualRouteSegments = [];
let runTripActiveRouteSegment = null;

function beginNewRunTripRouteSegment() {
  runTripActiveRouteSegment = [];

  runTripActualRouteSegments.push(
    runTripActiveRouteSegment
  );
}

function appendRunTripRoutePoint(point) {
  if (!runTripActiveRouteSegment) {
    beginNewRunTripRouteSegment();
  }

  runTripActualRouteCoordinates.push(
    point
  );

  runTripActiveRouteSegment.push(
    point
  );
}
function formatRunTripPlannedDuration(totalMinutes) {
  const safeMinutes = Math.max(
    0,
    Math.round(Number(totalMinutes) || 0)
  );

  const hours = Math.floor(
    safeMinutes / 60
  );

  const minutes =
    safeMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}시간 ${minutes}분`;
  }

  if (hours > 0) {
    return `${hours}시간`;
  }

  return `${minutes}분`;
}
function formatRunTripTimer(totalSeconds) {
  const safeSeconds = Math.max(
    0,
    Math.floor(totalSeconds)
  );

  const hours = Math.floor(
    safeSeconds / 3600
  );

  const minutes = Math.floor(
    (safeSeconds % 3600) / 60
  );

  const secondsPart =
    safeSeconds % 60;

  if (hours > 0) {
    return [
      String(hours).padStart(2, '0'),
      String(minutes).padStart(2, '0'),
      String(secondsPart).padStart(2, '0')
    ].join(':');
  }

  return [
    String(minutes).padStart(2, '0'),
    String(secondsPart).padStart(2, '0')
  ].join(':');
}
function calculateCalories(distanceMeters) {
  const distanceKm = Math.max(
    0,
    Number(distanceMeters) || 0
  ) / 1000;

  return Math.round(
    DEFAULT_RUNNER_WEIGHT_KG * distanceKm
  );
}
function updateRunningElevation(position) {
  const rawAltitude =
    position.coords.altitude;

  const rawAltitudeAccuracy =
    position.coords.altitudeAccuracy;

  if (
    rawAltitude === null ||
    rawAltitude === undefined
  ) {
    runningElevationGain.textContent =
      `${Math.round(totalElevationGain)} m`;

    return;
  }

  const altitude = Number(rawAltitude);

  const altitudeAccuracy =
    rawAltitudeAccuracy === null ||
    rawAltitudeAccuracy === undefined
      ? null
      : Number(rawAltitudeAccuracy);

  if (!Number.isFinite(altitude)) {
    return;
  }

  if (
    altitudeAccuracy !== null &&
    Number.isFinite(altitudeAccuracy) &&
    altitudeAccuracy > 30
  ) {
    return;
  }

  if (lastValidAltitude !== null) {
    const elevationDifference =
      altitude - lastValidAltitude;

    if (
      elevationDifference >= 2 &&
      elevationDifference <= 30
    ) {
      totalElevationGain +=
        elevationDifference;
    }
  }

  lastValidAltitude = altitude;

  runningElevationGain.textContent =
    `${Math.round(totalElevationGain)} m`;
}
function getRunTripPlannedDistanceMeters() {
  if (!latestRunTripRouteSummary) {
    return 0;
  }

  return (
    Number(
      latestRunTripRouteSummary.distanceKm
    ) || 0
  ) * 1000;
}

function updateRunTripDashboard() {
  const plannedDistanceMeters =
    getRunTripPlannedDistanceMeters();

  runTripDashboardTimer.textContent =
    formatRunTripTimer(
      runTripElapsedSeconds
    );
  runTripDashboardDistance.textContent =
  `${(
    runTripActualDistanceMeters / 1000
  ).toFixed(2)} km`;
  runTripDashboardPlannedDistance.textContent =
    `${(
      plannedDistanceMeters / 1000
    ).toFixed(1)} km`;

  runTripDashboardCalories.textContent =
  `${calculateCalories(
    runTripActualDistanceMeters
  )} kcal`;

runTripDashboardElevationGain.textContent =
  '0 m';

runTripDashboardHeartRate.textContent =
  '-- bpm';

runTripDashboardCadence.textContent =
  '-- spm';

  runTripDashboardAveragePace.textContent =
    formatPaceFromSeconds(
      runTripElapsedSeconds,
      runTripActualDistanceMeters
    );

  runTripDashboardGps.textContent =
    isRunTripPaused
      ? 'GPS 일시정지'
      : runTripLastValidPosition
        ? 'GPS 연결됨'
        : 'GPS 위치 확인 중';

  runTripDashboardFollowState.textContent =
    isRunTripPaused
      ? '따라가기 멈춤'
      : '따라가기 ON';

  runTripDashboardFollowState.classList.toggle(
    'is-paused',
    isRunTripPaused
  );

  pauseRunTripBtn.textContent =
    isRunTripPaused
      ? '다시 시작'
      : '일시정지';
}

function resetRunTripDashboard() {
  clearInterval(
    runTripTimerInterval
  );

  runTripTimerInterval = null;

  runTripElapsedSeconds = 0;
  runTripActualDistanceMeters = 0;

  runTripLastValidPosition = null;

  isRunTripPaused = false;

  runTripDashboard.classList.add(
    'hidden'
  );

  updateRunTripDashboard();
}

function startRunTripTimer() {
  clearInterval(
    runTripTimerInterval
  );

  runTripTimerInterval =
    setInterval(function () {
      if (
        !isRunTripFollowing ||
        isRunTripPaused
      ) {
        return;
      }

      runTripElapsedSeconds++;

      updateRunTripDashboard();
    }, 1000);
}
function showRunTripEditMode() {
  stopRunTripFollowing({
    restoreRoute: false
  });

  isRunTripConfirmed = false;

  runTripPanel.classList.remove('runtrip-confirmed');

  runTripConfirmedSummary.classList.add('hidden');

  createRunTripBtn.textContent = '확인';

  updateRunTripCreateButton();

  requestAnimationFrame(function () {
  requestAnimationFrame(function () {
    map.invalidateSize({
      pan: false
    });

    renderRunTripMapPreview();
  });
});
}

function showRunTripConfirmedMode() {
  if (!latestRunTripRouteSummary) {
    return;
  }

  const draft = getRunTripDraft();

  confirmedRunTripOrigin.textContent =
  getRunTripPlaceDisplayName(
    draft.origin
  ) || '출발지';

  confirmedRunTripDestination.textContent =
  getRunTripPlaceDisplayName(
    draft.destination
  ) || '도착지';

  if (draft.waypoints.length > 0) {
    confirmedRunTripWaypointRow.classList.remove('hidden');

    confirmedRunTripWaypoints.textContent =
      `경유지 ${draft.waypoints.length}개`;
  } else {
    confirmedRunTripWaypointRow.classList.add('hidden');
  }

  confirmedRunTripDistance.textContent =
    `${latestRunTripRouteSummary.distanceKm.toFixed(1)}km`;

  confirmedRunTripDuration.textContent =
  `약 ${formatRunTripPlannedDuration(
    latestRunTripRouteSummary.durationMinutes
  )}`;

  isRunTripConfirmed = true;

  runTripPanel.classList.add('runtrip-confirmed');

  runTripConfirmedSummary.classList.remove('hidden');

  createRunTripBtn.disabled = false;
  createRunTripBtn.textContent =
  'RUNTRIP 시작';

  requestAnimationFrame(function () {
  requestAnimationFrame(function () {
    map.invalidateSize({
      pan: false
    });

    if (latestRunTripRouteSummary.bounds) {
      fitRunTripMapBounds(
        latestRunTripRouteSummary.bounds
      );
    }
  });
});
}
function openConfirmedRunTripRouteEditor() {
  if (
    !isRunTripConfirmed ||
    isRunTripFollowing
  ) {
    return;
  }

  showRunTripEditMode();
}

runTripConfirmedRoute.setAttribute(
  'role',
  'button'
);

runTripConfirmedRoute.setAttribute(
  'tabindex',
  '0'
);

runTripConfirmedRoute.setAttribute(
  'aria-label',
  '출발지 경유지 도착지 수정'
);

runTripConfirmedRoute.addEventListener(
  'click',
  function () {
    openConfirmedRunTripRouteEditor();
  }
);

runTripConfirmedRoute.addEventListener(
  'keydown',
  function (event) {
    if (
      event.key !== 'Enter' &&
      event.key !== ' '
    ) {
      return;
    }

    event.preventDefault();

    openConfirmedRunTripRouteEditor();
  }
);
function updateRunTripFollowButton() {
  if (!startRunTripFollowBtn) {
    return;
  }

  startRunTripFollowBtn.textContent =
    isRunTripFollowing
      ? 'RUNTRIP 종료'
      : 'RUNTRIP 시작';

  startRunTripFollowBtn.classList.toggle(
    'is-following',
    isRunTripFollowing
  );
}

function stopRunTripFollowing(options = {}) {
  const shouldRestoreRoute =
    options.restoreRoute !== false;

  if (
    runTripFollowWatchId !== null &&
    runTripFollowWatchId !== undefined
  ) {
    navigator.geolocation.clearWatch(
      runTripFollowWatchId
    );
  }

  clearInterval(
    runTripTimerInterval
  );

  runTripTimerInterval = null;
  runTripFollowWatchId = null;

  isRunTripFollowing = false;
  isRunTripPaused = false;
  if (appBottomNavigation) {
  appBottomNavigation.classList.remove(
    'hidden'
  );

  updateBottomNavigationActiveState(
    'runtrip'
  );
}

  runTripPanel.classList.remove(
    'runtrip-following'
  );

  if (runTripFollowMarker) {
    map.removeLayer(
      runTripFollowMarker
    );

    runTripFollowMarker = null;
  }

  resetRunTripDashboard();
  updateRunTripFollowButton();

  if (
    shouldRestoreRoute &&
    latestRunTripRouteSummary?.bounds
  ) {
    requestAnimationFrame(function () {
      fitRunTripMapBounds(
        latestRunTripRouteSummary.bounds
      );
    });
  }
}
function startRunTripLocationWatch() {
  if (
    runTripFollowWatchId !== null &&
    runTripFollowWatchId !== undefined
  ) {
    navigator.geolocation.clearWatch(
      runTripFollowWatchId
    );
  }

  runTripFollowWatchId =
    navigator.geolocation.watchPosition(
      function (position) {
        if (
          !isRunTripFollowing ||
          isRunTripPaused
        ) {
          return;
        }

        const latitude =
          position.coords.latitude;

        const longitude =
          position.coords.longitude;

        const accuracy =
          position.coords.accuracy;

        if (accuracy > MAX_ACCURACY) {
          runTripDashboardGps.textContent =
            `GPS 정확도 확인 중 · ${Math.round(
              accuracy
            )}m`;

          return;
        }

        const currentPosition = {
          latitude: latitude,
          longitude: longitude
        };

        if (runTripLastValidPosition) {
          const distanceFromLast =
            calculateDistance(
              runTripLastValidPosition.latitude,
              runTripLastValidPosition.longitude,
              latitude,
              longitude
            );

          if (
            distanceFromLast >= MIN_DISTANCE
          ) {
            runTripActualDistanceMeters +=
              distanceFromLast;

            runTripLastValidPosition =
              currentPosition;

          }
        } else {
          runTripLastValidPosition =
            currentPosition;

        }

        const currentLatLng = [
          latitude,
          longitude
        ];

        appendRunTripRoutePoint([
          latitude,
          longitude
        ]);

        if (!runTripFollowMarker) {
          runTripFollowMarker =
            L.marker(
              currentLatLng,
              {
                icon:
                  createRunTripFollowMarkerIcon(),

                zIndexOffset: 1000
              }
            ).addTo(map);
        } else {
          runTripFollowMarker.setLatLng(
            currentLatLng
          );
        }

        map.setView(
          currentLatLng,
          Math.max(
            map.getZoom(),
            17
          ),
          {
            animate: false
          }
        );

        updateRunTripDashboard();
      },

      function (error) {
        console.error(
          'RunTrip 위치 추적 오류:',
          error
        );

        runTripDashboardGps.textContent =
          'GPS 연결 실패';

        stopRunTripFollowing();

        alert(
          '현재 위치를 추적하지 못했어요. Safari의 위치 권한을 확인해 주세요.'
        );
      },

      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 1000
      }
    );
}
function startRunTripFollowing() {
  if (!latestRunTripRouteSummary) {
    alert(
      '먼저 실제 보행 경로를 확인해 주세요.'
    );

    return;
  }

  if (!navigator.geolocation) {
    alert(
      '이 기기에서는 현재 위치 기능을 사용할 수 없어요.'
    );

    return;
  }

  resetRunTripDashboard();

  runTripStartTime = new Date();

  runTripActualRouteCoordinates = [];
  runTripActualRouteSegments = [];
  runTripActiveRouteSegment = null;

  beginNewRunTripRouteSegment();

  isRunTripFollowing = true;
  isRunTripPaused = false;
  if (appBottomNavigation) {
  appBottomNavigation.classList.add(
    'hidden'
  );
}

  runTripPanel.classList.add(
    'runtrip-following'
  );

  runTripDashboard.classList.remove(
    'hidden'
  );

  updateRunTripFollowButton();
  updateRunTripDashboard();

  startRunTripTimer();
  startRunTripLocationWatch();
}
function saveRunTripRecord() {
  if (!runTripStartTime) {
    return null;
  }

  const runTripEndTime = new Date();

  const draft = getRunTripDraft();

const savedOriginPlace =
  createRunTripPlaceRecord(
    draft.origin
  );

const savedDestinationPlace =
  createRunTripPlaceRecord(
    draft.destination
  );

const savedWaypointPlaces =
  draft.waypoints
    .map(function (waypoint) {
      return createRunTripPlaceRecord(
        waypoint
      );
    })
    .filter(Boolean);

const actualDistanceKm =
  runTripActualDistanceMeters / 1000;

  const plannedDistanceKm =
    latestRunTripRouteSummary
      ? Number(
          latestRunTripRouteSummary.distanceKm
        ) || 0
      : 0;

  const plannedDurationMinutes =
    latestRunTripRouteSummary
      ? Number(
          latestRunTripRouteSummary.durationMinutes
        ) || 0
      : 0;

  const actualRoute =
    runTripActualRouteCoordinates.map(
      function (point) {
        return [
          Number(point[0]),
          Number(point[1])
        ];
      }
    );

  const plannedRoute =
    latestRunTripRouteSummary &&
    Array.isArray(
      latestRunTripRouteSummary.coordinates
    )
      ? latestRunTripRouteSummary.coordinates.map(
          function (point) {
            return [
              Number(point[0]),
              Number(point[1])
            ];
          }
        )
      : [];

  const record = {
    id: Date.now(),

    activityType: 'runtrip',

    date:
      runTripEndTime.toLocaleDateString(),

    startTime:
      runTripStartTime.toLocaleTimeString(
        [],
        {
          hour: '2-digit',
          minute: '2-digit'
        }
      ),

    endTime:
      runTripEndTime.toLocaleTimeString(
        [],
        {
          hour: '2-digit',
          minute: '2-digit'
        }
      ),

    duration:
      formatRunTripTimer(
        runTripElapsedSeconds
      ),

    distance:
      actualDistanceKm.toFixed(2),

    calories:
      calculateCalories(
        runTripActualDistanceMeters
      ),

pace:
      formatPaceFromSeconds(
        runTripElapsedSeconds,
        runTripActualDistanceMeters
      ),

    emotionalPace:
      'RunTrip Journey',

    originName:
       getRunTripPlaceDisplayName(
         draft.origin
      ) || '출발지',

    destinationName:
      getRunTripPlaceDisplayName(
        draft.destination
      ) || '도착지',

    waypointNames:
       draft.waypoints.map(
        function (waypoint) {
          return getRunTripPlaceDisplayName(
        waypoint
      );
    }
  ),

originPlace:
  savedOriginPlace,

destinationPlace:
  savedDestinationPlace,

waypointPlaces:
  savedWaypointPlaces,

    returnToStart:
      draft.returnToStart,

    plannedDistance:
      plannedDistanceKm.toFixed(2),

    plannedDurationMinutes:
      plannedDurationMinutes,

    routeCoordinates:
  actualRoute,

routeSegments:
  runTripActualRouteSegments
    .filter(function (segment) {
      return (
        Array.isArray(segment) &&
        segment.length >= 2
      );
    })
    .map(function (segment) {
      return segment.map(
        function (point) {
          return [
            Number(point[0]),
            Number(point[1])
          ];
        }
      );
    }),

plannedRouteCoordinates:
  plannedRoute,

    photo: '',

    memo: ''
  };

  runRecords.unshift(record);

  localStorage.setItem(
    'runRecords',
    JSON.stringify(runRecords)
  );

  renderRunRecords();
  renderRecordProfileFeed();
  renderMonthlyReport();

  console.log(
    '저장된 RunTrip 기록:',
    record
  );

  return record;
}
function getPlaceSearchUrl(query) {
  const baseUrl =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
      ? 'https://freeruntrip.vercel.app/api/place-search'
      : '/api/place-search';

  return `${baseUrl}?q=${encodeURIComponent(query)}`;
}

function escapePlaceSearchText(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
function getRunTripPlaceDisplayName(place) {
  if (!place) {
    return '';
  }

  return (
    place.displayName ||
    place.name ||
    place.address ||
    ''
  );
}

function getRunTripPlacePrimaryText(place) {
  if (!place) {
    return '';
  }

  return (
    place.primaryText ||
    place.name ||
    place.address ||
    ''
  );
}

function getRunTripPlaceSecondaryText(place) {
  if (!place) {
    return '';
  }

  return (
    place.secondaryText ||
    place.address ||
    ''
  );
}
function hidePlaceSearchResults(resultsElement) {
  resultsElement.innerHTML = '';
  resultsElement.classList.add('hidden');
}
function showPlaceSearchMessage(resultsElement, message) {
  resultsElement.innerHTML = `
    <div class="runtrip-place-search-message">
      ${escapePlaceSearchText(message)}
    </div>
  `;

  resultsElement.classList.remove('hidden');
}

function renderPlaceSearchResults(
  resultsElement,
  places,
  onPlaceSelect
) {
  if (!places || places.length === 0) {
    showPlaceSearchMessage(
      resultsElement,
      '검색 결과가 없어요. 다른 장소명이나 주소를 입력해 주세요.'
    );
    return;
  }

  resultsElement.innerHTML = places
    .map(function (place, index) {
      return `
        <button
          class="runtrip-place-search-item"
          type="button"
          data-place-index="${index}"
        >
          <span class="runtrip-place-search-name">
  ${escapePlaceSearchText(
    getRunTripPlacePrimaryText(place)
  )}
</span>

${
  getRunTripPlaceSecondaryText(place)
    ? `
      <span class="runtrip-place-search-address">
        ${escapePlaceSearchText(
          getRunTripPlaceSecondaryText(place)
        )}
      </span>
    `
    : ''
}
        </button>
      `;
    })
    .join('');

  resultsElement.classList.remove('hidden');

  const placeButtons = resultsElement.querySelectorAll(
    '.runtrip-place-search-item'
  );

  placeButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      const placeIndex = Number(button.dataset.placeIndex);
      const selectedPlace = places[placeIndex];

      if (selectedPlace) {
        onPlaceSelect(selectedPlace);
      }
    });
  });
}

async function searchRunTripPlaces(
  query,
  resultsElement,
  onPlaceSelect
) {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length < 2) {
    hidePlaceSearchResults(resultsElement);
    return;
  }

  showPlaceSearchMessage(resultsElement, '장소를 찾고 있어요…');

  try {
    const response = await fetch(getPlaceSearchUrl(trimmedQuery));
    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || '장소 검색에 실패했어요.'
      );
    }

    renderPlaceSearchResults(
      resultsElement,
      data.places || [],
      onPlaceSelect
    );
  } catch (error) {
    showPlaceSearchMessage(
      resultsElement,
      error.message || '장소 검색 중 문제가 발생했어요.'
    );
  }
}
function closeRunTripSearchScreen() {
  runTripSearchRequestId++;

  clearTimeout(runTripSearchTimer);

  runTripSearchScreen.classList.add('hidden');
  runTripSearchResults.innerHTML = '';
  runTripSearchInput.value = '';
  activeRunTripSearchTarget = null;

  map.getContainer().style.display = 'block';

  setTimeout(function () {
    map.invalidateSize();
  }, 100);
}

function openRunTripSearchScreen(searchTarget) {
  activeRunTripSearchTarget = searchTarget;

  runTripSearchTitle.textContent = searchTarget.title;

const isDefaultCurrentLocation =
  searchTarget.inputElement === runTripOriginInput &&
  !selectedRunTripOrigin &&
  searchTarget.inputElement.value === '현재 위치';

runTripSearchInput.value = isDefaultCurrentLocation
  ? ''
  : searchTarget.inputElement.value || '';

  runTripSearchGuide.textContent =
    '장소명 또는 주소를 입력해 검색해 보세요.';

  runTripSearchResults.innerHTML = '';

  map.getContainer().style.display = 'none';
  runTripSearchScreen.classList.remove('hidden');

  setTimeout(function () {
    runTripSearchInput.focus();
  }, 100);
}

async function searchPlacesOnRunTripSearchScreen() {
  const query = runTripSearchInput.value.trim();
  const requestId = ++runTripSearchRequestId;

  if (query.length < 2) {
    runTripSearchResults.innerHTML = '';

    runTripSearchGuide.textContent =
      '두 글자 이상 입력하면 장소를 검색할 수 있어요.';

    return;
  }

  runTripSearchGuide.textContent =
    '장소를 찾고 있어요…';

  runTripSearchResults.innerHTML = '';

  try {
    const response = await fetch(getPlaceSearchUrl(query));
    const data = await response.json();

    if (
      requestId !== runTripSearchRequestId ||
      runTripSearchScreen.classList.contains('hidden')
    ) {
      return;
    }

    if (!response.ok) {
      throw new Error(
        data.error || '장소 검색에 실패했어요.'
      );
    }

    const places = data.places || [];

    if (places.length === 0) {
      runTripSearchGuide.textContent =
        '검색 결과가 없어요. 다른 장소명이나 주소를 입력해 주세요.';

      return;
    }

    runTripSearchGuide.textContent =
      `${places.length}개의 장소를 찾았어요.`;

    renderPlaceSearchResults(
      runTripSearchResults,
      places,
      function (place) {
        if (!activeRunTripSearchTarget) {
          return;
        }

        activeRunTripSearchTarget.onPlaceSelect(place);

        runTripSearchInput.blur();
        closeRunTripSearchScreen();
      }
    );
  } catch (error) {
    if (requestId !== runTripSearchRequestId) {
      return;
    }

    runTripSearchGuide.textContent =
      error.message || '장소 검색 중 문제가 발생했어요.';
  }
}

runTripSearchInput.addEventListener('input', function () {
  clearTimeout(runTripSearchTimer);

  runTripSearchTimer = setTimeout(function () {
    searchPlacesOnRunTripSearchScreen();
  }, 350);
});

clearRunTripSearchBtn.addEventListener('click', function () {
  runTripSearchInput.value = '';
  runTripSearchResults.innerHTML = '';

  runTripSearchGuide.textContent =
    '장소명 또는 주소를 입력해 검색해 보세요.';

  runTripSearchInput.focus();
});

closeRunTripSearchBtn.addEventListener('click', function () {
  runTripSearchInput.blur();
  closeRunTripSearchScreen();
});
function connectRunTripPlaceSearch(
  inputElement,
  resultsElement,
  onTyping,
  onPlaceSelect
) {
  inputElement.readOnly = true;

  inputElement.addEventListener('click', function () {
    const inputWrap = inputElement.closest('.runtrip-input-wrap');
    const labelElement = inputWrap
      ? inputWrap.querySelector('label')
      : null;

    const labelText = labelElement
      ? labelElement.textContent.trim()
      : '장소';

    inputElement.blur();

    openRunTripSearchScreen({
      title: `${labelText} 검색`,
      inputElement: inputElement,
      onPlaceSelect: onPlaceSelect
    });
  });

  inputElement.addEventListener('focus', function () {
    inputElement.blur();
  });

  hidePlaceSearchResults(resultsElement);
}

connectRunTripPlaceSearch(
  runTripOriginInput,
  runTripOriginSearchResults,
  function () {
    selectedRunTripOrigin = null;
    updateRunTripCreateButton();
    renderRunTripMapPreview();
  },
  function (place) {
  const displayName =
    getRunTripPlaceDisplayName(place);

  selectedRunTripOrigin = place;

  runTripOriginInput.value =
    displayName;

  hidePlaceSearchResults(
    runTripOriginSearchResults
  );

  updateRunTripCreateButton();
  renderRunTripMapPreview();

  runTripStatus.textContent =
    `${displayName}을(를) 출발지로 선택했어요.`;
}
);

connectRunTripPlaceSearch(
  runTripDestinationInput,
  runTripDestinationSearchResults,
  function () {
    selectedRunTripDestination = null;
    updateRunTripCreateButton();
    renderRunTripMapPreview();
  },
  function (place) {
  const displayName =
    getRunTripPlaceDisplayName(place);

  selectedRunTripDestination = place;

  runTripDestinationInput.value =
    displayName;

  hidePlaceSearchResults(
    runTripDestinationSearchResults
  );

  updateRunTripCreateButton();
  renderRunTripMapPreview();

  runTripStatus.textContent =
    `${displayName}을(를) 도착지로 선택했어요.`;
}
);
const MAX_RUNTRIP_WAYPOINTS = 3;
let runTripWaypointCount = 0;
function updateRunTripCreateButton() {
  const hasOrigin = Boolean(
    getRunTripPlaceLatLng(selectedRunTripOrigin)
  );

  const hasDestination = Boolean(
    getRunTripPlaceLatLng(selectedRunTripDestination)
  );

  const waypointInputs = runTripWaypoints.querySelectorAll(
    '.runtrip-waypoint-input'
  );

  const hasInvalidWaypoint = Array.from(waypointInputs).some(
    function (input) {
      return input.value.trim().length > 0 && !input.runTripPlace;
    }
  );

  createRunTripBtn.disabled =
    isGettingRunTripCurrentLocation ||
    !hasOrigin ||
    !hasDestination ||
    hasInvalidWaypoint;

  if (isGettingRunTripCurrentLocation) {
    runTripStatus.textContent =
      '현재 위치를 확인하고 있어요…';
    return;
  }

  if (!hasOrigin) {
    runTripStatus.textContent =
      '출발지 검색 결과를 선택하거나 현재 위치를 사용해 주세요.';
    return;
  }

  if (!hasDestination) {
    runTripStatus.textContent =
      '도착지를 검색한 뒤 목록에서 선택해 주세요.';
    return;
  }

  if (hasInvalidWaypoint) {
    runTripStatus.textContent =
      '경유지를 검색한 뒤 목록에서 선택해 주세요.';
  }
}

function updateRunTripWaypointControls() {
  addWaypointBtn.disabled =
    runTripWaypointCount >= MAX_RUNTRIP_WAYPOINTS;
}

function refreshRunTripWaypointLabels() {
  const rows = runTripWaypoints.querySelectorAll(
    '.runtrip-waypoint-row'
  );

  rows.forEach(function (row, index) {
    const number = index + 1;

    const point = row.querySelector('.waypoint-point');
    const label = row.querySelector('.waypoint-label');

    if (point) {
      point.textContent = number;
    }

    if (label) {
      label.textContent = `경유지 ${number}`;
    }
  });

  runTripWaypointCount = rows.length;
  updateRunTripWaypointControls();
}
function getRunTripOrderedPlaceSlots() {
  const waypointInputs = Array.from(
    runTripWaypoints.querySelectorAll(
      '.runtrip-waypoint-input'
    )
  );

  const slots = [
    {
      inputElement: runTripOriginInput,

      getPlace: function () {
        return selectedRunTripOrigin;
      },

      setPlace: function (place) {
        selectedRunTripOrigin = place;
        runTripOriginInput.value = place
          ? getRunTripPlaceDisplayName(place)
          : '';
      }
    }
  ];

  waypointInputs.forEach(function (input) {
    slots.push({
      inputElement: input,

      getPlace: function () {
        return input.runTripPlace;
      },

      setPlace: function (place) {
        input.runTripPlace = place;
        input.value = place
          ? getRunTripPlaceDisplayName(place)
          : '';
      }
    });
  });

  slots.push({
    inputElement: runTripDestinationInput,

    getPlace: function () {
      return selectedRunTripDestination;
    },

    setPlace: function (place) {
      selectedRunTripDestination = place;
      runTripDestinationInput.value = place
        ? getRunTripPlaceDisplayName(place)
        : '';
    }
  });

  return slots;
}

function swapRunTripPlaceSlots(firstIndex, secondIndex) {
  const slots = getRunTripOrderedPlaceSlots();

  const firstSlot = slots[firstIndex];
  const secondSlot = slots[secondIndex];

  if (!firstSlot || !secondSlot) {
    return;
  }

  const firstPlace = firstSlot.getPlace();
  const secondPlace = secondSlot.getPlace();

  firstSlot.setPlace(secondPlace);
  secondSlot.setPlace(firstPlace);

  refreshRunTripWaypointLabels();
  updateRunTripCreateButton();
  renderRunTripMapPreview();

  runTripStatus.textContent =
    '장소 순서를 변경하고 실제 보행 경로를 다시 계산했어요.';
}

function handleRunTripRouteOrderChange(inputElement) {
  const slots = getRunTripOrderedPlaceSlots();

  const currentIndex = slots.findIndex(function (slot) {
    return slot.inputElement === inputElement;
  });

  if (currentIndex === -1 || slots.length < 2) {
    return;
  }

  const targetIndex =
    currentIndex === slots.length - 1
      ? currentIndex - 1
      : currentIndex + 1;

  swapRunTripPlaceSlots(
    currentIndex,
    targetIndex
  );
}

function connectRunTripRouteOrderButton(
  rowElement,
  inputElement
) {
  if (!rowElement || !inputElement) {
    return;
  }

  const handle = rowElement.querySelector(
    '.runtrip-route-handle'
  );

  if (!handle || handle.dataset.orderConnected === 'true') {
    return;
  }

  handle.dataset.orderConnected = 'true';
  handle.setAttribute('role', 'button');
  handle.setAttribute('tabindex', '0');
  handle.setAttribute(
    'aria-label',
    '다음 장소와 순서 바꾸기'
  );

  handle.addEventListener('click', function (event) {
    event.preventDefault();
    event.stopPropagation();

    handleRunTripRouteOrderChange(inputElement);
  });

  handle.addEventListener('keydown', function (event) {
    if (
      event.key !== 'Enter' &&
      event.key !== ' '
    ) {
      return;
    }

    event.preventDefault();

    handleRunTripRouteOrderChange(inputElement);
  });
}

function connectExistingRunTripRouteOrderButtons() {
  connectRunTripRouteOrderButton(
    runTripOriginInput.closest('.runtrip-route-row'),
    runTripOriginInput
  );

  const waypointInputs = runTripWaypoints.querySelectorAll(
    '.runtrip-waypoint-input'
  );

  waypointInputs.forEach(function (input) {
    connectRunTripRouteOrderButton(
      input.closest('.runtrip-route-row'),
      input
    );
  });

  connectRunTripRouteOrderButton(
    runTripDestinationInput.closest('.runtrip-route-row'),
    runTripDestinationInput
  );
}
function addRunTripWaypoint() {
  if (runTripWaypointCount >= MAX_RUNTRIP_WAYPOINTS) {
    return;
  }

  const waypointRow = document.createElement('div');

  waypointRow.className =
    'runtrip-route-row runtrip-waypoint-row';

  waypointRow.innerHTML = `
    <div class="runtrip-route-handle">↕</div>

    <div class="runtrip-point waypoint-point">
      ${runTripWaypointCount + 1}
    </div>

    <div class="runtrip-input-wrap">
      <label class="waypoint-label">
        경유지 ${runTripWaypointCount + 1}
      </label>

      <input
        class="runtrip-waypoint-input"
        type="text"
        autocomplete="off"
        placeholder="들르고 싶은 장소를 입력하세요"
      />

      <div class="runtrip-place-search-results hidden"></div>
    </div>

    <button
      class="runtrip-remove-waypoint-btn"
      type="button"
      aria-label="경유지 삭제"
    >
      −
    </button>
  `;

  const waypointInput = waypointRow.querySelector(
    '.runtrip-waypoint-input'
  );

  const waypointSearchResults = waypointRow.querySelector(
    '.runtrip-place-search-results'
  );

  waypointInput.runTripPlace = null;

  connectRunTripPlaceSearch(
    waypointInput,
    waypointSearchResults,
   function () {
  waypointInput.runTripPlace = null;
  updateRunTripCreateButton();
  renderRunTripMapPreview();
},
    function (place) {
  const displayName =
    getRunTripPlaceDisplayName(place);

  waypointInput.runTripPlace = place;

  waypointInput.value =
    displayName;

  hidePlaceSearchResults(
    waypointSearchResults
  );

  updateRunTripCreateButton();
  renderRunTripMapPreview();

  runTripStatus.textContent =
    `${displayName}을(를) 경유지로 선택했어요.`;
}
  );

  const removeBtn = waypointRow.querySelector(
    '.runtrip-remove-waypoint-btn'
  );

 removeBtn.addEventListener('click', function () {
  waypointRow.remove();
  refreshRunTripWaypointLabels();
  updateRunTripCreateButton();
  renderRunTripMapPreview();
});

  runTripWaypoints.appendChild(waypointRow);

  connectRunTripRouteOrderButton(
  waypointRow,
  waypointInput
);

refreshRunTripWaypointLabels();
waypointInput.click();
}
function getRunTripDraft() {
  const waypointInputs = runTripWaypoints.querySelectorAll(
    '.runtrip-waypoint-input'
  );

  const waypoints = Array.from(waypointInputs)
    .map(function (input) {
      return input.runTripPlace;
    })
    .filter(Boolean);

  return {
    origin: selectedRunTripOrigin,
    destination: selectedRunTripDestination,
    waypoints: waypoints,
    returnToStart: runTripReturnToggle.checked
  };
}
function getRunTripPlaceLatLng(place) {
  if (!place) {
    return null;
  }

  const latitude = Number(
    place.latitude ?? place.lat ?? place.y
  );

  const longitude = Number(
    place.longitude ?? place.lng ?? place.x
  );

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return [latitude, longitude];
}
function createRunTripPlaceRecord(place) {
  if (!place) {
    return null;
  }

  const latLng =
    getRunTripPlaceLatLng(place);

  if (!latLng) {
    return null;
  }

  return {
    displayName:
      getRunTripPlaceDisplayName(place),

    primaryText:
      getRunTripPlacePrimaryText(place),

    secondaryText:
      getRunTripPlaceSecondaryText(place),

    name:
      place.name || '',

    address:
      place.address || '',

    roadAddress:
      place.roadAddress || '',

    lotAddress:
      place.lotAddress || '',

    buildingName:
      place.buildingName || '',

    resultType:
      place.resultType || '',

    source:
      place.source || '',

    latitude:
      Number(latLng[0]),

    longitude:
      Number(latLng[1])
  };
}
function createRunTripPreviewMarkerIcon(label, type) {
  return L.divIcon({
    className: `runtrip-preview-marker ${type}`,
    html: `
      <div class="runtrip-preview-marker-body">
        <span>${escapePlaceSearchText(label)}</span>
      </div>
      <div class="runtrip-preview-marker-tip"></div>
    `,
    iconSize: [42, 50],
    iconAnchor: [21, 48]
  });
}
function createRunTripFollowMarkerIcon() {
  return L.divIcon({
    className: 'runtrip-follow-marker',
    html: `
      <div class="runtrip-follow-marker-pulse">
        <span></span>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });
}
function clearRunTripMapPreview() {
  runTripPreviewLayer.clearLayers();
}
function getRunTripMapFitOptions() {
  const mapContainer = map.getContainer();

  const routeEditor = runTripEditorCard;

  const mapRect = mapContainer.getBoundingClientRect();

  let coveredTopHeight = 0;

  if (routeEditor) {
    const editorRect = routeEditor.getBoundingClientRect();

    coveredTopHeight = Math.max(
      0,
      Math.min(editorRect.bottom, mapRect.bottom) -
        Math.max(editorRect.top, mapRect.top)
    );
  }

  const horizontalPadding = 36;
  const markerPadding = 48;
  const topPadding = Math.max(
    120,
    Math.round(coveredTopHeight + markerPadding)
  );

  return {
    paddingTopLeft: [
      horizontalPadding,
      topPadding
    ],

    paddingBottomRight: [
      horizontalPadding,
      110
    ],

    maxZoom: 16,
    animate: true
  };
}

function fitRunTripMapBounds(bounds) {
  if (!bounds || !bounds.isValid()) {
    return;
  }

  map.invalidateSize({
    pan: false
  });

  map.fitBounds(
    bounds,
    getRunTripMapFitOptions()
  );
}
function getRunTripRouteUrl() {
  if (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  ) {
    return 'https://freeruntrip.vercel.app/api/runtrip-route';
  }

  return '/api/runtrip-route';
}

function convertRunTripPlaceToRoutePoint(place) {
  const latLng = getRunTripPlaceLatLng(place);

  if (!latLng) {
    return null;
  }

  return {
    lat: latLng[0],
    lng: latLng[1]
  };
}

async function requestRunTripRoute(
  origin,
  destination,
  waypoints,
  originName,
  destinationName
) {
  const response = await fetch(getRunTripRouteUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      origin: origin,
      destination: destination,
      waypoints: waypoints,
      originName: originName,
      destinationName: destinationName
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || '실제 보행 경로를 불러오지 못했어요.'
    );
  }

  return data;
}
async function renderRunTripMapPreview() {
  const requestId = ++runTripRouteRequestId;

  latestRunTripRouteSummary = null;

  clearRunTripMapPreview();

  const draft = getRunTripDraft();

  const previewMarkers = [];

  const originLatLng = getRunTripPlaceLatLng(draft.origin);

  if (originLatLng) {
    previewMarkers.push({
      label: 'S',
      type: 'start',
      latLng: originLatLng
    });
  }

  draft.waypoints.forEach(function (waypoint, index) {
    const waypointLatLng = getRunTripPlaceLatLng(waypoint);

    if (!waypointLatLng) {
      return;
    }

    previewMarkers.push({
      label: String(index + 1),
      type: 'waypoint',
      latLng: waypointLatLng
    });
  });

  const destinationLatLng = getRunTripPlaceLatLng(
    draft.destination
  );

  if (destinationLatLng) {
    previewMarkers.push({
      label: 'D',
      type: 'destination',
      latLng: destinationLatLng
    });
  }

  if (previewMarkers.length === 0) {
    return;
  }

  previewMarkers.forEach(function (marker) {
    L.marker(marker.latLng, {
      icon: createRunTripPreviewMarkerIcon(
        marker.label,
        marker.type
      ),
      interactive: false
    }).addTo(runTripPreviewLayer);
  });

  if (!originLatLng || !destinationLatLng) {
    const markerBounds = L.latLngBounds(
      previewMarkers.map(function (marker) {
        return marker.latLng;
      })
    );

   fitRunTripMapBounds(markerBounds);

    return;
  }

  const originPoint = convertRunTripPlaceToRoutePoint(
    draft.origin
  );

  const destinationPoint = convertRunTripPlaceToRoutePoint(
    draft.destination
  );

  const waypointPoints = draft.waypoints
    .map(convertRunTripPlaceToRoutePoint)
    .filter(Boolean);

  runTripStatus.textContent =
    '실제 보행 경로를 찾고 있어요…';

  try {
    const outwardRoute = await requestRunTripRoute(
      originPoint,
      destinationPoint,
      waypointPoints,
      getRunTripPlaceDisplayName(
         draft.origin
     ) || '출발지',

      getRunTripPlaceDisplayName(
         draft.destination
      ) || '도착지'
    );

    if (requestId !== runTripRouteRequestId) {
      return;
    }

    let routeCoordinates = outwardRoute.coordinates || [];
    let totalDistanceMeters =
      Number(outwardRoute.distanceMeters) || 0;

    let totalDurationSeconds =
      Number(outwardRoute.durationSeconds) || 0;

    if (draft.returnToStart) {
      const returnRoute = await requestRunTripRoute(
        destinationPoint,
        originPoint,
        [],
        getRunTripPlaceDisplayName(
           draft.destination
        ) || '도착지',

        getRunTripPlaceDisplayName(
           draft.origin
        ) || '출발지'
      );

      if (requestId !== runTripRouteRequestId) {
        return;
      }

      const returnCoordinates =
        Array.isArray(returnRoute.coordinates)
          ? returnRoute.coordinates
          : [];

      if (returnCoordinates.length > 0) {
        routeCoordinates = routeCoordinates.concat(
          returnCoordinates.slice(1)
        );
      }

      totalDistanceMeters +=
        Number(returnRoute.distanceMeters) || 0;

      totalDurationSeconds +=
        Number(returnRoute.durationSeconds) || 0;
    }

    if (routeCoordinates.length < 2) {
      throw new Error(
        '실제 보행 경로 좌표를 찾지 못했어요.'
      );
    }

    clearRunTripMapPreview();

    L.polyline(routeCoordinates, {
      color: '#facc15',
      weight: 6,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(runTripPreviewLayer);

    previewMarkers.forEach(function (marker) {
      L.marker(marker.latLng, {
        icon: createRunTripPreviewMarkerIcon(
          marker.label,
          marker.type
        ),
        interactive: false
      }).addTo(runTripPreviewLayer);
    });

    const routeBounds = L.latLngBounds(routeCoordinates);

    fitRunTripMapBounds(routeBounds);

    const distanceKm = totalDistanceMeters / 1000;

const durationMinutes = Math.max(
  1,
  Math.round(totalDurationSeconds / 60)
);

latestRunTripRouteSummary = {
  distanceKm: distanceKm,
  durationMinutes: durationMinutes,
  bounds: routeBounds,
  coordinates: routeCoordinates.map(function (point) {
    return [point[0], point[1]];
  })
};
  } catch (error) {
    if (requestId !== runTripRouteRequestId) {
      return;
    }
latestRunTripRouteSummary = null;
    runTripStatus.textContent =
      error.message || '실제 보행 경로를 불러오지 못했어요.';

    const fallbackPath = previewMarkers.map(function (marker) {
      return marker.latLng;
    });

    if (draft.returnToStart && fallbackPath.length >= 2) {
      fallbackPath.push(fallbackPath[0]);
    }

    if (fallbackPath.length >= 2) {
      L.polyline(fallbackPath, {
        color: '#facc15',
        weight: 6,
        opacity: 0.65,
        dashArray: '8 10',
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(runTripPreviewLayer);
    }

    const fallbackBounds = L.latLngBounds(fallbackPath);

    fitRunTripMapBounds(fallbackBounds);

    console.error('RunTrip route preview error:', error);
  }
}

function openRunTripPanel() {
  map.getContainer().style.display = 'block';

  controlsSection.style.display = 'none';
  recordsSection.classList.add('hidden');
  recordDetail.classList.add('hidden');
  profileFeedScreen.classList.add('hidden');
  monthlyReportScreen.classList.add('hidden');

  runTripPanel.classList.remove('hidden');

  requestAnimationFrame(function () {
   requestAnimationFrame(function () {
    map.invalidateSize({
      pan: false
    });

    renderRunTripMapPreview();
  });
});
}

function closeRunTripPanel() {
  stopRunTripFollowing({
    restoreRoute: false
  });

  runTripRouteRequestId++;

  isRunTripConfirmed = false;
  latestRunTripRouteSummary = null;

  runTripPanel.classList.remove('runtrip-confirmed');
  runTripConfirmedSummary.classList.add('hidden');

  createRunTripBtn.textContent = '확인';

  runTripPanel.classList.add('hidden');
  clearRunTripMapPreview();
  controlsSection.style.display = 'flex';
  recordsSection.classList.remove('hidden');

  setTimeout(function () {
    map.invalidateSize();
  }, 100);
}
const monthlyReportScreen = document.getElementById('monthlyReportScreen');
const backFromMonthlyReportBtn = document.getElementById('backFromMonthlyReportBtn');

const monthlyReportTitle = document.getElementById('monthlyReportTitle');
const monthlyReportSubtitle = document.getElementById('monthlyReportSubtitle');
const monthlyDistanceChart = document.getElementById('monthlyDistanceChart');
const monthlyReportRecentRuns = document.getElementById('monthlyReportRecentRuns');

const analysisDistance = document.getElementById('analysisDistance');
const analysisRunCount = document.getElementById('analysisRunCount');
const analysisAveragePace = document.getElementById('analysisAveragePace');
const analysisTotalDuration = document.getElementById('analysisTotalDuration');

const analysisMoodTitle = document.getElementById('analysisMoodTitle');
const analysisTopMood = document.getElementById('analysisTopMood');
const analysisMoodDescription = document.getElementById('analysisMoodDescription');
const analysisMoodRanking = document.getElementById('analysisMoodRanking');

const analysisChartTitle = document.getElementById('analysisChartTitle');
const analysisRecentTitle = document.getElementById('analysisRecentTitle');

const longTermStatsSection = document.getElementById('longTermStatsSection');
const longTermStatsTitle = document.getElementById('longTermStatsTitle');
const averageRunsPerWeek = document.getElementById('averageRunsPerWeek');
const averageDistancePerRun = document.getElementById('averageDistancePerRun');
const longTermAveragePace = document.getElementById('longTermAveragePace');
const averageDurationPerRun = document.getElementById('averageDurationPerRun');

const analysisTabs = document.querySelectorAll('.analysis-tab');
const previousPeriodBtn = document.getElementById('previousPeriodBtn');
const nextPeriodBtn = document.getElementById('nextPeriodBtn');

let selectedAnalysisMode = 'week';
let selectedAnalysisDate = new Date();

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
  const parts = String(
    durationText || '0:00'
  )
    .split(':')
    .map(Number);

  if (
    parts.some(function (part) {
      return !Number.isFinite(part);
    })
  ) {
    return 0;
  }

  if (parts.length === 3) {
    return (
      parts[0] * 3600 +
      parts[1] * 60 +
      parts[2]
    );
  }

  if (parts.length === 2) {
    return (
      parts[0] * 60 +
      parts[1]
    );
  }

  return 0;
}

function formatAnalysisDuration(totalSeconds) {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}`;
  }

  return `${minutes}:00`;
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

function getStartOfWeek(date) {
  const copiedDate = new Date(date);
  const day = copiedDate.getDay();
  const diff = day === 0 ? -6 : 1 - day;

  copiedDate.setDate(copiedDate.getDate() + diff);
  copiedDate.setHours(0, 0, 0, 0);

  return copiedDate;
}

function getEndOfWeek(date) {
  const start = getStartOfWeek(date);
  const end = new Date(start);

  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return end;
}

function isSameDate(dateA, dateB) {
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

function getAnalysisRecords() {
  const validRecords = runRecords.filter(function (record) {
    return Number(record.distance) > 0;
  });

  if (selectedAnalysisMode === 'all') {
    return validRecords;
  }

  return validRecords.filter(function (record) {
    const recordDate = parseRecordDate(record.date);

    if (!recordDate) {
      return false;
    }

    if (selectedAnalysisMode === 'week') {
      const startOfWeek = getStartOfWeek(selectedAnalysisDate);
      const endOfWeek = getEndOfWeek(selectedAnalysisDate);

      return recordDate >= startOfWeek && recordDate <= endOfWeek;
    }

    if (selectedAnalysisMode === 'month') {
      return (
        recordDate.getFullYear() === selectedAnalysisDate.getFullYear() &&
        recordDate.getMonth() === selectedAnalysisDate.getMonth()
      );
    }

    if (selectedAnalysisMode === 'year') {
      return recordDate.getFullYear() === selectedAnalysisDate.getFullYear();
    }

    return false;
  });
}

function getMoodSummary(records) {
  const moodCount = {};

  records.forEach(function (record) {
    const mood = record.emotionalPace || '마음 환기 Pace';

    if (!moodCount[mood]) {
      moodCount[mood] = 0;
    }

    moodCount[mood]++;
  });

  const ranking = Object.entries(moodCount)
    .map(function ([mood, count]) {
      return { mood, count };
    })
    .sort(function (a, b) {
      return b.count - a.count;
    });

  return ranking;
}

function getPeriodTitle() {
  const year = selectedAnalysisDate.getFullYear();
  const month = selectedAnalysisDate.getMonth();

  if (selectedAnalysisMode === 'week') {
    const start = getStartOfWeek(selectedAnalysisDate);
    const end = getEndOfWeek(selectedAnalysisDate);

    return `${start.getMonth() + 1}월 ${start.getDate()}일 ~ ${end.getMonth() + 1}월 ${end.getDate()}일`;
  }

  if (selectedAnalysisMode === 'month') {
    return `${year}년 ${month + 1}월`;
  }

  if (selectedAnalysisMode === 'year') {
    return `${year}년`;
  }

  const datedRecords = runRecords
    .map(function (record) {
      return parseRecordDate(record.date);
    })
    .filter(Boolean)
    .sort(function (a, b) {
      return a - b;
    });

  if (datedRecords.length === 0) {
    return '전체 기간';
  }

  const firstYear = datedRecords[0].getFullYear();
  const lastYear = datedRecords[datedRecords.length - 1].getFullYear();

  return firstYear === lastYear
    ? `${firstYear}년 전체`
    : `${firstYear}년 ~ ${lastYear}년`;
}

function renderMoodReport(records) {
  const ranking = getMoodSummary(records);

  if (ranking.length === 0) {
    analysisTopMood.textContent = '아직 선택된 Pace Mood가 없습니다';
    analysisMoodDescription.textContent =
      '러닝을 저장하면 감성 Pace가 함께 쌓입니다.';
    analysisMoodRanking.innerHTML = '';
    return;
  }

  const topMood = ranking[0];
  const percentage = Math.round((topMood.count / records.length) * 100);

  analysisTopMood.textContent = topMood.mood;
  analysisMoodDescription.textContent =
    `${topMood.count}회 선택 · 전체 러닝의 ${percentage}%`;

  analysisMoodRanking.innerHTML = ranking
    .slice(0, 3)
    .map(function (item, index) {
      return `
        <div class="mood-ranking-row">
          <span>${index + 1}</span>
          <strong>${item.mood}</strong>
          <em>${item.count}회</em>
        </div>
      `;
    })
    .join('');
}

function renderDistanceChart(records) {
  let chartData = [];
  let title = '';

  if (selectedAnalysisMode === 'week') {
    const start = getStartOfWeek(selectedAnalysisDate);
    const dayLabels = ['월', '화', '수', '목', '금', '토', '일'];

    chartData = dayLabels.map(function (label, index) {
      const targetDate = new Date(start);
      targetDate.setDate(start.getDate() + index);

      const distance = records.reduce(function (sum, record) {
        const recordDate = parseRecordDate(record.date);

        if (recordDate && isSameDate(recordDate, targetDate)) {
          return sum + Number(record.distance);
        }

        return sum;
      }, 0);

      return { label, distance };
    });

    title = '요일별 거리';
  }

  if (selectedAnalysisMode === 'month') {
    const year = selectedAnalysisDate.getFullYear();
    const month = selectedAnalysisDate.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();

    chartData = Array.from({ length: lastDay }, function (_, index) {
      const day = index + 1;

      const distance = records.reduce(function (sum, record) {
        const recordDate = parseRecordDate(record.date);

        if (recordDate && recordDate.getDate() === day) {
          return sum + Number(record.distance);
        }

        return sum;
      }, 0);

      return { label: `${day}일`, distance };
    });

    title = '날짜별 거리';
  }

  if (selectedAnalysisMode === 'year') {
    chartData = Array.from({ length: 12 }, function (_, index) {
      const distance = records.reduce(function (sum, record) {
        const recordDate = parseRecordDate(record.date);

        if (recordDate && recordDate.getMonth() === index) {
          return sum + Number(record.distance);
        }

        return sum;
      }, 0);

      return { label: `${index + 1}월`, distance };
    });

    title = '월별 거리';
  }

  if (selectedAnalysisMode === 'all') {
    const yearSet = new Set();

    records.forEach(function (record) {
      const recordDate = parseRecordDate(record.date);

      if (recordDate) {
        yearSet.add(recordDate.getFullYear());
      }
    });

    chartData = Array.from(yearSet)
      .sort(function (a, b) {
        return a - b;
      })
      .map(function (year) {
        const distance = records.reduce(function (sum, record) {
          const recordDate = parseRecordDate(record.date);

          if (recordDate && recordDate.getFullYear() === year) {
            return sum + Number(record.distance);
          }

          return sum;
        }, 0);

        return { label: `${year}`, distance };
      });

    title = '연도별 거리';
  }

  analysisChartTitle.textContent = title;

  const maxDistance = Math.max(
    ...chartData.map(function (item) {
      return item.distance;
    }),
    1
  );

  monthlyDistanceChart.innerHTML = chartData
    .map(function (item) {
      const height =
        item.distance > 0
          ? Math.max(12, Math.round((item.distance / maxDistance) * 125))
          : 4;

      return `
        <div class="monthly-bar-column">
          <span class="monthly-bar-value">
            ${item.distance > 0 ? item.distance.toFixed(1) : ''}
          </span>

          <div
            class="monthly-bar ${item.distance === 0 ? 'empty-bar' : ''}"
            style="height: ${height}px"
          ></div>

          <span class="monthly-bar-date">${item.label}</span>
        </div>
      `;
    })
    .join('');
}

function renderLongTermStats(records, totalDistanceKm, totalDurationSeconds) {
  const shouldShow =
    selectedAnalysisMode === 'year' ||
    selectedAnalysisMode === 'all';

  if (!shouldShow) {
    longTermStatsSection.classList.add('hidden');
    return;
  }

  longTermStatsSection.classList.remove('hidden');

  const runCount = records.length;
  const averageDistance =
    runCount > 0 ? totalDistanceKm / runCount : 0;

  const averageDuration =
    runCount > 0 ? totalDurationSeconds / runCount : 0;

  let weeksInPeriod = 1;

  if (records.length >= 2) {
    const dates = records
      .map(function (record) {
        return parseRecordDate(record.date);
      })
      .filter(Boolean)
      .sort(function (a, b) {
        return a - b;
      });

    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];

    weeksInPeriod = Math.max(
      1,
      Math.ceil((lastDate - firstDate + 86400000) / 604800000)
    );
  }

  const runsPerWeek = runCount / weeksInPeriod;

  longTermStatsTitle.textContent =
    selectedAnalysisMode === 'year'
      ? `${selectedAnalysisDate.getFullYear()}년 통계`
      : '전체 활동 통계';

  averageRunsPerWeek.textContent =
    `${runsPerWeek.toFixed(1)}러닝/주`;

  averageDistancePerRun.textContent =
    `${averageDistance.toFixed(1)}km/러닝`;

  longTermAveragePace.textContent =
    formatAveragePace(totalDurationSeconds, totalDistanceKm);

  averageDurationPerRun.textContent =
    `${formatAnalysisDuration(averageDuration)}/러닝`;
}

function renderRecentRuns(records) {
  if (records.length === 0) {
    monthlyReportRecentRuns.innerHTML = `
      <p class="monthly-empty-message">
        이 기간에 저장된 러닝 기록이 없습니다.
      </p>
    `;
    return;
  }

  monthlyReportRecentRuns.innerHTML = records
    .slice()
    .sort(function (a, b) {
      return (b.id || 0) - (a.id || 0);
    })
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

function renderMonthlyReport() {
  const records = getAnalysisRecords();

  const totalDistanceKm = records.reduce(function (sum, record) {
    return sum + Number(record.distance);
  }, 0);

  const totalDurationSeconds = records.reduce(function (sum, record) {
    return sum + durationToSeconds(record.duration);
  }, 0);

  const title = getPeriodTitle();

  monthlyReportTitle.textContent = title;
  monthlyReportSubtitle.textContent =
    records.length > 0
      ? `${records.length}번의 러닝이 이 기간을 채우고 있어요`
      : '이 기간의 첫 러닝을 기다리고 있어요';

  analysisDistance.textContent = totalDistanceKm.toFixed(1);
  analysisRunCount.textContent = records.length;
  analysisAveragePace.textContent =
    formatAveragePace(totalDurationSeconds, totalDistanceKm);

  analysisTotalDuration.textContent =
    formatAnalysisDuration(totalDurationSeconds);

  analysisMoodTitle.textContent =
    selectedAnalysisMode === 'week'
      ? '이번 주의 Pace Mood'
      : selectedAnalysisMode === 'month'
        ? '이번 달의 Pace Mood'
        : selectedAnalysisMode === 'year'
          ? '올해 가장 많이 달린 마음'
          : '나를 가장 잘 설명하는 Pace Mood';

  analysisRecentTitle.textContent =
    selectedAnalysisMode === 'all'
      ? '전체 최근 활동'
      : `${title} 최근 활동`;

  renderMoodReport(records);
  renderDistanceChart(records);
  renderLongTermStats(records, totalDistanceKm, totalDurationSeconds);
  renderRecentRuns(records);

  const today = new Date();

  const isCurrentPeriod =
    selectedAnalysisMode === 'all' ||
    (
      selectedAnalysisMode === 'week' &&
      getStartOfWeek(selectedAnalysisDate).getTime() ===
        getStartOfWeek(today).getTime()
    ) ||
    (
      selectedAnalysisMode === 'month' &&
      selectedAnalysisDate.getFullYear() === today.getFullYear() &&
      selectedAnalysisDate.getMonth() === today.getMonth()
    ) ||
    (
      selectedAnalysisMode === 'year' &&
      selectedAnalysisDate.getFullYear() === today.getFullYear()
    );

  previousPeriodBtn.disabled = selectedAnalysisMode === 'all';
  nextPeriodBtn.disabled = isCurrentPeriod;
}

function moveAnalysisPeriod(direction) {
  if (selectedAnalysisMode === 'all') {
    return;
  }

  const nextDate = new Date(selectedAnalysisDate);

  if (selectedAnalysisMode === 'week') {
    nextDate.setDate(nextDate.getDate() + direction * 7);
  }

  if (selectedAnalysisMode === 'month') {
    nextDate.setMonth(nextDate.getMonth() + direction);
  }

  if (selectedAnalysisMode === 'year') {
    nextDate.setFullYear(nextDate.getFullYear() + direction);
  }

  const today = new Date();

  if (direction > 0 && nextDate > today) {
    return;
  }

  selectedAnalysisDate = nextDate;
  renderMonthlyReport();
}

analysisTabs.forEach(function (tab) {
  tab.addEventListener('click', function () {
    selectedAnalysisMode = tab.dataset.period;

    analysisTabs.forEach(function (item) {
      item.classList.remove('active');
    });

    tab.classList.add('active');
    renderMonthlyReport();
  });
});

previousPeriodBtn.addEventListener('click', function () {
  moveAnalysisPeriod(-1);
});

nextPeriodBtn.addEventListener('click', function () {
  moveAnalysisPeriod(1);
});

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
  selectedAnalysisMode = 'week';
  selectedAnalysisDate = new Date();

  analysisTabs.forEach(function (tab) {
    tab.classList.toggle('active', tab.dataset.period === 'week');
  });

  renderMonthlyReport();

  map.getContainer().style.display = 'none';
  controlsSection.style.display = 'none';
  recordsSection.classList.add('hidden');
  recordDetail.classList.add('hidden');
  profileFeedScreen.classList.add('hidden');

  monthlyReportScreen.classList.remove('hidden');
});

recordsAnalysisBtn.addEventListener(
  'click',
  function () {
    monthlyReportBtn.click();
  }
);

backFromMonthlyReportBtn.addEventListener(
  'click',
  function () {
    monthlyReportScreen.classList.add(
      'hidden'
    );

    openAppPage('records');
  }
);
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
runTripBtn.addEventListener('click', function () {
  openRunTripPanel();
});

backFromRunTripBtn.addEventListener('click', function () {
  closeRunTripPanel();
});

addWaypointBtn.addEventListener('click', function () {
  addRunTripWaypoint();
});

runTripReturnToggle.addEventListener('change', function () {
  renderRunTripMapPreview();
});

useCurrentLocationBtn.addEventListener('click', function () {
  if (!navigator.geolocation) {
    runTripStatus.textContent =
      '이 기기에서는 현재 위치 기능을 사용할 수 없어요.';
    return;
  }

  const previousOrigin = selectedRunTripOrigin;
  const previousInputValue = runTripOriginInput.value;

  isGettingRunTripCurrentLocation = true;

  runTripOriginInput.value = '현재 위치를 확인하고 있어요…';

  hidePlaceSearchResults(runTripOriginSearchResults);
  updateRunTripCreateButton();

  navigator.geolocation.getCurrentPosition(
    function (position) {
      selectedRunTripOrigin = {
        type: 'current-location',
        name: '현재 위치',
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };

      runTripOriginInput.value = '현재 위치';

      isGettingRunTripCurrentLocation = false;

      updateRunTripCreateButton();
      renderRunTripMapPreview();

      runTripStatus.textContent =
        '현재 위치를 출발지로 설정했어요.';
    },

    function () {
      selectedRunTripOrigin = previousOrigin;
      runTripOriginInput.value = previousInputValue;

      isGettingRunTripCurrentLocation = false;

      updateRunTripCreateButton();
      renderRunTripMapPreview();

      runTripStatus.textContent =
        '현재 위치를 가져오지 못했어요. 위치 권한을 확인해 주세요.';
    },

    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
});

createRunTripBtn.addEventListener(
  'click',
  async function () {
    if (isRunTripConfirmed) {
      startRunTripFollowing();
      return;
    }

    const draft = getRunTripDraft();

    if (!draft.origin || !draft.destination) {
      updateRunTripCreateButton();
      return;
    }

    createRunTripBtn.disabled = true;
    createRunTripBtn.textContent = '계산 중';

    if (!latestRunTripRouteSummary) {
      await renderRunTripMapPreview();
    }

    if (!latestRunTripRouteSummary) {
      createRunTripBtn.disabled = false;
      createRunTripBtn.textContent = '확인';

      alert(
        '실제 보행 경로를 계산하지 못했어요. 장소를 확인한 뒤 다시 시도해 주세요.'
      );

      return;
    }

    showRunTripConfirmedMode();
  }
);
startRunTripFollowBtn.addEventListener(
  'click',
  function () {
    if (isRunTripFollowing) {
      stopRunTripFollowing();
      return;
    }

    startRunTripFollowing();
  }
);
pauseRunTripBtn.addEventListener(
  'click',
  function () {
    if (!isRunTripFollowing) {
      return;
    }

    if (isRunTripPaused) {
  isRunTripPaused = false;

  runTripLastValidPosition = null;

  beginNewRunTripRouteSegment();

  startRunTripTimer();
  startRunTripLocationWatch();

  updateRunTripDashboard();

  return;
}

    isRunTripPaused = true;

    clearInterval(
      runTripTimerInterval
    );

    runTripTimerInterval = null;

    if (
      runTripFollowWatchId !== null &&
      runTripFollowWatchId !== undefined
    ) {
      navigator.geolocation.clearWatch(
        runTripFollowWatchId
      );
    }

    runTripFollowWatchId = null;

    runTripLastValidPosition = null;
    runTripActiveRouteSegment = null;

    updateRunTripDashboard();
  }
);

endRunTripBtn.addEventListener(
  'click',
  function () {
    const shouldEnd = window.confirm(
      '현재 RUNTRIP을 종료하고 기록을 저장할까요?'
    );

    if (!shouldEnd) {
      return;
    }

    saveRunTripRecord();

    stopRunTripFollowing();

    runTripStartTime = null;
    runTripActualRouteCoordinates = [];
    runTripActualRouteSegments = [];
    runTripActiveRouteSegment = null;

    setTimeout(function () {
      openAppPage('records');
    }, 0);
  }
);
updateRunTripCreateButton();
updateRunTripWaypointControls();
connectExistingRunTripRouteOrderButtons();
/* ========================================
   FreeRunTrip 앱 페이지 전환 V2
======================================== */

const homeScreen = document.getElementById(
  'homeScreen'
);

const appBottomNavigation = document.getElementById(
  'appBottomNavigation'
);

const appNavButtons = document.querySelectorAll(
  '.app-nav-button'
);

let currentAppPage = 'home';

function hideAllMainAppScreens() {
  homeScreen.classList.add('hidden');

  map.getContainer().style.display =
    'none';

  controlsSection.style.display =
    'none';

  recordsSection.classList.add(
    'hidden'
  );

  recordDetail.classList.add(
    'hidden'
  );

  profileFeedScreen.classList.add(
    'hidden'
  );

  monthlyReportScreen.classList.add(
    'hidden'
  );

  runTripPanel.classList.add(
    'hidden'
  );

  runTripSearchScreen.classList.add(
    'hidden'
  );
}

function updateBottomNavigationActiveState(
  pageName
) {
  appNavButtons.forEach(function (button) {
    const isActive =
      button.dataset.pageTarget ===
      pageName;

    button.classList.toggle(
      'active',
      isActive
    );
  });
}

/* 홈은 현재 정적인 샘플 콘텐츠 피드이므로
   별도의 개인 기록 렌더링을 하지 않는다. */
function renderHomeScreen() {
  return;
}

function showBottomNavigation() {
  appBottomNavigation.classList.remove(
    'hidden'
  );
}

function hideBottomNavigation() {
  appBottomNavigation.classList.add(
    'hidden'
  );
}

function openAppPage(pageName) {
  /* 실제 러닝 또는 RunTrip 실행 중에는
     다른 탭으로 이동하지 않는다. */
  if (
    isRunning ||
    isRunTripFollowing
  ) {
    return;
  }

  hideAllMainAppScreens();

  currentAppPage = pageName;

  updateBottomNavigationActiveState(
    pageName
  );

  /* 일반 앱 페이지에서는 하단 메뉴 유지 */
  showBottomNavigation();

  if (pageName === 'home') {
    renderHomeScreen();

    homeScreen.classList.remove(
      'hidden'
    );

    window.scrollTo({
      top: 0,
      behavior: 'auto'
    });

    return;
  }

  if (pageName === 'running') {
    map.getContainer().style.display =
      'block';

    controlsSection.style.display =
      'flex';

    recordsSection.classList.add(
      'hidden'
    );

    requestAnimationFrame(function () {
      map.invalidateSize({
        pan: false
      });
    });

    return;
  }

  if (pageName === 'runtrip') {
    /* RunTrip 생성·준비 화면에서도
       하단 메뉴를 계속 표시한다. */
    openRunTripPanel();

    showBottomNavigation();

    return;
  }

  if (pageName === 'records') {
    renderRunRecords();

    recordsSection.classList.remove(
      'hidden'
    );

    return;
  }

  if (pageName === 'profile') {
    renderRecordProfileFeed();

    profileFeedScreen.classList.remove(
      'hidden'
    );
  }
}

appNavButtons.forEach(function (button) {
  button.addEventListener(
    'click',
    function () {
      const targetPage =
        button.dataset.pageTarget;

      if (!targetPage) {
        return;
      }

      openAppPage(targetPage);
    }
  );
});

/* 일반 러닝을 실제로 시작하면
   하단 메뉴를 숨긴다. */
startBtn.addEventListener(
  'click',
  function () {
    if (isRunning) {
      hideBottomNavigation();
    }
  }
);

/* 일반 러닝 저장이 완료되면
   러닝 준비 화면과 하단 메뉴를 복원한다. */
saveRunWithMoodBtn.addEventListener(
  'click',
  function () {
    setTimeout(function () {
      currentAppPage = 'running';

      updateBottomNavigationActiveState(
        'running'
      );

      showBottomNavigation();
    }, 0);
  }
);

/* RunTrip 취소 시 홈으로 이동 */
backFromRunTripBtn.addEventListener(
  'click',
  function () {
    setTimeout(function () {
      openAppPage('home');
    }, 0);
  }
);

/* 기존 프로필 뒤로가기는 홈으로 연결 */
backFromProfileFeedBtn.addEventListener(
  'click',
  function () {
    setTimeout(function () {
      openAppPage('home');
    }, 0);
  }
);

/* 기록 상세에서 목록으로 돌아가면
   기록 탭과 하단 메뉴를 유지한다. */

/* 첫 앱 화면 */
openAppPage('home');