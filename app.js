const FREERUNTRIP_MAPBOX_ACCESS_TOKEN =
  [
    'pk.',
    'eyJ1IjoiZnJlZXJ1bnRyaXAiLCJhIjoiY21zbXN1MW52MG82ZjM0cHZuaDV1ZGduZSJ9',
    '.dVLnvYx-HQirD4OBzHBgHQ'
  ].join('');

const FREERUNTRIP_MAPBOX_STYLE_URL =
  'mapbox://styles/freeruntrip/cmsmtajtt000s01rf21vj5xbv';

function testFreeRunTripMapboxMap() {
  const testContainer =
    document.getElementById('mapboxMigrationTest');

  if (!testContainer) {
    console.error(
      'Mapbox 테스트 컨테이너를 찾지 못했습니다.'
    );
    return;
  }

  if (
    typeof mapboxgl === 'undefined'
  ) {
    console.error(
      'Mapbox GL JS가 로드되지 않았습니다.'
    );
    return;
  }

  mapboxgl.accessToken =
    FREERUNTRIP_MAPBOX_ACCESS_TOKEN;

  testContainer.style.display =
    'block';

  const migrationTestMap =
    new mapboxgl.Map({
      container: testContainer,
      style:
        FREERUNTRIP_MAPBOX_STYLE_URL,

      center: [
        126.9780,
        37.5665
      ],

      zoom: 13,

      pitch: 0,
      bearing: 0
    });

  migrationTestMap.on(
    'load',
    function () {
      console.log(
        'FreeRunTrip Mapbox 실제 앱 연결 테스트 성공'
      );
    }
  );

  migrationTestMap.on(
    'error',
    function (event) {
      console.error(
        'FreeRunTrip Mapbox 실제 앱 연결 테스트 실패:',
        event.error || event
      );
    }
  );

  window.freeRunTripMapboxMigrationTest =
    migrationTestMap;
}

let freeRunTripMapboxMainMap = null;

function initializeFreeRunTripMapboxMainMap() {
  if (freeRunTripMapboxMainMap) {
    return freeRunTripMapboxMainMap;
  }

  const mapboxMainContainer =
    document.getElementById('mapboxMainMap');

  if (!mapboxMainContainer) {
    console.error(
      'Mapbox 메인 지도 컨테이너를 찾지 못했습니다.'
    );

    return null;
  }

  mapboxgl.accessToken =
    FREERUNTRIP_MAPBOX_ACCESS_TOKEN;

  freeRunTripMapboxMainMap =
    new mapboxgl.Map({
      container: mapboxMainContainer,

      style:
        FREERUNTRIP_MAPBOX_STYLE_URL,

      center: [
        126.9780,
        37.5665
      ],

      zoom: 13,

      pitch: 0,
      bearing: 0,

      attributionControl: true
    });

  freeRunTripMapboxMainMap.on(
  'load',
  function () {
    console.log(
      'FreeRunTrip Mapbox 메인 지도 준비 완료'
    );

    initializeMapboxRunningRouteLayer();

    freeRunTripMapboxMainMap.once(
  'idle',
  function () {
    initializeMapboxRunTripPlannedRouteLayer();

    if (
      latestRunTripRouteSummary &&
      Array.isArray(
        latestRunTripRouteSummary.coordinates
      )
    ) {
      updateMapboxRunTripPlannedRoute(
        latestRunTripRouteSummary.coordinates
      );
    }

    freeRunTripMapboxMainMap.once(
      'idle',
      function () {
        initializeMapboxRunTripActualRouteLayer();

        updateMapboxRunTripActualRoute();
      }
    );
  }
);
  }
);

  freeRunTripMapboxMainMap.on(
    'error',
    function (event) {
      console.error(
        'FreeRunTrip Mapbox 메인 지도 오류:',
        event.error || event
      );
    }
  );

  return freeRunTripMapboxMainMap;
}

initializeFreeRunTripMapboxMainMap();

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
const runningMapView = document.getElementById(
  'runningMapView'
);
const runningFollowStateBtn = document.getElementById(
  'runningFollowStateBtn'
);

let seconds = 0;
let timerInterval;
let isRunning = false;
let currentMarker;
let mapboxRunningCurrentMarker = null;
let routeCoordinates = [];
let routeSegments = [];
let activeRouteSegment = [];
let routeLine;
let routeLines = [];
let mapboxRunningRouteSourceReady = false;
let runningRouteNeedsNewSegment = false;

const MAPBOX_RUNNING_ROUTE_SOURCE_ID =
  'freeruntrip-running-route-source';

const MAPBOX_RUNNING_ROUTE_LAYER_ID =
  'freeruntrip-running-route-layer';
function initializeMapboxRunningRouteLayer() {
  if (!freeRunTripMapboxMainMap) {
    return;
  }

  if (!freeRunTripMapboxMainMap.isStyleLoaded()) {
    return;
  }

  if (
    !freeRunTripMapboxMainMap.getSource(
      MAPBOX_RUNNING_ROUTE_SOURCE_ID
    )
  ) {
    freeRunTripMapboxMainMap.addSource(
      MAPBOX_RUNNING_ROUTE_SOURCE_ID,
      {
        type: 'geojson',

        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'MultiLineString',
            coordinates: []
          }
        }
      }
    );
  }

  if (
    !freeRunTripMapboxMainMap.getLayer(
      MAPBOX_RUNNING_ROUTE_LAYER_ID
    )
  ) {
    freeRunTripMapboxMainMap.addLayer({
      id: MAPBOX_RUNNING_ROUTE_LAYER_ID,

      type: 'line',

      source:
        MAPBOX_RUNNING_ROUTE_SOURCE_ID,

      layout: {
        'line-cap': 'round',
        'line-join': 'round'
      },

      paint: {
        'line-color': '#facc15',
        'line-width': 6,
        'line-opacity': 0.9
      }
    });
  }

  mapboxRunningRouteSourceReady = true;
}

function updateMapboxRunningRoute() {
  if (
    !freeRunTripMapboxMainMap ||
    !mapboxRunningRouteSourceReady
  ) {
    return;
  }

  const source =
    freeRunTripMapboxMainMap.getSource(
      MAPBOX_RUNNING_ROUTE_SOURCE_ID
    );

  if (!source) {
    return;
  }

  const mapboxSegments =
    routeSegments
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
              Number(point[1]),
              Number(point[0])
            ];
          }
        );
      });

  source.setData({
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'MultiLineString',
      coordinates: mapboxSegments
    }
  });
}
function clearMapboxRunningRoute() {
  if (
    !freeRunTripMapboxMainMap ||
    !mapboxRunningRouteSourceReady
  ) {
    return;
  }

  const source =
    freeRunTripMapboxMainMap.getSource(
      MAPBOX_RUNNING_ROUTE_SOURCE_ID
    );

  if (!source) {
    return;
  }

  source.setData({
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'MultiLineString',
      coordinates: []
    }
  });
}
function updateMapboxRunningCurrentMarker(latLng) {
  if (
    !freeRunTripMapboxMainMap ||
    !Array.isArray(latLng) ||
    latLng.length < 2
  ) {
    return;
  }

  const latitude =
    Number(latLng[0]);

  const longitude =
    Number(latLng[1]);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return;
  }

  const lngLat = [
    longitude,
    latitude
  ];

  if (!mapboxRunningCurrentMarker) {
    mapboxRunningCurrentMarker =
      new mapboxgl.Marker()
        .setLngLat(lngLat)
        .addTo(
          freeRunTripMapboxMainMap
        );

    return;
  }

  mapboxRunningCurrentMarker.setLngLat(
    lngLat
  );
}
function beginNewRouteSegment() {
  activeRouteSegment = [];
  routeSegments.push(activeRouteSegment);
  routeLine = null;
}

function appendRoutePointToActiveSegment(point) {
  if (
    runningRouteNeedsNewSegment ||
    !activeRouteSegment
  ) {
    beginNewRouteSegment();
    runningRouteNeedsNewSegment = false;
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

  updateMapboxRunningRoute();
}
let paused = false;
let watchId;
let lastValidPosition = null;
let totalDistance = 0; // meters
let totalElevationGain = 0;
let totalElevationLoss = 0;
let lastValidAltitude = null;
let elevationReferenceAltitude = null;
let recentAltitudeSamples = [];
let currentSmoothedAltitude = null;
let splitStartAltitude = null;
let recentPositions = [];
let lastRunningGpsAccuracy = null;
let isRunningMapFollowing = true;

function updateRunningFollowState() {
  if (!runningFollowStateBtn) {
    return;
  }

  runningFollowStateBtn.textContent = paused
    ? '따라가기 멈춤'
    : isRunningMapFollowing
      ? '따라가기 ON'
      : '따라가기 OFF';

  runningFollowStateBtn.setAttribute(
    'aria-pressed',
    String(isRunningMapFollowing && !paused)
  );

  runningFollowStateBtn.disabled = paused;
  runningFollowStateBtn.classList.toggle('is-paused', paused);
  runningFollowStateBtn.classList.toggle(
    'is-off',
    !paused && !isRunningMapFollowing
  );
}

function getVisibleMapVerticalOffset(
  topOverlayElement,
  bottomOverlayElement,
  padding = 12
) {
  const mapElement = map.getContainer();
  const mapRect = mapElement.getBoundingClientRect();

  if (
    !Number.isFinite(mapRect.height) ||
    mapRect.height <= 0
  ) {
    return 0;
  }

  let visibleTop = mapRect.top;
  let visibleBottom = mapRect.bottom;

  if (
    topOverlayElement &&
    !topOverlayElement.classList.contains('hidden')
  ) {
    const topRect =
      topOverlayElement.getBoundingClientRect();

    if (
      topRect.bottom > mapRect.top &&
      topRect.top < mapRect.bottom
    ) {
      visibleTop = Math.min(
        mapRect.bottom,
        Math.max(
          mapRect.top,
          topRect.bottom + padding
        )
      );
    }
  }

  if (
    bottomOverlayElement &&
    !bottomOverlayElement.classList.contains('hidden')
  ) {
    const bottomRect =
      bottomOverlayElement.getBoundingClientRect();

    if (
      bottomRect.bottom > mapRect.top &&
      bottomRect.top < mapRect.bottom
    ) {
      visibleBottom = Math.max(
        mapRect.top,
        Math.min(
          mapRect.bottom,
          bottomRect.top - padding
        )
      );
    }
  }

  if (visibleBottom <= visibleTop) {
    return 0;
  }

  const fullMapCenterY =
    (mapRect.top + mapRect.bottom) / 2;

  const visibleMapCenterY =
    (visibleTop + visibleBottom) / 2;

  /*
    Leaflet panBy의 Y 오프셋은 마커가 화면에서 보이는 위치와
    반대 방향으로 움직인다.
    전체 지도 중심과 실제로 보이는 지도 영역 중심의 차이를
    계산해 정보 패널을 제외한 지도 영역 한가운데에 현재 위치를 둔다.
  */
  return Math.round(
    fullMapCenterY - visibleMapCenterY
  );
}

function getRunningMapVerticalOffset() {
  const statusRow = document.querySelector(
    '.running-map-status-row'
  );

  const executionStack = document.querySelector(
    '.running-execution-stack'
  );

  return getVisibleMapVerticalOffset(
    statusRow,
    executionStack,
    12
  );
}

function centerRunningMapOnPosition(latLng, options = {}) {
  if (!Array.isArray(latLng) || latLng.length < 2) {
    return;
  }

  const targetZoom = Math.max(map.getZoom(), 17);

  map.setView(latLng, targetZoom, {
    animate: options.animate === true
  });

  requestAnimationFrame(function () {
    map.panBy(
      [0, getRunningMapVerticalOffset()],
      { animate: options.animate === true }
    );
  });
}
function centerMapboxRunningMapOnPosition(
  latLng,
  options = {}
) {
  if (
    !freeRunTripMapboxMainMap ||
    !Array.isArray(latLng) ||
    latLng.length < 2
  ) {
    return;
  }

  const latitude =
    Number(latLng[0]);

  const longitude =
    Number(latLng[1]);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return;
  }

  const targetZoom = Math.max(
    freeRunTripMapboxMainMap.getZoom(),
    17
  );

  const mapboxOptions = {
    center: [
      longitude,
      latitude
    ],

    zoom: targetZoom,

    duration:
      options.animate === true
        ? 500
        : 0
  };

  freeRunTripMapboxMainMap.easeTo(
    mapboxOptions
  );
}
function getRunTripMapVerticalOffset() {
  const runTripExecutionPanel =
    document.querySelector(
      '.runtrip-following .runtrip-editor-card'
    );

  return getVisibleMapVerticalOffset(
    runTripExecutionPanel,
    null,
    12
  );
}

function centerRunTripMapOnPosition(
  latLng,
  options = {}
) {
  if (!Array.isArray(latLng) || latLng.length < 2) {
    return;
  }

  const targetZoom = 15;

  map.setView(
    latLng,
    targetZoom,
    {
      animate: options.animate === true
    }
  );

  requestAnimationFrame(function () {
    map.panBy(
      [0, getRunTripMapVerticalOffset()],
      { animate: options.animate === true }
    );
  });
}
function centerMapboxRunTripMapOnPosition(
  latLng,
  options = {}
) {
  if (
    !freeRunTripMapboxMainMap ||
    !Array.isArray(latLng) ||
    latLng.length < 2
  ) {
    return;
  }

  const latitude =
    Number(latLng[0]);

  const longitude =
    Number(latLng[1]);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return;
  }

  const mapboxContainer =
    freeRunTripMapboxMainMap.getContainer();

  const mapRect =
    mapboxContainer.getBoundingClientRect();

  const runTripExecutionPanel =
    document.querySelector(
      '.runtrip-following .runtrip-editor-card'
    );

  let visibleTop =
    mapRect.top;

  const visibleBottom =
    mapRect.bottom;

  if (
    runTripExecutionPanel &&
    !runTripExecutionPanel.classList.contains(
      'hidden'
    )
  ) {
    const panelRect =
      runTripExecutionPanel.getBoundingClientRect();

    if (
      panelRect.bottom > mapRect.top &&
      panelRect.top < mapRect.bottom
    ) {
      visibleTop = Math.min(
        mapRect.bottom,
        Math.max(
          mapRect.top,
          panelRect.bottom + 12
        )
      );
    }
  }

  const fullMapCenterY =
    (
      mapRect.top +
      mapRect.bottom
    ) / 2;

  const visibleMapCenterY =
    (
      visibleTop +
      visibleBottom
    ) / 2;

  const verticalOffset =
    Math.round(
      visibleMapCenterY -
      fullMapCenterY
    );

  /*
    RunTrip 실행 중 Follow 지도는 야외 테스트 기준으로
    기존 18.2보다 약 3단계 넓게 보이도록 15.2로 고정한다.
    현재 위치뿐 아니라 다음 경로와 경유지를 함께 읽기 위한 줌이다.
  */
  const targetZoom = 15.2;

  freeRunTripMapboxMainMap.easeTo({
    center: [
      longitude,
      latitude
    ],

    zoom:
      targetZoom,

    offset: [
      0,
      verticalOffset
    ],

    duration:
      options.animate === true
        ? 500
        : 0
  });
}
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


const detailDistance = document.getElementById(
  'detailDistance'
);
const detailDuration = document.getElementById('detailDuration');
const detailCalories = document.getElementById(
  'detailCalories'
);

const detailAveragePace = document.getElementById(
  'detailAveragePace'
);
const detailElevationGain = document.getElementById(
  'detailElevationGain'
);
const detailHeartRate = document.getElementById(
  'detailHeartRate'
);
const detailCadence = document.getElementById(
  'detailCadence'
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

const detailNumericPace = document.getElementById('detailNumericPace');
const detailPaceTitle = document.getElementById('detailPaceTitle');
const detailPaceHint = document.getElementById('detailPaceHint');
const detailMapElement = document.getElementById('detailMap');
const mapboxDetailMapElement =
  document.getElementById(
    'mapboxDetailMap'
  );
const detailMemory = document.getElementById('detailMemory');
const detailMapSection = document.getElementById('detailMapSection');
const detailRunPhoto = document.getElementById('detailRunPhoto');
const detailRunMemoWrap = document.getElementById('detailRunMemoWrap');
const detailRunMemo = document.getElementById('detailRunMemo');
const detailTakePhotoBtn = document.getElementById(
  'detailTakePhotoBtn'
);
const detailCameraInput = document.getElementById(
  'detailCameraInput'
);
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
let mapboxDetailMap = null;
let mapboxDetailMarkers = [];
const MAPBOX_DETAIL_PLANNED_ROUTE_SOURCE_ID =
  'freeruntrip-detail-planned-route-source';

const MAPBOX_DETAIL_PLANNED_ROUTE_LAYER_ID =
  'freeruntrip-detail-planned-route-layer';

const MAPBOX_DETAIL_ACTUAL_ROUTE_SOURCE_ID =
  'freeruntrip-detail-actual-route-source';

const MAPBOX_DETAIL_ACTUAL_ROUTE_LAYER_ID =
  'freeruntrip-detail-actual-route-layer';
let detailStartMarker = null;
let detailFinishMarker = null;
let detailWaypointMarkers = [];
let detailDirectionMarkers = [];
let selectedDetailRecord = null;

/* RunTrip 사진 기록 V1
   - 이미지 원본/압축본은 IndexedDB에 저장
   - localStorage의 활동 기록에는 photoId 목록만 저장
   - 경유지 촬영 시 장소/거리/시간/GPS 문맥을 함께 보존
*/
const RUNTRIP_PHOTO_DB_NAME = 'FreeRunTripPhotosV1';
const RUNTRIP_PHOTO_STORE_NAME = 'photos';
let pendingRunTripPhotoContext = null;
let activeRunTripPhotoIds = [];

function openRunTripPhotoDatabase() {
  return new Promise(function (resolve, reject) {
    if (!window.indexedDB) {
      reject(new Error('이 브라우저에서는 사진 저장소를 사용할 수 없습니다.'));
      return;
    }

    const request = indexedDB.open(RUNTRIP_PHOTO_DB_NAME, 1);

    request.onupgradeneeded = function () {
      const database = request.result;

      if (!database.objectStoreNames.contains(RUNTRIP_PHOTO_STORE_NAME)) {
        const store = database.createObjectStore(
          RUNTRIP_PHOTO_STORE_NAME,
          { keyPath: 'id' }
        );

        store.createIndex('recordId', 'recordId', { unique: false });
        store.createIndex('sessionId', 'sessionId', { unique: false });
        store.createIndex('capturedAt', 'capturedAt', { unique: false });
      }
    };

    request.onsuccess = function () {
      resolve(request.result);
    };

    request.onerror = function () {
      reject(request.error || new Error('사진 저장소를 열지 못했습니다.'));
    };
  });
}

async function saveRunTripPhotoToDatabase(photoEntry) {
  const database = await openRunTripPhotoDatabase();

  return new Promise(function (resolve, reject) {
    const transaction = database.transaction(
      RUNTRIP_PHOTO_STORE_NAME,
      'readwrite'
    );

    const store = transaction.objectStore(
      RUNTRIP_PHOTO_STORE_NAME
    );

    store.put(photoEntry);

    transaction.oncomplete = function () {
      database.close();
      resolve(photoEntry);
    };

    transaction.onerror = function () {
      const error = transaction.error;
      database.close();
      reject(error || new Error('사진을 저장하지 못했습니다.'));
    };
  });
}

async function updateRunTripPhotoRecordIds(photoIds, recordId) {
  if (!Array.isArray(photoIds) || photoIds.length === 0) {
    return;
  }

  const database = await openRunTripPhotoDatabase();

  await Promise.all(
    photoIds.map(function (photoId) {
      return new Promise(function (resolve, reject) {
        const transaction = database.transaction(
          RUNTRIP_PHOTO_STORE_NAME,
          'readwrite'
        );

        const store = transaction.objectStore(
          RUNTRIP_PHOTO_STORE_NAME
        );

        const request = store.get(photoId);

        request.onsuccess = function () {
          const entry = request.result;

          if (!entry) {
            resolve();
            return;
          }

          entry.recordId = Number(recordId);
          store.put(entry);
        };

        transaction.oncomplete = resolve;
        transaction.onerror = function () {
          reject(transaction.error);
        };
      });
    })
  );

  database.close();
}

async function getRunTripPhotosByIds(photoIds) {
  if (!Array.isArray(photoIds) || photoIds.length === 0) {
    return [];
  }

  const database = await openRunTripPhotoDatabase();

  const photos = await Promise.all(
    photoIds.map(function (photoId) {
      return new Promise(function (resolve) {
        const transaction = database.transaction(
          RUNTRIP_PHOTO_STORE_NAME,
          'readonly'
        );

        const request = transaction
          .objectStore(RUNTRIP_PHOTO_STORE_NAME)
          .get(photoId);

        request.onsuccess = function () {
          resolve(request.result || null);
        };

        request.onerror = function () {
          resolve(null);
        };
      });
    })
  );

  database.close();

  return photos.filter(Boolean);
}

function getRunTripPhotoContextFromNotice() {
  if (!activeRunTripCheckpointNotice) {
    return null;
  }

  const notice = activeRunTripCheckpointNotice;
  const currentPosition = runTripLastValidPosition;

  return {
    source: notice.type === 'waypoint' ? 'checkpoint' : 'destination',
    checkpointNumber:
      notice.type === 'waypoint'
        ? Number(notice.number) || null
        : null,
    placeName: notice.placeName || '',
    elapsedSeconds: Math.max(0, Number(runTripElapsedSeconds) || 0),
    distanceMeters: Math.max(0, Number(runTripActualDistanceMeters) || 0),
    latitude:
      currentPosition && Number.isFinite(Number(currentPosition.latitude))
        ? Number(currentPosition.latitude)
        : null,
    longitude:
      currentPosition && Number.isFinite(Number(currentPosition.longitude))
        ? Number(currentPosition.longitude)
        : null,
    accuracy:
      currentPosition && Number.isFinite(Number(currentPosition.accuracy))
        ? Number(currentPosition.accuracy)
        : null,
    capturedAt: new Date().toISOString(),
    sessionId:
      runTripStartTime instanceof Date
        ? runTripStartTime.toISOString()
        : null
  };
}

async function renderRunTripMomentPhotos(record) {
  if (!detailMemory || !record) {
    return;
  }

  const oldMoments = detailMemory.querySelector('.runtrip-moments');
  if (oldMoments) {
    oldMoments.remove();
  }

  const photoIds = Array.isArray(record.photoIds)
    ? record.photoIds
    : [];

  if (photoIds.length === 0) {
    return;
  }

  try {
    const photos = await getRunTripPhotosByIds(photoIds);

    if (photos.length === 0) {
      return;
    }

    detailMemory.classList.remove('hidden');

    const moments = document.createElement('section');
    moments.className = 'runtrip-moments';

    moments.innerHTML = `
      <div class="runtrip-moments-header">
        <div>
          <span>RUNTRIP MOMENTS</span>
          <small>여정 속 순간</small>
        </div>
        <strong>${photos.length}장의 기록</strong>
      </div>

      <div class="runtrip-moments-list">
        ${photos.map(function (photo) {
          const checkpointLabel =
            photo.source === 'checkpoint'
              ? `${getRunTripWaypointOrdinal(photo.checkpointNumber)} 경유지`
              : photo.source === 'destination'
                ? '도착지'
                : '활동 기록';

          const placeName =
            String(photo.placeName || '').trim();

          return `
            <article class="runtrip-moment-card">
              <img
                src="${photo.dataUrl}"
                alt="${escapePlaceSearchText(checkpointLabel)} 사진"
              />

              <div class="runtrip-moment-copy">
                <strong>${escapePlaceSearchText(checkpointLabel)}</strong>
                ${
                  placeName
                    ? `<span>${escapePlaceSearchText(placeName)}</span>`
                    : ''
                }
                <small>
                  ${(Math.max(0, Number(photo.distanceMeters) || 0) / 1000).toFixed(2)} km
                  · ${formatRunTripTimer(photo.elapsedSeconds || 0)}
                </small>
              </div>
            </article>
          `;
        }).join('')}
      </div>
    `;

    detailMemory.appendChild(moments);
  } catch (error) {
    console.error('RunTrip 사진 불러오기 실패:', error);
  }
}
/* 일반 러닝 GPS 안정화 기준
   - 실외 러닝에서 정확도가 낮은 좌표는 거리·경로에서 제외
   - GPS 흔들림과 순간 이동을 실제 거리로 더하지 않음
*/
const MAX_ACCURACY = 50; // meters
const MIN_DISTANCE = 7; // meters
const MAX_RUNNING_SPEED_METERS_PER_SECOND = 8.0;
const GPS_ACCURACY_DISTANCE_RATIO = 0.24;
const GPS_MIN_SAMPLE_INTERVAL_MS = 700;
/*
  2026-08-06 Nike Run 야외 비교에서 약 1% 크게 측정되는
  일관된 경향이 확인되어, 허용된 각 GPS 구간에 보정값을 적용한다.
  경로 좌표 자체는 그대로 보존하고 누적 거리와 스플릿에만 반영한다.
*/
const GPS_DISTANCE_CALIBRATION_FACTOR = 0.99;

function getCalibratedGpsDistance(distanceMeters) {
  const safeDistance = Math.max(
    0,
    Number(distanceMeters) || 0
  );

  return safeDistance * GPS_DISTANCE_CALIBRATION_FACTOR;
}
const GPS_DIAGNOSTIC_LOG_LIMIT = 5000;
const MAX_ALTITUDE_ACCURACY = 30; // meters
const ELEVATION_SMOOTHING_COUNT = 5;
const ELEVATION_CHANGE_THRESHOLD_METERS = 2.5;
let runningGpsDiagnosticLog = [];
let runTripGpsDiagnosticLog = [];
let runRecords = JSON.parse(localStorage.getItem('runRecords')) || [];

/*
  기록 저장 안정화:
  장시간 러닝/RunTrip의 GPS 진단 로그를 기록마다 전부 localStorage에
  보관하면 Safari 저장 용량을 초과해 종료 저장이 예외로 중단될 수 있다.
  화면/거리/GPS 측정 로직은 그대로 두고, 기록에 첨부하는 진단 로그만
  최근 샘플로 제한한다. 저장 공간이 부족하면 기존 기록의 진단 로그를
  제거한 경량 사본으로 한 번 더 저장한다.
*/
const RECORD_GPS_DIAGNOSTIC_LIMIT = 300;

function getGpsDiagnosticsForRecord(sourceLog) {
  if (!Array.isArray(sourceLog)) {
    return [];
  }

  return sourceLog
    .slice(-RECORD_GPS_DIAGNOSTIC_LIMIT)
    .map(function (entry) {
      return { ...entry };
    });
}

function persistRunRecordsSafely(nextRecords) {
  try {
    localStorage.setItem(
      'runRecords',
      JSON.stringify(nextRecords)
    );

    return {
      success: true,
      records: nextRecords,
      compacted: false
    };
  } catch (error) {
    console.warn(
      '기록 전체 저장 실패, GPS 진단 로그를 정리해 다시 저장합니다:',
      error
    );
  }

  const compactedRecords = nextRecords.map(function (record) {
    if (!record || typeof record !== 'object') {
      return record;
    }

    return {
      ...record,
      gpsDiagnostics: []
    };
  });

  try {
    localStorage.setItem(
      'runRecords',
      JSON.stringify(compactedRecords)
    );

    return {
      success: true,
      records: compactedRecords,
      compacted: true
    };
  } catch (error) {
    console.error(
      '기록 저장 최종 실패:',
      error
    );

    return {
      success: false,
      records: nextRecords,
      compacted: false,
      error: error
    };
  }
}

let selectedPaceMood =
  localStorage.getItem('selectedPaceMood') ||
  '마음 환기 Pace';

let runStartTime = null;
let splitRecords = [];
let nextSplitDistanceMeters = 1000;
let splitStartElapsedSeconds = 0;
let lastGpsElapsedSeconds = 0;

/* ========================================
   FreeRunTrip 음성 안내 V1
   - GPS 계산 / 저장 / 도착 판정과 분리된 부가 기능
   - 기본 재생: Web Speech API (iPhone Safari 포함)
   - ElevenLabs 등 녹음 음원은 key별 URL 등록 시 우선 재생
======================================== */

const FREERUNTRIP_VOICE_LANGUAGE = 'ko-KR';

const freeRunTripVoiceAudioRegistry =
  Object.create(null);

const freeRunTripSharedAudioPlayer =
  new Audio();

freeRunTripSharedAudioPlayer.preload =
  'auto';

freeRunTripSharedAudioPlayer.playsInline =
  true;

let freeRunTripActiveVoiceAudio =
  freeRunTripSharedAudioPlayer;

let freeRunTripVoiceUnlocked = false;
let freeRunTripAudioQueue = [];
let freeRunTripAudioQueueRunning = false;
let freeRunTripDynamicVoiceObjectUrl = null;
let freeRunTripDynamicVoiceRequestId = 0;
let nextRunningVoiceDistanceMeters = 1000;

function playFreeRunTripRegisteredAudioNow(
  key
) {
  const safeKey =
    String(key || '').trim();

  const audioUrl =
    freeRunTripVoiceAudioRegistry[
      safeKey
    ];

  if (!audioUrl) {
    return false;
  }

  try {
    freeRunTripAudioQueue = [];
    freeRunTripAudioQueueRunning = false;

    freeRunTripSharedAudioPlayer.pause();
    freeRunTripSharedAudioPlayer.currentTime = 0;
    freeRunTripSharedAudioPlayer.src =
      audioUrl;

    freeRunTripActiveVoiceAudio =
      freeRunTripSharedAudioPlayer;

    const playPromise =
      freeRunTripSharedAudioPlayer.play();

    freeRunTripVoiceUnlocked = true;

    if (
      playPromise &&
      typeof playPromise.catch ===
        'function'
    ) {
      playPromise.catch(
        function (error) {
          console.warn(
            'FreeRunTrip 시작 MP3 재생 실패:',
            safeKey,
            error
          );
        }
      );
    }

    return true;
  } catch (error) {
    console.warn(
      'FreeRunTrip 시작 MP3 재생 예외:',
      safeKey,
      error
    );

    return false;
  }
}

function playNextFreeRunTripQueuedAudio() {
  if (
    freeRunTripAudioQueueRunning ||
    freeRunTripAudioQueue.length === 0
  ) {
    return;
  }

  const nextItem =
    freeRunTripAudioQueue.shift();

  if (!nextItem) {
    return;
  }

  freeRunTripAudioQueueRunning = true;

  const finishCurrentItem =
    function () {
      freeRunTripSharedAudioPlayer.removeEventListener(
        'ended',
        finishCurrentItem
      );

      freeRunTripAudioQueueRunning = false;

      playNextFreeRunTripQueuedAudio();
    };

  freeRunTripSharedAudioPlayer.addEventListener(
    'ended',
    finishCurrentItem
  );

  try {
    freeRunTripSharedAudioPlayer.pause();
    freeRunTripSharedAudioPlayer.currentTime = 0;
    freeRunTripSharedAudioPlayer.src =
      nextItem.url;

    const playPromise =
      freeRunTripSharedAudioPlayer.play();

    if (
      playPromise &&
      typeof playPromise.catch ===
        'function'
    ) {
      playPromise.catch(
        function (error) {
          console.warn(
            'FreeRunTrip 큐 MP3 재생 실패:',
            nextItem.key,
            error
          );

          finishCurrentItem();
        }
      );
    }
  } catch (error) {
    console.warn(
      'FreeRunTrip 큐 MP3 재생 예외:',
      nextItem.key,
      error
    );

    finishCurrentItem();
  }
}

function queueFreeRunTripVoiceAudio(
  key
) {
  const safeKey =
    String(key || '').trim();

  const audioUrl =
    freeRunTripVoiceAudioRegistry[
      safeKey
    ];

  if (!audioUrl) {
    return false;
  }

  freeRunTripAudioQueue.push({
    key: safeKey,
    url: audioUrl
  });

  playNextFreeRunTripQueuedAudio();

  return true;
}

function unlockFreeRunTripVoiceGuidance() {
  prepareFreeRunTripVoiceGuidance();

  if (freeRunTripVoiceUnlocked) {
    return;
  }

  freeRunTripVoiceUnlocked = true;
}

function prepareFreeRunTripVoiceGuidance() {
  if (
    'speechSynthesis' in window &&
    typeof window.speechSynthesis.getVoices === 'function'
  ) {
    window.speechSynthesis.getVoices();
  }
}

function getFreeRunTripKoreanVoice() {
  if (
    !('speechSynthesis' in window) ||
    typeof window.speechSynthesis.getVoices !== 'function'
  ) {
    return null;
  }

  const voices =
    window.speechSynthesis.getVoices();

  if (!Array.isArray(voices) || voices.length === 0) {
    return null;
  }

  return (
    voices.find(function (voice) {
      return (
        String(voice.lang || '')
          .toLowerCase() ===
        FREERUNTRIP_VOICE_LANGUAGE.toLowerCase()
      );
    }) ||
    voices.find(function (voice) {
      return String(voice.lang || '')
        .toLowerCase()
        .startsWith('ko');
    }) ||
    null
  );
}

function registerFreeRunTripVoiceAudio(
  key,
  audioUrl
) {
  const safeKey =
    String(key || '').trim();

  const safeUrl =
    String(audioUrl || '').trim();

  if (!safeKey || !safeUrl) {
    return false;
  }

  freeRunTripVoiceAudioRegistry[
    safeKey
  ] = safeUrl;

  return true;
}

function cancelFreeRunTripVoiceGuidance() {
  freeRunTripAudioQueue = [];
  freeRunTripAudioQueueRunning = false;
  freeRunTripDynamicVoiceRequestId++;

  try {
    freeRunTripSharedAudioPlayer.pause();
    freeRunTripSharedAudioPlayer.currentTime = 0;
  } catch (error) {
    console.warn(
      'FreeRunTrip MP3 정지 실패:',
      error
    );
  }

  if (freeRunTripDynamicVoiceObjectUrl) {
    URL.revokeObjectURL(
      freeRunTripDynamicVoiceObjectUrl
    );

    freeRunTripDynamicVoiceObjectUrl = null;
  }

  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (error) {
      console.warn(
        'FreeRunTrip TTS 정지 실패:',
        error
      );
    }
  }
}

function speakFreeRunTripTts(text) {
  if (
    !('speechSynthesis' in window) ||
    typeof SpeechSynthesisUtterance ===
      'undefined'
  ) {
    console.warn(
      '이 브라우저에서는 음성 안내 TTS를 사용할 수 없습니다.'
    );

    return false;
  }

  const message =
    String(text || '').trim();

  if (!message) {
    return false;
  }

  try {
    const utterance =
      new SpeechSynthesisUtterance(
        message
      );

    utterance.lang =
      FREERUNTRIP_VOICE_LANGUAGE;

    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;

    const koreanVoice =
      getFreeRunTripKoreanVoice();

    if (koreanVoice) {
      utterance.voice =
        koreanVoice;
    }

    /*
      iPhone Safari에서 speechSynthesis가
      일시정지 상태로 남는 경우를 대비한다.
    */
    if (
      window.speechSynthesis.paused
    ) {
      window.speechSynthesis.resume();
    }

    window.speechSynthesis.speak(
      utterance
    );

    return true;
  } catch (error) {
    console.error(
      'FreeRunTrip TTS 재생 실패:',
      error
    );

    return false;
  }
}

function speakFreeRunTripVoice(
  text,
  options = {}
) {
  const message =
    String(text || '').trim();

  if (!message) {
    return;
  }

  const voiceKey =
    String(options.key || '').trim();

  console.log(
    'FreeRunTrip 음성 안내 문장:',
    message
  );

  if (options.interrupt === true) {
    cancelFreeRunTripVoiceGuidance();
  }

  if (
    voiceKey &&
    queueFreeRunTripVoiceAudio(
      voiceKey
    )
  ) {
    return;
  }

  /*
    등록 MP3가 아직 없는 동적 문장은
    개발 중 확인용 TTS fallback을 유지한다.
    iPhone Safari에서는 TTS가 재생되지 않을 수 있으므로
    최종 제품에서는 동적 음성 생성/숫자 음원 조합으로 교체한다.
  */
  speakFreeRunTripTts(message);
}

function getRunningDynamicVoiceUrl() {
  if (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  ) {
    return 'https://freeruntrip.vercel.app/api/running-tts';
  }

  return '/api/running-tts';
}

async function requestRunningDynamicVoice(
  text,
  options = {}
) {
  const message =
    String(text || '').trim();

  if (!message) {
    return false;
  }

  /*
    일반 러닝 km 안내와 종료 안내는 iPhone Safari에서 실패한
    speechSynthesis를 사용하지 않고 서버형 Typecast TTS를 사용한다.

    종료 문구처럼 여러 문장을 순서대로 재생할 때는 첫 문장 종료 후
    다음 문장을 이어야 하므로 interrupt:false 옵션으로 기존 재생을
    불필요하게 취소하지 않는다. 기본 동작은 기존과 동일하게 interrupt.
  */
  if (options.interrupt !== false) {
    cancelFreeRunTripVoiceGuidance();
  }

  const requestId =
    ++freeRunTripDynamicVoiceRequestId;

  console.log(
    'FreeRunTrip Typecast 요청:',
    message
  );

  try {
    const response = await fetch(
      getRunningDynamicVoiceUrl(),
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json'
        },
        body: JSON.stringify({
          text: message
        })
      }
    );

    if (!response.ok) {
      let errorMessage =
        '일반 러닝 음성 생성에 실패했습니다.';

      try {
        const errorData =
          await response.json();

        if (errorData?.error) {
          errorMessage =
            String(errorData.error);
        }
      } catch (error) {
        // JSON 오류 응답이 아니면 기본 문구를 사용한다.
      }

      throw new Error(errorMessage);
    }

    const audioBlob =
      await response.blob();

    if (
      requestId !==
      freeRunTripDynamicVoiceRequestId
    ) {
      return false;
    }

    if (
      !audioBlob ||
      audioBlob.size <= 0
    ) {
      throw new Error(
        '생성된 음성 데이터가 없습니다.'
      );
    }

    if (freeRunTripDynamicVoiceObjectUrl) {
      URL.revokeObjectURL(
        freeRunTripDynamicVoiceObjectUrl
      );
    }

    const objectUrl =
      URL.createObjectURL(audioBlob);

    freeRunTripDynamicVoiceObjectUrl =
      objectUrl;

    freeRunTripSharedAudioPlayer.pause();
    freeRunTripSharedAudioPlayer.currentTime = 0;
    freeRunTripSharedAudioPlayer.src =
      objectUrl;

    freeRunTripActiveVoiceAudio =
      freeRunTripSharedAudioPlayer;

    const cleanupDynamicAudio =
      function () {
        freeRunTripSharedAudioPlayer.removeEventListener(
          'ended',
          cleanupDynamicAudio
        );

        freeRunTripSharedAudioPlayer.removeEventListener(
          'error',
          cleanupDynamicAudio
        );

        if (
          freeRunTripDynamicVoiceObjectUrl ===
          objectUrl
        ) {
          URL.revokeObjectURL(objectUrl);
          freeRunTripDynamicVoiceObjectUrl =
            null;
        }
      };

    freeRunTripSharedAudioPlayer.addEventListener(
      'ended',
      cleanupDynamicAudio
    );

    freeRunTripSharedAudioPlayer.addEventListener(
      'error',
      cleanupDynamicAudio
    );

    const playPromise =
      freeRunTripSharedAudioPlayer.play();

    freeRunTripVoiceUnlocked = true;

    if (
      playPromise &&
      typeof playPromise.then ===
        'function'
    ) {
      await playPromise;
    }

    console.log(
      'FreeRunTrip Typecast 재생 시작:',
      message
    );

    if (options.waitForEnd === true) {
      await new Promise(function (resolve) {
        let settled = false;

        const finish = function () {
          if (settled) {
            return;
          }

          settled = true;

          freeRunTripSharedAudioPlayer.removeEventListener(
            'ended',
            finish
          );

          freeRunTripSharedAudioPlayer.removeEventListener(
            'error',
            finish
          );

          clearTimeout(timeoutId);
          resolve();
        };

        freeRunTripSharedAudioPlayer.addEventListener(
          'ended',
          finish
        );

        freeRunTripSharedAudioPlayer.addEventListener(
          'error',
          finish
        );

        const timeoutId = setTimeout(
          finish,
          Math.max(5000, Number(options.timeoutMs) || 20000)
        );
      });
    }

    return true;
  } catch (error) {
    if (
      requestId !==
      freeRunTripDynamicVoiceRequestId
    ) {
      return false;
    }

    console.error(
      'FreeRunTrip Typecast 재생 실패:',
      error
    );

    return false;
  }
}

function formatFreeRunTripVoiceDuration(
  totalSeconds
) {
  const safeSeconds =
    Math.max(
      0,
      Math.round(
        Number(totalSeconds) || 0
      )
    );

  const hours =
    Math.floor(
      safeSeconds / 3600
    );

  const minutes =
    Math.floor(
      (safeSeconds % 3600) / 60
    );

  const secondsPart =
    safeSeconds % 60;

  const parts = [];

  if (hours > 0) {
    parts.push(
      `${hours}시간`
    );
  }

  if (
    minutes > 0 ||
    hours > 0
  ) {
    parts.push(
      `${minutes}분`
    );
  }

  parts.push(
    `${secondsPart}초`
  );

  return parts.join(' ');
}

function formatFreeRunTripVoicePace(
  durationSeconds,
  distanceMeters
) {
  const safeDistance =
    Math.max(
      0,
      Number(distanceMeters) || 0
    );

  const safeDuration =
    Math.max(
      0,
      Number(durationSeconds) || 0
    );

  if (
    safeDistance <= 0 ||
    safeDuration <= 0
  ) {
    return '';
  }

  const paceSeconds =
    safeDuration /
    (safeDistance / 1000);

  const minutes =
    Math.floor(
      paceSeconds / 60
    );

  const secondsPart =
    Math.round(
      paceSeconds % 60
    );

  return (
    `${minutes}분 ` +
    `${secondsPart}초`
  );
}

function resetRunningVoiceGuidance() {
  nextRunningVoiceDistanceMeters =
    1000;
}

function announceRunningStart() {
  speakFreeRunTripVoice(
    '러닝을 시작합니다.',
    {
      key: 'running-start-voice',
      interrupt: true
    }
  );
}

function announceRunningDistanceMilestones(
  previousDistanceMeters,
  currentDistanceMeters
) {
  const previousDistance =
    Math.max(
      0,
      Number(
        previousDistanceMeters
      ) || 0
    );

  const currentDistance =
    Math.max(
      0,
      Number(
        currentDistanceMeters
      ) || 0
    );

  while (
    currentDistance >=
    nextRunningVoiceDistanceMeters
  ) {
    if (
      previousDistance <
      nextRunningVoiceDistanceMeters
    ) {
      const kilometer =
        Math.round(
          nextRunningVoiceDistanceMeters /
          1000
        );

      const elapsedText =
        formatFreeRunTripVoiceDuration(
          seconds
        );

      const paceText =
        formatFreeRunTripVoicePace(
          seconds,
          nextRunningVoiceDistanceMeters
        );

      const messageParts = [
        `${kilometer}킬로미터입니다.`,
        `경과 시간 ${elapsedText}.`
      ];

      if (paceText) {
        messageParts.push(
          `평균 페이스는 킬로미터당 ${paceText}입니다.`
        );
      }

      const runningVoiceMessage =
        messageParts.join(' ');

      console.log(
        'FreeRunTrip 일반 러닝 km 안내:',
        {
          kilometer: kilometer,
          elapsedSeconds: seconds,
          elapsedText: elapsedText,
          averagePaceText: paceText,
          message: runningVoiceMessage
        }
      );

      /*
        일반 러닝 km 안내는 브라우저 speechSynthesis를
        거치지 않고 Typecast 서버 TTS만 호출한다.
      */
      requestRunningDynamicVoice(
        runningVoiceMessage
      );
    }

    nextRunningVoiceDistanceMeters +=
      1000;
  }
}

function announceRunTripStart() {
  speakFreeRunTripVoice(
    '런트립을 시작합니다.',
    {
      key: 'runtrip-start-voice',
      interrupt: true
    }
  );
}

function announceRunTripWaypointArrival(
  number
) {
  const waypointNumber =
    Math.max(
      1,
      Number(number) || 1
    );

  const voiceLabels = [
    '첫 번째',
    '두 번째',
    '세 번째'
  ];

  const ordinal =
    voiceLabels[
      waypointNumber - 1
    ] || `${waypointNumber}번째`;

  const message =
    `${ordinal} 경유지에 도착했습니다.`;

  speakFreeRunTripVoice(
    message,
    {
      key:
        `runtrip-waypoint-${waypointNumber}-voice`,
      interrupt: true
    }
  );
}

function waitFreeRunTripVoiceGap(milliseconds) {
  return new Promise(function (resolve) {
    setTimeout(
      resolve,
      Math.max(0, Number(milliseconds) || 0)
    );
  });
}

function playFreeRunTripRegisteredAudioAndWait(
  key,
  options = {}
) {
  const safeKey =
    String(key || '').trim();

  const audioUrl =
    freeRunTripVoiceAudioRegistry[
      safeKey
    ];

  if (!audioUrl) {
    console.warn(
      'FreeRunTrip 고정 MP3가 등록되지 않았습니다:',
      safeKey
    );

    return Promise.resolve(false);
  }

  return new Promise(function (resolve) {
    let finished = false;
    let timeoutId = null;

    const finish = function (success) {
      if (finished) {
        return;
      }

      finished = true;

      freeRunTripSharedAudioPlayer.removeEventListener(
        'ended',
        handleEnded
      );

      freeRunTripSharedAudioPlayer.removeEventListener(
        'error',
        handleError
      );

      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      resolve(success);
    };

    const handleEnded = function () {
      finish(true);
    };

    const handleError = function () {
      console.warn(
        'FreeRunTrip 고정 MP3 재생 오류:',
        safeKey
      );

      finish(false);
    };

    try {
      freeRunTripSharedAudioPlayer.addEventListener(
        'ended',
        handleEnded
      );

      freeRunTripSharedAudioPlayer.addEventListener(
        'error',
        handleError
      );

      freeRunTripSharedAudioPlayer.pause();
      freeRunTripSharedAudioPlayer.currentTime = 0;
      freeRunTripSharedAudioPlayer.src =
        audioUrl;

      freeRunTripActiveVoiceAudio =
        freeRunTripSharedAudioPlayer;

      const playPromise =
        freeRunTripSharedAudioPlayer.play();

      freeRunTripVoiceUnlocked = true;

      if (
        playPromise &&
        typeof playPromise.catch ===
          'function'
      ) {
        playPromise.catch(
          function (error) {
            console.warn(
              'FreeRunTrip 고정 MP3 재생 실패:',
              safeKey,
              error
            );

            finish(false);
          }
        );
      }

      timeoutId = setTimeout(
        function () {
          console.warn(
            'FreeRunTrip 고정 MP3 재생 대기 시간 초과:',
            safeKey
          );

          finish(false);
        },
        Math.max(
          3000,
          Number(options.timeoutMs) || 15000
        )
      );
    } catch (error) {
      console.warn(
        'FreeRunTrip 고정 MP3 재생 예외:',
        safeKey,
        error
      );

      finish(false);
    }
  });
}

async function playFreeRunTripRegisteredAudioSequence(
  keys,
  options = {}
) {
  const safeKeys = Array.isArray(keys)
    ? keys
        .map(function (key) {
          return String(key || '').trim();
        })
        .filter(Boolean)
    : [];

  if (safeKeys.length === 0) {
    return false;
  }

  /*
    종료 안내는 모두 고정 MP3로 재생한다.
    Typecast 서버 TTS와 완전히 분리하고,
    각 MP3의 실제 ended 이후에 짧은 간격을 둔 다음
    다음 MP3를 같은 Audio 객체로 재생한다.
  */
  cancelFreeRunTripVoiceGuidance();

  const gapMs =
    Math.max(
      0,
      Number(options.gapMs) || 300
    );

  for (
    let index = 0;
    index < safeKeys.length;
    index++
  ) {
    const key = safeKeys[index];

    const played =
      await playFreeRunTripRegisteredAudioAndWait(
        key,
        {
          timeoutMs: 15000
        }
      );

    if (!played) {
      console.warn(
        'FreeRunTrip 고정 종료 음성 시퀀스 중단:',
        key
      );

      return false;
    }

    if (index < safeKeys.length - 1) {
      await waitFreeRunTripVoiceGap(
        gapMs
      );
    }
  }

  return true;
}

function announceRunningEnd() {
  return playFreeRunTripRegisteredAudioSequence(
    [
      'running-end-voice',
      'running-end-mood-voice'
    ],
    {
      gapMs: 100
    }
  );
}

function announceRunTripEnd() {
  return playFreeRunTripRegisteredAudioSequence(
    [
      'runtrip-end-voice',
      'runtrip-end-mood-voice'
    ],
    {
      gapMs: 100
    }
  );
}

function announceRunTripDestinationArrival() {
  speakFreeRunTripVoice(
    '도착지에 도착했습니다.',
    {
      key: 'runtrip-destination-voice',
      interrupt: true
    }
  );
}

function announceRunTripDestinationThenEnd() {
  return playFreeRunTripRegisteredAudioSequence(
    [
      'runtrip-destination-voice',
      'runtrip-end-voice',
      'runtrip-end-mood-voice'
    ],
    {
      gapMs: 100
    }
  );
}

/*
  FreeRunTrip 고정 문장 음성 MP3 등록.
  해당 파일이 assets/audio에 있으면 MP3가 우선 재생되고,
  파일을 등록하지 않거나 재생할 수 없는 동적 문장은 TTS를 사용한다.

  필요한 고정 문장 파일명:
  - running-start-voice.mp3       : 러닝을 시작합니다.
  - runtrip-start-voice.mp3       : 런트립을 시작합니다.
  - runtrip-waypoint-1-voice.mp3  : 첫 번째 경유지에 도착했습니다.
  - runtrip-waypoint-2-voice.mp3  : 두 번째 경유지에 도착했습니다.
  - runtrip-waypoint-3-voice.mp3  : 세 번째 경유지에 도착했습니다.
  - runtrip-destination-voice.mp3 : 도착지에 도착했습니다.
  - running-end-voice.mp3         : 러닝을 종료합니다.
  - running-end-mood-voice.mp3    : 이번 러닝은 어떤 순간이었나요?
  - runtrip-end-voice.mp3         : 런트립을 종료합니다.
  - runtrip-end-mood-voice.mp3    : 이번 런트립은 즐거우셨나요?
*/
registerFreeRunTripVoiceAudio(
  'running-start-voice',
  './assets/audio/running-start-voice.mp3'
);

registerFreeRunTripVoiceAudio(
  'runtrip-start-voice',
  './assets/audio/runtrip-start-voice.mp3'
);

registerFreeRunTripVoiceAudio(
  'runtrip-waypoint-1-voice',
  './assets/audio/runtrip-waypoint-1-voice.mp3'
);

registerFreeRunTripVoiceAudio(
  'runtrip-waypoint-2-voice',
  './assets/audio/runtrip-waypoint-2-voice.mp3'
);

registerFreeRunTripVoiceAudio(
  'runtrip-waypoint-3-voice',
  './assets/audio/runtrip-waypoint-3-voice.mp3'
);

registerFreeRunTripVoiceAudio(
  'runtrip-destination-voice',
  './assets/audio/runtrip-destination-voice.mp3'
);

registerFreeRunTripVoiceAudio(
  'running-end-voice',
  './assets/audio/running-end-voice.mp3'
);

registerFreeRunTripVoiceAudio(
  'running-end-mood-voice',
  './assets/audio/running-end-mood-voice.mp3'
);

registerFreeRunTripVoiceAudio(
  'runtrip-end-voice',
  './assets/audio/runtrip-end-voice.mp3'
);

registerFreeRunTripVoiceAudio(
  'runtrip-end-mood-voice',
  './assets/audio/runtrip-end-mood-voice.mp3'
);

/*
  ElevenLabs 등으로 만든 고정 음성 파일을 나중에 연결할 때:
  registerFreeRunTripVoiceAudio(
    'runtrip-destination-voice',
    './assets/audio/runtrip-destination-voice.mp3'
  );
  처럼 key와 파일 경로만 등록하면 TTS보다 우선 재생된다.
*/
window.FreeRunTripVoiceGuidance = {
  prepare:
    prepareFreeRunTripVoiceGuidance,

  unlock:
    unlockFreeRunTripVoiceGuidance,

  speak:
    speakFreeRunTripVoice,

  cancel:
    cancelFreeRunTripVoiceGuidance,

  registerAudio:
    registerFreeRunTripVoiceAudio,

  playAudioNow:
    playFreeRunTripRegisteredAudioNow,

  queueAudio:
    queueFreeRunTripVoiceAudio
};

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

  if (runPhotoInput) {
    runPhotoInput.value = '';
  }

  if (runMemoInput) {
    runMemoInput.value = '';
  }

  if (runMemoCount) {
    runMemoCount.textContent = '0';
  }

  if (runPhotoFileName) {
    runPhotoFileName.textContent =
      '사진을 선택하면 기록에 함께 저장됩니다.';
  }
}

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
function getSmoothedPosition(
  latitude,
  longitude,
  accuracy
) {
  recentPositions.push({
    latitude: latitude,
    longitude: longitude,
    accuracy: Math.max(1, Number(accuracy) || MAX_ACCURACY)
  });

  if (recentPositions.length > SMOOTHING_COUNT) {
    recentPositions.shift();
  }

  let weightedLatitudeSum = 0;
  let weightedLongitudeSum = 0;
  let totalWeight = 0;

  recentPositions.forEach(function (position) {
    /* 정확도가 좋은 좌표에 더 큰 비중을 주어
       단순 평균보다 GPS 흔들림을 줄인다. */
    const weight = 1 / position.accuracy;

    weightedLatitudeSum +=
      position.latitude * weight;

    weightedLongitudeSum +=
      position.longitude * weight;

    totalWeight += weight;
  });

  return {
    latitude:
      weightedLatitudeSum / totalWeight,

    longitude:
      weightedLongitudeSum / totalWeight
  };
}

function getMinimumAcceptedDistance(accuracy, previousAccuracy) {
  const currentAccuracy = Math.max(1, Number(accuracy) || MAX_ACCURACY);
  const priorAccuracy = Math.max(1, Number(previousAccuracy) || currentAccuracy);
  const combinedAccuracy = (currentAccuracy + priorAccuracy) / 2;

  return Math.min(
    14,
    Math.max(
      MIN_DISTANCE,
      combinedAccuracy * GPS_ACCURACY_DISTANCE_RATIO
    )
  );
}

function addGpsDiagnostic(targetLog, entry) {
  targetLog.push({
    time: new Date().toISOString(),
    ...entry
  });

  if (targetLog.length > GPS_DIAGNOSTIC_LOG_LIMIT) {
    targetLog.splice(0, targetLog.length - GPS_DIAGNOSTIC_LOG_LIMIT);
  }
}

window.getFreeRunTripGpsDiagnostics = function () {
  return {
    running: runningGpsDiagnosticLog.slice(),
    runTrip: runTripGpsDiagnosticLog.slice()
  };
};

window.getFreeRunTripRecordDiagnostics = function (recordId) {
  const targetId = Number(recordId);
  const record = runRecords.find(function (item) {
    return Number(item.id) === targetId;
  });

  if (!record) {
    return null;
  }

  return {
    recordId: Number(record.id),
    activityType: getRecordActivityType(record),
    gpsDiagnostics: Array.isArray(record.gpsDiagnostics)
      ? record.gpsDiagnostics.slice()
      : []
  };
};

function isGpsSampleTooSoon(previousTimestamp, currentTimestamp) {
  if (
    !Number.isFinite(previousTimestamp) ||
    !Number.isFinite(currentTimestamp)
  ) {
    return false;
  }

  return (currentTimestamp - previousTimestamp) < GPS_MIN_SAMPLE_INTERVAL_MS;
}

function isImplausibleRunningJump(
  distanceMeters,
  previousTimestamp,
  currentTimestamp
) {
  if (
    !Number.isFinite(previousTimestamp) ||
    !Number.isFinite(currentTimestamp) ||
    currentTimestamp <= previousTimestamp
  ) {
    return false;
  }

  const elapsedSeconds = Math.max(
    1,
    (currentTimestamp - previousTimestamp) / 1000
  );

  const speedMetersPerSecond =
    distanceMeters / elapsedSeconds;

  return (
    speedMetersPerSecond >
    MAX_RUNNING_SPEED_METERS_PER_SECOND
  );
}
function getGpsSampleTiming(previousTimestamp, currentTimestamp) {
  if (
    !Number.isFinite(previousTimestamp) ||
    !Number.isFinite(currentTimestamp) ||
    currentTimestamp <= previousTimestamp
  ) {
    return {
      elapsedMs: null,
      elapsedSeconds: null
    };
  }

  const elapsedMs = currentTimestamp - previousTimestamp;

  return {
    elapsedMs: elapsedMs,
    elapsedSeconds: elapsedMs / 1000
  };
}

function getGpsSpeedMetersPerSecond(
  distanceMeters,
  previousTimestamp,
  currentTimestamp
) {
  const timing = getGpsSampleTiming(
    previousTimestamp,
    currentTimestamp
  );

  if (!timing.elapsedSeconds || timing.elapsedSeconds <= 0) {
    return null;
  }

  return distanceMeters / timing.elapsedSeconds;
}

function getAltitudeData(position) {
  const rawAltitude = position?.coords?.altitude;
  const rawAltitudeAccuracy = position?.coords?.altitudeAccuracy;

  const altitude =
    rawAltitude === null || rawAltitude === undefined
      ? null
      : Number(rawAltitude);

  const altitudeAccuracy =
    rawAltitudeAccuracy === null || rawAltitudeAccuracy === undefined
      ? null
      : Number(rawAltitudeAccuracy);

  return {
    altitude:
      Number.isFinite(altitude)
        ? altitude
        : null,
    altitudeAccuracy:
      Number.isFinite(altitudeAccuracy)
        ? altitudeAccuracy
        : null
  };
}

function addAltitudeSample(targetSamples, altitude, altitudeAccuracy) {
  if (!Number.isFinite(altitude)) {
    return null;
  }

  if (
    Number.isFinite(altitudeAccuracy) &&
    altitudeAccuracy > MAX_ALTITUDE_ACCURACY
  ) {
    return null;
  }

  targetSamples.push({
    altitude: altitude,
    accuracy: Math.max(
      1,
      Number.isFinite(altitudeAccuracy)
        ? altitudeAccuracy
        : MAX_ALTITUDE_ACCURACY
    )
  });

  if (targetSamples.length > ELEVATION_SMOOTHING_COUNT) {
    targetSamples.shift();
  }

  let weightedAltitude = 0;
  let totalWeight = 0;

  targetSamples.forEach(function (sample) {
    const weight = 1 / sample.accuracy;
    weightedAltitude += sample.altitude * weight;
    totalWeight += weight;
  });

  if (totalWeight <= 0) {
    return null;
  }

  return weightedAltitude / totalWeight;
}

function updateElevationAccumulator(
  smoothedAltitude,
  state
) {
  if (!Number.isFinite(smoothedAltitude)) {
    return state;
  }

  if (!Number.isFinite(state.referenceAltitude)) {
    state.referenceAltitude = smoothedAltitude;
    state.lastAltitude = smoothedAltitude;
    return state;
  }

  const delta = smoothedAltitude - state.referenceAltitude;

  if (delta >= ELEVATION_CHANGE_THRESHOLD_METERS) {
    state.gain += delta;
    state.referenceAltitude = smoothedAltitude;
  } else if (delta <= -ELEVATION_CHANGE_THRESHOLD_METERS) {
    state.loss += Math.abs(delta);
    state.referenceAltitude = smoothedAltitude;
  }

  state.lastAltitude = smoothedAltitude;
  return state;
}

function updateRunningElevation(position) {
  const altitudeData = getAltitudeData(position);

  const smoothedAltitude = addAltitudeSample(
    recentAltitudeSamples,
    altitudeData.altitude,
    altitudeData.altitudeAccuracy
  );

  if (!Number.isFinite(smoothedAltitude)) {
    runningElevationGain.textContent =
      `${Math.round(totalElevationGain)} m`;

    return null;
  }

  const state = updateElevationAccumulator(
    smoothedAltitude,
    {
      referenceAltitude: elevationReferenceAltitude,
      lastAltitude: lastValidAltitude,
      gain: totalElevationGain,
      loss: totalElevationLoss
    }
  );

  elevationReferenceAltitude = state.referenceAltitude;
  lastValidAltitude = state.lastAltitude;
  totalElevationGain = state.gain;
  totalElevationLoss = state.loss;
  currentSmoothedAltitude = smoothedAltitude;

  if (!Number.isFinite(splitStartAltitude)) {
    splitStartAltitude = smoothedAltitude;
  }

  runningElevationGain.textContent =
    `${Math.round(totalElevationGain)} m`;

  return smoothedAltitude;
}

function interpolateAltitude(
  startAltitude,
  endAltitude,
  progress
) {
  if (
    !Number.isFinite(startAltitude) ||
    !Number.isFinite(endAltitude)
  ) {
    return null;
  }

  const safeProgress = Math.max(0, Math.min(1, Number(progress) || 0));

  return (
    startAltitude +
    (endAltitude - startAltitude) * safeProgress
  );
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
  currentElapsedSeconds,
  previousAltitude,
  currentAltitude
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

    const splitEndAltitude = interpolateAltitude(
      previousAltitude,
      currentAltitude,
      progressToSplit
    );

    const elevationChange =
      Number.isFinite(splitStartAltitude) &&
      Number.isFinite(splitEndAltitude)
        ? splitEndAltitude - splitStartAltitude
        : null;

    splitRecords.push({
      index: splitRecords.length + 1,
      distanceMeters: 1000,
      durationSeconds: Math.round(splitDurationSeconds),
      duration: formatDurationFromSeconds(splitDurationSeconds),
      pace: formatPaceFromSeconds(splitDurationSeconds, 1000),
      elevationChange:
        Number.isFinite(elevationChange)
          ? Math.round(elevationChange)
          : null
    });

    splitStartElapsedSeconds = splitEndElapsedSeconds;

    if (Number.isFinite(splitEndAltitude)) {
      splitStartAltitude = splitEndAltitude;
    }

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

    const finalElevationChange =
      Number.isFinite(splitStartAltitude) &&
      Number.isFinite(currentSmoothedAltitude)
        ? currentSmoothedAltitude - splitStartAltitude
        : null;

    savedSplits.push({
      index: savedSplits.length + 1,
      distanceMeters: Math.round(remainingDistanceMeters),
      durationSeconds: Math.round(finalSplitDurationSeconds),
      duration: formatDurationFromSeconds(finalSplitDurationSeconds),
      pace: formatPaceFromSeconds(
        finalSplitDurationSeconds,
        remainingDistanceMeters
      ),
      elevationChange:
        Number.isFinite(finalElevationChange)
          ? Math.round(finalElevationChange)
          : null
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

      const elevationChange = Number(split.elevationChange);
      const elevationText = Number.isFinite(elevationChange)
        ? `${elevationChange > 0 ? '+' : ''}${Math.round(elevationChange)}m`
        : '--';

      return `
        <div class="split-row">
          <span class="split-label">${label}</span>
          <span class="split-duration">${split.duration}</span>
          <strong class="split-pace">${split.pace}</strong>
          <span class="split-elevation">${elevationText}</span>
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
function saveRunRecord() {
  const runEndTime = new Date();

  addGpsDiagnostic(runningGpsDiagnosticLog, {
    accepted: true,
    reason: 'record-save',
    displayedDistance: distanceDisplay.textContent,
    savedDistance: (totalDistance / 1000).toFixed(2),
    totalDistanceMeters: Number(totalDistance.toFixed(2)),
    elapsedSeconds: seconds
  });

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

    elevationGain: Math.round(totalElevationGain),

    elevationLoss: Math.round(totalElevationLoss),

    gpsDiagnosticSummary: {
      sampleCount: runningGpsDiagnosticLog.length,
      acceptedCount: runningGpsDiagnosticLog.filter(function (entry) {
        return entry.accepted === true;
      }).length,
      rejectedCount: runningGpsDiagnosticLog.filter(function (entry) {
        return entry.accepted === false;
      }).length
    },

    heartRate: null,

    cadence: null,

    gpsAccuracy:
      Number.isFinite(lastRunningGpsAccuracy)
        ? Math.round(lastRunningGpsAccuracy)
        : null,

    emotionalPace: getEmotionalPaceLabel(),

    photo: pendingRunPhoto,

  memo: runMemoInput ? runMemoInput.value.trim() : '',

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

  record.gpsDiagnostics = getGpsDiagnosticsForRecord(
    runningGpsDiagnosticLog
  );

  const nextRunRecords = [
  record,
  ...runRecords
];

const persistResult =
  persistRunRecordsSafely(
    nextRunRecords
  );

if (!persistResult.success) {
  console.error(
    '일반 러닝 기록 저장 실패:',
    persistResult.error
  );

  return null;
}

runRecords =
  persistResult.records;

if (persistResult.compacted) {
  console.warn(
    '저장 공간 확보를 위해 기존 기록의 GPS 진단 로그를 정리했습니다.'
  );
}

renderRunRecords();
renderRecordProfileFeed();
renderMonthlyReport();

console.log(
  '저장된 러닝 기록:',
  record
);

return record;
}
function initializeMapboxDetailRouteLayers() {
  if (
    !mapboxDetailMap ||
    !mapboxDetailMap.isStyleLoaded()
  ) {
    return;
  }

  if (
    !mapboxDetailMap.getSource(
      MAPBOX_DETAIL_PLANNED_ROUTE_SOURCE_ID
    )
  ) {
    mapboxDetailMap.addSource(
      MAPBOX_DETAIL_PLANNED_ROUTE_SOURCE_ID,
      {
        type: 'geojson',

        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'MultiLineString',
            coordinates: []
          }
        }
      }
    );
  }

  if (
    !mapboxDetailMap.getLayer(
      MAPBOX_DETAIL_PLANNED_ROUTE_LAYER_ID
    )
  ) {
    mapboxDetailMap.addLayer({
      id:
        MAPBOX_DETAIL_PLANNED_ROUTE_LAYER_ID,

      type: 'line',

      source:
        MAPBOX_DETAIL_PLANNED_ROUTE_SOURCE_ID,

      slot: 'top',

      layout: {
        'line-cap': 'round',
        'line-join': 'round'
      },

      paint: {
        'line-color': '#76e4d2',
        'line-width': 6,
        'line-opacity': 0.95,
        'line-dasharray': [
          0.1,
          2
        ]
      }
    });
  }

  if (
    !mapboxDetailMap.getSource(
      MAPBOX_DETAIL_ACTUAL_ROUTE_SOURCE_ID
    )
  ) {
    mapboxDetailMap.addSource(
      MAPBOX_DETAIL_ACTUAL_ROUTE_SOURCE_ID,
      {
        type: 'geojson',

        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'MultiLineString',
            coordinates: []
          }
        }
      }
    );
  }

  if (
    !mapboxDetailMap.getLayer(
      MAPBOX_DETAIL_ACTUAL_ROUTE_LAYER_ID
    )
  ) {
    mapboxDetailMap.addLayer({
      id:
        MAPBOX_DETAIL_ACTUAL_ROUTE_LAYER_ID,

      type: 'line',

      source:
        MAPBOX_DETAIL_ACTUAL_ROUTE_SOURCE_ID,

      slot: 'top',

      layout: {
        'line-cap': 'round',
        'line-join': 'round'
      },

      paint: {
        'line-color': '#76e4d2',
        'line-width': 6,
        'line-opacity': 0.95
      }
    });
  }
    if (
    mapboxDetailMap.getLayer(
      MAPBOX_DETAIL_PLANNED_ROUTE_LAYER_ID
    )
  ) {
    mapboxDetailMap.moveLayer(
      MAPBOX_DETAIL_PLANNED_ROUTE_LAYER_ID
    );
  }

  if (
    mapboxDetailMap.getLayer(
      MAPBOX_DETAIL_ACTUAL_ROUTE_LAYER_ID
    )
  ) {
    mapboxDetailMap.moveLayer(
      MAPBOX_DETAIL_ACTUAL_ROUTE_LAYER_ID
    );
  }
}
function initializeMapboxDetailMap() {
  if (mapboxDetailMap) {
    return mapboxDetailMap;
  }

  if (!mapboxDetailMapElement) {
  return null;
  }

  mapboxgl.accessToken =
    FREERUNTRIP_MAPBOX_ACCESS_TOKEN;

  mapboxDetailMap =
    new mapboxgl.Map({
      container:
        mapboxDetailMapElement,

      style:
        FREERUNTRIP_MAPBOX_STYLE_URL,

      center: [
        126.9780,
        37.5665
      ],

      zoom: 13,

      pitch: 0,
      bearing: 0,

      attributionControl: true
    });

  mapboxDetailMap.on(
    'load',
    function () {
      console.log(
        'FreeRunTrip Mapbox 기록 상세 지도 준비 완료'
      );

      initializeMapboxDetailRouteLayers();
    }
  );

  mapboxDetailMap.on(
    'error',
    function (event) {
      console.error(
        'FreeRunTrip Mapbox 기록 상세 지도 오류:',
        event.error || event
      );
    }
  );

  return mapboxDetailMap;
}
function clearMapboxDetailMarkers() {
  mapboxDetailMarkers.forEach(
    function (marker) {
      marker.remove();
    }
  );

  mapboxDetailMarkers = [];
}

function createMapboxDetailMarker(
  label,
  type,
  latLng,
  horizontalOffset = 0
) {
  if (
    !mapboxDetailMap ||
    !Array.isArray(latLng) ||
    latLng.length < 2
  ) {
    return null;
  }

  const latitude =
    Number(latLng[0]);

  const longitude =
    Number(latLng[1]);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  const markerElement =
    document.createElement('div');

  if (
    type === 'start' ||
    type === 'waypoint' ||
    type === 'destination'
  ) {
    markerElement.className =
      `runtrip-preview-marker ${type}`;

    markerElement.innerHTML = `
      <div class="runtrip-preview-marker-body">
        <span>
          ${escapePlaceSearchText(label)}
        </span>
      </div>

      <div
        class="runtrip-preview-marker-tip"
      ></div>
    `;
  } else {
    markerElement.className =
      `run-marker ${type}`;

    markerElement.innerHTML = `
      <div>
        ${escapePlaceSearchText(label)}
      </div>
    `;
  }

  const marker =
    new mapboxgl.Marker({
      element: markerElement,
      anchor:
        type === 'start' ||
        type === 'waypoint' ||
        type === 'destination'
          ? 'bottom'
          : 'center',

      offset: [
        Number(horizontalOffset || 0),
        0
      ]
    })
      .setLngLat([
        longitude,
        latitude
      ])
      .addTo(mapboxDetailMap);

  mapboxDetailMarkers.push(marker);

  return marker;
}

function convertDetailSegmentsToMapbox(
  segments
) {
  if (!Array.isArray(segments)) {
    return [];
  }

  return segments
    .map(function (segment) {
      if (!Array.isArray(segment)) {
        return [];
      }

      return segment
        .filter(function (point) {
          return (
            Array.isArray(point) &&
            point.length >= 2 &&
            Number.isFinite(
              Number(point[0])
            ) &&
            Number.isFinite(
              Number(point[1])
            )
          );
        })
        .map(function (point) {
          return [
            Number(point[1]),
            Number(point[0])
          ];
        });
    })
    .filter(function (segment) {
      return segment.length >= 2;
    });
}

function updateMapboxDetailRoutes(
  record,
  routeData
) {
  if (
    !mapboxDetailMap ||
    !mapboxDetailMap.isStyleLoaded()
  ) {
    return;
  }

  initializeMapboxDetailRouteLayers();

  const plannedSource =
    mapboxDetailMap.getSource(
      MAPBOX_DETAIL_PLANNED_ROUTE_SOURCE_ID
    );

  const actualSource =
    mapboxDetailMap.getSource(
      MAPBOX_DETAIL_ACTUAL_ROUTE_SOURCE_ID
    );

  const plannedSegments =
    convertDetailSegmentsToMapbox(
      routeData.plannedSegments
    );

  const actualSegments =
    convertDetailSegmentsToMapbox(
      routeData.actualSegments
    );
      console.log(
    'Mapbox 상세 경로 확인:',
    {
      activityType:
        routeData.isRunTrip
          ? 'runtrip'
          : 'running',

      actualSegmentCount:
        actualSegments.length,

      actualPointCount:
        actualSegments.reduce(
          function (sum, segment) {
            return sum + segment.length;
          },
          0
        ),

      plannedSegmentCount:
        plannedSegments.length,

      actualLayerExists:
        Boolean(
          mapboxDetailMap.getLayer(
            MAPBOX_DETAIL_ACTUAL_ROUTE_LAYER_ID
          )
        ),

      actualSourceExists:
        Boolean(actualSource)
    }
  );

  if (plannedSource) {
    plannedSource.setData({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'MultiLineString',
        coordinates:
          plannedSegments
      }
    });
  }

  if (actualSource) {
    actualSource.setData({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'MultiLineString',
        coordinates:
          actualSegments
      }
    });
  }

  if (
    mapboxDetailMap.getLayer(
      MAPBOX_DETAIL_ACTUAL_ROUTE_LAYER_ID
    )
  ) {
    mapboxDetailMap.setPaintProperty(
      MAPBOX_DETAIL_ACTUAL_ROUTE_LAYER_ID,
      'line-color',
      routeData.isRunTrip
        ? '#76e4d2'
        : '#facc15'
    );
  }
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
function showMapboxDetailMap(record) {
  const routeData =
    getDetailRouteData(record);

  if (
    !routeData.hasActual &&
    !routeData.hasPlanned
  ) {
    return;
  }

  const detailMapInstance =
    initializeMapboxDetailMap();

  if (!detailMapInstance) {
    return;
  }

  const renderMapboxDetail =
    function () {
      mapboxDetailMap.resize();

      clearMapboxDetailMarkers();

      updateMapboxDetailRoutes(
        record,
        routeData
      );

      const allPoints = [];

      routeData.plannedSegments.forEach(
        function (segment) {
          segment.forEach(
            function (point) {
              if (
                Array.isArray(point) &&
                point.length >= 2
              ) {
                allPoints.push(point);
              }
            }
          );
        }
      );

      routeData.actualSegments.forEach(
        function (segment) {
          segment.forEach(
            function (point) {
              if (
                Array.isArray(point) &&
                point.length >= 2
              ) {
                allPoints.push(point);
              }
            }
          );
        }
      );

      const markerSegments =
        routeData.hasActual
          ? routeData.actualSegments
          : routeData.plannedSegments;

      if (
        !Array.isArray(markerSegments) ||
        markerSegments.length === 0
      ) {
        return;
      }

      const firstSegment =
        markerSegments[0];

      const lastSegment =
        markerSegments[
          markerSegments.length - 1
        ];

      if (
        !Array.isArray(firstSegment) ||
        firstSegment.length === 0 ||
        !Array.isArray(lastSegment) ||
        lastSegment.length === 0
      ) {
        return;
      }

      const routeStartPoint =
        firstSegment[0];

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

        const isReturnToStartRecord =
          record.returnToStart === true &&
          isSameRunTripLatLng(
            startPoint,
            finishPoint
          );

        createMapboxDetailMarker(
          'S',
          'start',
          startPoint,
          isReturnToStartRecord ? -19 : 0
        );

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

            createMapboxDetailMarker(
              String(index + 1),
              'waypoint',
              waypointPoint
            );

            allPoints.push(
              waypointPoint
            );
          }
        );

        createMapboxDetailMarker(
          'D',
          'destination',
          finishPoint,
          isReturnToStartRecord ? 19 : 0
        );

        allPoints.push(
          startPoint,
          finishPoint
        );
      } else {
        createMapboxDetailMarker(
          'START',
          'running-start-marker',
          routeStartPoint
        );

        createMapboxDetailMarker(
          'FINISH',
          'running-finish-marker',
          routeFinishPoint
        );
      }

      if (allPoints.length === 0) {
        return;
      }

      const bounds =
        new mapboxgl.LngLatBounds();

      allPoints.forEach(
        function (point) {
          if (
            !Array.isArray(point) ||
            point.length < 2
          ) {
            return;
          }

          const latitude =
            Number(point[0]);

          const longitude =
            Number(point[1]);

          if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude)
          ) {
            return;
          }

          bounds.extend([
            longitude,
            latitude
          ]);
        }
      );

      if (!bounds.isEmpty()) {
        mapboxDetailMap.fitBounds(
          bounds,
          {
            padding: 24,
            maxZoom: 17,
            duration: 0
          }
        );
      }
    };

    const renderMapboxDetailSafely =
    function () {
      renderMapboxDetail();

      mapboxDetailMap.once(
        'idle',
        function () {
          renderMapboxDetail();
        }
      );
    };

  if (mapboxDetailMap.isStyleLoaded()) {
    renderMapboxDetailSafely();
  } else {
    mapboxDetailMap.once(
      'load',
      renderMapboxDetailSafely
    );
  }
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
    흰색 원형 점으로 그린다.
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
          color: '#76e4d2',
          weight: 6,
          opacity: 0.95,
          dashArray: '1 12',
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
    밝은 민트색 실선으로 표시하고
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
            color: routeData.isRunTrip ? '#76e4d2' : '#facc15',
            weight: 6,
            opacity: 0.95,
            lineCap: 'round',
            lineJoin: 'round'
          }).addTo(detailMap);

        detailRouteLines.push(
          actualLine
        );
      }
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

    elevationGain:
      Number.isFinite(Number(record.elevationGain))
        ? Math.round(Number(record.elevationGain))
        : null,

    elevationLoss:
      Number.isFinite(Number(record.elevationLoss))
        ? Math.round(Number(record.elevationLoss))
        : null,

    heartRate:
      Number.isFinite(Number(record.heartRate))
        ? Math.round(Number(record.heartRate))
        : null,

    cadence:
      Number.isFinite(Number(record.cadence))
        ? Math.round(Number(record.cadence))
        : null,

    gpsAccuracy:
      Number.isFinite(Number(record.gpsAccuracy))
        ? Math.round(Number(record.gpsAccuracy))
        : null,

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

  recordCard.dataset.recordId =
    String(record.id);

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

    detailAveragePace.textContent =
      record.pace || `--'--"`;

    detailElevationGain.textContent =
      record.elevationGain === null
        ? '측정되지 않음'
        : `${record.elevationGain} m`;

    detailHeartRate.textContent =
      record.heartRate === null
        ? '측정되지 않음'
        : `${record.heartRate} bpm`;

    detailCadence.textContent =
      record.cadence === null
        ? '측정되지 않음'
        : `${record.cadence} spm`;

if (isRunTrip) {
  detailRunTripInfo.classList.remove(
    'hidden'
  );

  detailRunTripOrigin.textContent =
    record.originName;

  detailRunTripDestination.textContent =
    record.destinationName;

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

    if (isRunTrip) {
      renderRunTripMomentPhotos(record);
    } else {
      const oldMoments = detailMemory.querySelector('.runtrip-moments');
      if (oldMoments) {
        oldMoments.remove();
      }
    }

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

    const detailRouteData =
      getDetailRouteData(record);

    const hasRoute =
      detailRouteData.hasActual ||
      detailRouteData.hasPlanned;

    detailMapSection.classList.toggle(
      'hidden',
      !hasRoute
    );

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

    if (hasRoute) {
  detailMapElement.style.display =
    'none';

  if (mapboxDetailMapElement) {
    mapboxDetailMapElement.style.display =
      'block';
  }

  requestAnimationFrame(function () {
    showMapboxDetailMap(record);
  });
}
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

startBtn.addEventListener('click', async function () {
  console.log('러닝 시작 버튼 클릭됨');

  unlockFreeRunTripVoiceGuidance();

  const isNewRunningSession =
    !isRunning &&
    seconds === 0 &&
    !paused;

  if (isNewRunningSession) {
    const countdownCompleted =
      await showActivityCountdown('RUNNING');

    if (!countdownCompleted) {
      return;
    }

    announceRunningStart();
  }
if (!isRunning) {
  runningIdlePanel.classList.add('hidden');
  runningDashboard.classList.remove('hidden');

  map.getContainer().style.display =
    'none';

  const mapboxMainContainer =
    document.getElementById(
      'mapboxMainMap'
    );

  if (mapboxMainContainer) {
    mapboxMainContainer.style.display =
      'block';
  }

  if (freeRunTripMapboxMainMap) {
    requestAnimationFrame(function () {
      freeRunTripMapboxMainMap.resize();
    });
  }

  isRunningMapFollowing = true;
  updateRunningFollowState();

  if (seconds === 0) {
    runStartTime = new Date();
    resetRunningVoiceGuidance();
    totalElevationGain = 0;
    totalElevationLoss = 0;
    lastValidAltitude = null;
    elevationReferenceAltitude = null;
    recentAltitudeSamples = [];
    currentSmoothedAltitude = null;
    splitStartAltitude = null;
    lastRunningGpsAccuracy = null;
runningGpsDiagnosticLog = [];

runningCalories.textContent = '0 kcal';
runningElevationGain.textContent = '0 m';
runningHeartRate.textContent = '-- bpm';
runningCadence.textContent = '-- spm';
runningGpsStatus.textContent = 'GPS 위치 확인 중';
  routeCoordinates = [];
  routeSegments = [];
  activeRouteSegment = [];
  runningRouteNeedsNewSegment = false;


  clearMapboxRunningRoute();

  beginNewRouteSegment();

    splitRecords = [];
    nextSplitDistanceMeters = 1000;
    splitStartElapsedSeconds = 0;
    lastGpsElapsedSeconds = 0;
  }

  if (paused) {
  /*
    일시정지 후 재시작하는 순간
    이전 경로와 완전히 분리된 새 세그먼트를 만든다.
    이후 첫 GPS 좌표부터 이 새 세그먼트에 기록한다.
  */
  routeLine = null;
  activeRouteSegment = null;

  beginNewRouteSegment();

  runningRouteNeedsNewSegment = false;

  lastValidPosition = null;
  lastValidAltitude = null;
  elevationReferenceAltitude = null;
  recentAltitudeSamples = [];
  currentSmoothedAltitude = null;
  splitStartAltitude = null;
  recentPositions = [];

  lastGpsElapsedSeconds = seconds;

  console.log(
    '러닝 새 경로 세그먼트 시작:',
    routeSegments.length
  );

  paused = false;
}

pauseBtn.textContent = '일시정지';

isRunning = true;
hideBottomNavigation();
updateRunningFollowState();

  setTimeout(function () {
  map.invalidateSize();
}, 100);

  timerInterval = setInterval(function () {
    seconds++;

    const minutes = String(Math.floor(seconds / 60)).padStart(2, '0');
    const remainingSeconds = String(seconds % 60).padStart(2, '0');

    timer.textContent = `${minutes}:${remainingSeconds}`;
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
lastRunningGpsAccuracy = Number.isFinite(accuracy) ? accuracy : null;

console.log(latitude, longitude, accuracy);

if (accuracy > MAX_ACCURACY) {
  console.log(
    'GPS 정확도 낮음, 좌표 무시:',
    accuracy
  );

  const altitudeData = getAltitudeData(position);

  addGpsDiagnostic(runningGpsDiagnosticLog, {
    accepted: false,
    reason: 'low-accuracy',
    latitude: Number(latitude.toFixed(7)),
    longitude: Number(longitude.toFixed(7)),
    accuracy: Number(accuracy.toFixed(1)),
    altitude: altitudeData.altitude,
    altitudeAccuracy: altitudeData.altitudeAccuracy,
    totalDistanceMeters: Number(totalDistance.toFixed(2))
  });

  runningGpsStatus.textContent =
    'GPS 정확도 확인 중';

  return;
}

runningGpsStatus.textContent =
  'GPS 연결됨';

const gpsTimestamp = Number(position.timestamp) || Date.now();

const smoothedPosition = getSmoothedPosition(
  latitude,
  longitude,
  accuracy
);
if (lastValidPosition) {
  const distanceFromLast = calculateDistance(
    lastValidPosition.latitude,
    lastValidPosition.longitude,
    smoothedPosition.latitude,
    smoothedPosition.longitude
  );

  const minimumAcceptedDistance =
    getMinimumAcceptedDistance(
      accuracy,
      lastValidPosition.accuracy
    );

  const timing = getGpsSampleTiming(
    lastValidPosition.timestamp,
    gpsTimestamp
  );

  const speedMetersPerSecond = getGpsSpeedMetersPerSecond(
    distanceFromLast,
    lastValidPosition.timestamp,
    gpsTimestamp
  );

  const altitudeData = getAltitudeData(position);

  const commonDiagnostic = {
    latitude: Number(latitude.toFixed(7)),
    longitude: Number(longitude.toFixed(7)),
    smoothedLatitude: Number(smoothedPosition.latitude.toFixed(7)),
    smoothedLongitude: Number(smoothedPosition.longitude.toFixed(7)),
    accuracy: Number(accuracy.toFixed(1)),
    previousAccuracy: Number((lastValidPosition.accuracy || accuracy).toFixed(1)),
    altitude: altitudeData.altitude,
    altitudeAccuracy: altitudeData.altitudeAccuracy,
    elapsedMs: timing.elapsedMs,
    rawDistanceMeters: Number(distanceFromLast.toFixed(2)),
    speedMetersPerSecond:
      Number.isFinite(speedMetersPerSecond)
        ? Number(speedMetersPerSecond.toFixed(2))
        : null,
    minimumAcceptedDistanceMeters: Number(minimumAcceptedDistance.toFixed(2)),
    totalDistanceBeforeMeters: Number(totalDistance.toFixed(2))
  };

  if (
    isGpsSampleTooSoon(
      lastValidPosition.timestamp,
      gpsTimestamp
    )
  ) {
    addGpsDiagnostic(runningGpsDiagnosticLog, {
      ...commonDiagnostic,
      accepted: false,
      reason: 'sample-too-soon',
      reflectedDistanceMeters: 0,
      totalDistanceMeters: Number(totalDistance.toFixed(2))
    });
    return;
  }

  if (
    distanceFromLast <
    minimumAcceptedDistance
  ) {
    console.log(
      'GPS 흔들림 또는 짧은 이동 좌표 무시:',
      distanceFromLast,
      '최소 기준:',
      minimumAcceptedDistance
    );

    addGpsDiagnostic(runningGpsDiagnosticLog, {
      ...commonDiagnostic,
      accepted: false,
      reason: 'below-distance-threshold',
      reflectedDistanceMeters: 0,
      totalDistanceMeters: Number(totalDistance.toFixed(2))
    });

    return;
  }

  if (
    isImplausibleRunningJump(
      distanceFromLast,
      lastValidPosition.timestamp,
      gpsTimestamp
    )
  ) {
    console.log(
      '비정상적인 GPS 순간 이동 무시:',
      distanceFromLast
    );

    recentPositions = [
      {
        latitude: latitude,
        longitude: longitude,
        accuracy: Math.max(1, accuracy)
      }
    ];

    addGpsDiagnostic(runningGpsDiagnosticLog, {
      ...commonDiagnostic,
      accepted: false,
      reason: 'implausible-speed',
      reflectedDistanceMeters: 0,
      totalDistanceMeters: Number(totalDistance.toFixed(2))
    });

    return;
  }

  const previousDistance = totalDistance;
  const previousElapsedSeconds = lastGpsElapsedSeconds;
  const previousAltitude = currentSmoothedAltitude;
  const calibratedDistance =
    getCalibratedGpsDistance(
      distanceFromLast
    );

  totalDistance += calibratedDistance;

  announceRunningDistanceMilestones(
    previousDistance,
    totalDistance
  );

  const smoothedAltitude = updateRunningElevation(position);

  addGpsDiagnostic(runningGpsDiagnosticLog, {
    ...commonDiagnostic,
    accepted: true,
    reason: 'distance-added',
    calibratedDistanceMeters: Number(calibratedDistance.toFixed(2)),
    reflectedDistanceMeters: Number(calibratedDistance.toFixed(2)),
    calibrationFactor: GPS_DISTANCE_CALIBRATION_FACTOR,
    smoothedAltitude:
      Number.isFinite(smoothedAltitude)
        ? Number(smoothedAltitude.toFixed(2))
        : null,
    elevationGainMeters: Number(totalElevationGain.toFixed(2)),
    elevationLossMeters: Number(totalElevationLoss.toFixed(2)),
    totalDistanceMeters: Number(totalDistance.toFixed(2))
  });

  addCompletedSplits(
    previousDistance,
    calibratedDistance,
    previousElapsedSeconds,
    seconds,
    previousAltitude,
    smoothedAltitude
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


console.log('총 이동거리:', totalDistance);
} else {
  const initialAltitude = updateRunningElevation(position);
  const altitudeData = getAltitudeData(position);

  addGpsDiagnostic(runningGpsDiagnosticLog, {
    accepted: true,
    reason: 'initial-position',
    latitude: Number(latitude.toFixed(7)),
    longitude: Number(longitude.toFixed(7)),
    smoothedLatitude: Number(smoothedPosition.latitude.toFixed(7)),
    smoothedLongitude: Number(smoothedPosition.longitude.toFixed(7)),
    accuracy: Number(accuracy.toFixed(1)),
    altitude: altitudeData.altitude,
    altitudeAccuracy: altitudeData.altitudeAccuracy,
    smoothedAltitude:
      Number.isFinite(initialAltitude)
        ? Number(initialAltitude.toFixed(2))
        : null,
    reflectedDistanceMeters: 0,
    totalDistanceMeters: Number(totalDistance.toFixed(2))
  });
}

lastValidPosition = {
  latitude: smoothedPosition.latitude,
  longitude: smoothedPosition.longitude,
  timestamp: gpsTimestamp,
  accuracy: accuracy
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
updateMapboxRunningCurrentMarker(
  currentLatLng
);
if (isRunningMapFollowing) {
  centerRunningMapOnPosition(
    currentLatLng,
    {
      animate: false
    }
  );

  centerMapboxRunningMapOnPosition(
    currentLatLng,
    {
      animate: false
    }
  );
}
},

function (error) {
    console.log('GPS 에러 발생');
    console.log(error);
  },

  {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 0
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

  cancelFreeRunTripVoiceGuidance();

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
  runningRouteNeedsNewSegment = true;

  lastValidPosition = null;
  lastValidAltitude = null;
  elevationReferenceAltitude = null;
  recentAltitudeSamples = [];
  currentSmoothedAltitude = null;
  splitStartAltitude = null;
  recentPositions = [];

  pauseBtn.textContent = '다시 시작';

  runningGpsStatus.textContent =
    'GPS 일시정지';

  updateRunningFollowState();
});
runningFollowStateBtn.addEventListener(
  'click',
  function () {
    if (!isRunning || paused) {
      return;
    }

    isRunningMapFollowing =
      !isRunningMapFollowing;

    if (
      isRunningMapFollowing &&
      lastValidPosition
    ) {
      centerRunningMapOnPosition(
        [
          lastValidPosition.latitude,
          lastValidPosition.longitude
        ],
        { animate: true }
      );
      centerMapboxRunningMapOnPosition(
       [
         lastValidPosition.latitude,
         lastValidPosition.longitude
       ],
       { animate: true }
     );
    }

    updateRunningFollowState();
  }
);

map.on('dragstart', function () {
  if (
    !isRunning ||
    paused ||
    !isRunningMapFollowing
  ) {
    return;
  }

  isRunningMapFollowing = false;
  updateRunningFollowState();
});

freeRunTripMapboxMainMap.on(
  'dragstart',
  function () {
    if (
      !isRunning ||
      paused ||
      !isRunningMapFollowing
    ) {
      return;
    }

    isRunningMapFollowing = false;
    updateRunningFollowState();
  }
);
function connectReliableSafariTap(button) {
  if (!button) {
    return;
  }

  button.style.touchAction =
    'manipulation';

  button.addEventListener(
    'touchend',
    function (event) {
      event.preventDefault();

      button.click();
    },
    {
      passive: false
    }
  );
}

connectReliableSafariTap(
  stopBtn
);

connectReliableSafariTap(
  saveRunWithMoodBtn
);
stopBtn.addEventListener('click', function () {
  console.log('러닝 종료 버튼 클릭됨');

  addGpsDiagnostic(runningGpsDiagnosticLog, {
    accepted: true,
    reason: 'stop-button',
    displayedDistance: distanceDisplay.textContent,
    totalDistanceMeters: Number(totalDistance.toFixed(2)),
    elapsedSeconds: seconds
  });

  // 종료를 누른 순간부터 늦게 도착하는 GPS 좌표를 무시한다.
  isRunning = false;
  paused = true;

  announceRunningEnd();

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

    // 종료 음성이 재생 중이라면 멈추고
    // 종료 직전까지 측정한 시간·거리·경로를 유지한 채
    // 일반 러닝을 다시 시작한다.
    cancelFreeRunTripVoiceGuidance();
    startBtn.click();
  }
);
saveRunWithMoodBtn.addEventListener('click', function () {
  const activeMoodButton = document.querySelector('.pace-mood-option.active');

  if (activeMoodButton) {
    selectedPaceMood = activeMoodButton.dataset.mood;

    try {
  localStorage.setItem(
    'selectedPaceMood',
    selectedPaceMood
  );
} catch (error) {
  console.warn(
    'Pace Mood 설정 저장 실패:',
    error
  );
}
  }

const savedRunRecord =
  saveRunRecord();

if (!savedRunRecord) {
  alert(
    '러닝 기록을 저장하지 못했어요. 기록은 그대로 유지하고 있으니 다시 저장해 주세요.'
  );

  return;
}

resetRunMemoryInputs();

paceMoodModal.classList.add('hidden');

  seconds = 0;
  timer.textContent = '00:00';
  totalDistance = 0;
totalElevationGain = 0;
totalElevationLoss = 0;
lastValidAltitude = null;
elevationReferenceAltitude = null;
recentAltitudeSamples = [];
currentSmoothedAltitude = null;
splitStartAltitude = null;
lastRunningGpsAccuracy = null;

distanceDisplay.textContent = '0.00 km';
paceDisplay.textContent = `--'--"`;

runningCalories.textContent = '0 kcal';
runningElevationGain.textContent = '0 m';
runningHeartRate.textContent = '-- bpm';
runningCadence.textContent = '-- spm';

runningGpsStatus.textContent =
  'GPS 연결 준비';

routeCoordinates = [];
routeSegments = [];
activeRouteSegment = [];
runningRouteNeedsNewSegment = false;

clearMapboxRunningRoute();

recentPositions = [];
lastValidPosition = null;

splitRecords = [];
nextSplitDistanceMeters = 1000;
splitStartElapsedSeconds = 0;
lastGpsElapsedSeconds = 0;
resetRunningVoiceGuidance();

  routeLines.forEach(function (line) {
    map.removeLayer(line);
  });

  routeLines = [];
  routeLine = null;

  if (currentMarker) {
    map.removeLayer(currentMarker);
    currentMarker = null;
  }
   if (mapboxRunningCurrentMarker) {
    mapboxRunningCurrentMarker.remove();
    mapboxRunningCurrentMarker = null;
  }
  isRunning = false;
  runStartTime = null;
  paused = false;
  isRunningMapFollowing = true;
  updateRunningFollowState();
  runningDashboard.classList.add('hidden');
  runningIdlePanel.classList.remove('hidden');

  if (savedRunRecord) {
    setTimeout(function () {
      selectedRecordFilter = 'all';

      recordsFilterTabs.forEach(
        function (tab) {
          const isActive =
            tab.dataset.recordFilter === 'all';

          tab.classList.toggle(
            'active',
            isActive
          );

          tab.setAttribute(
            'aria-selected',
            String(isActive)
          );
        }
      );

      openAppPage('records');

      const savedRecordCard =
        recordsList.querySelector(
          `[data-record-id="${savedRunRecord.id}"]`
        );

      if (savedRecordCard) {
        savedRecordCard.click();
      }
    }, 0);
  }
});
if (detailTakePhotoBtn && detailCameraInput) {
  detailTakePhotoBtn.addEventListener(
    'click',
    function () {
      if (!selectedDetailRecord) {
        return;
      }

      detailCameraInput.value = '';
      detailCameraInput.click();
    }
  );

  detailCameraInput.addEventListener(
    'change',
    async function () {
      const capturedFile =
        detailCameraInput.files &&
        detailCameraInput.files[0];

      if (!capturedFile || isPhotoProcessing) {
        return;
      }

      isPhotoProcessing = true;

      try {
        const dataUrl =
          await compressRunPhoto(capturedFile);

        const capturedAt =
          new Date().toISOString();

        if (
          pendingRunTripPhotoContext &&
          isRunTripFollowing
        ) {
          const context = {
            ...pendingRunTripPhotoContext,
            capturedAt: capturedAt
          };

          const photoId =
            `runtrip-photo-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 8)}`;

          await saveRunTripPhotoToDatabase({
            id: photoId,
            recordId: null,
            sessionId: context.sessionId,
            activityType: 'runtrip',
            source: context.source,
            checkpointNumber: context.checkpointNumber,
            placeName: context.placeName,
            elapsedSeconds: context.elapsedSeconds,
            distanceMeters: context.distanceMeters,
            latitude: context.latitude,
            longitude: context.longitude,
            accuracy: context.accuracy,
            capturedAt: context.capturedAt,
            fileName: capturedFile.name || '',
            mimeType: 'image/jpeg',
            dataUrl: dataUrl
          });

          activeRunTripPhotoIds.push(photoId);
          saveActiveRunTripState();

          console.log(
            'RunTrip 사진 기록 저장 완료:',
            photoId,
            context
          );

          pendingRunTripPhotoContext = null;
          return;
        }

        if (
          pendingRunTripPhotoContext &&
          completedRunTripRecordId !== null
        ) {
          const context = {
            ...pendingRunTripPhotoContext,
            capturedAt: capturedAt
          };

          const photoId =
            `runtrip-photo-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 8)}`;

          await saveRunTripPhotoToDatabase({
            id: photoId,
            recordId: Number(completedRunTripRecordId),
            sessionId: context.sessionId,
            activityType: 'runtrip',
            source: context.source,
            checkpointNumber: context.checkpointNumber,
            placeName: context.placeName,
            elapsedSeconds: context.elapsedSeconds,
            distanceMeters: context.distanceMeters,
            latitude: context.latitude,
            longitude: context.longitude,
            accuracy: context.accuracy,
            capturedAt: context.capturedAt,
            fileName: capturedFile.name || '',
            mimeType: 'image/jpeg',
            dataUrl: dataUrl
          });

          const completedRecord =
            runRecords.find(function (item) {
              return (
                Number(item.id) ===
                Number(completedRunTripRecordId)
              );
            });

          if (completedRecord) {
            completedRecord.photoIds =
              Array.isArray(completedRecord.photoIds)
                ? completedRecord.photoIds.slice()
                : [];

            completedRecord.photoIds.push(photoId);

            const persistResult =
              persistRunRecordsSafely(runRecords);

            if (persistResult.success) {
              runRecords = persistResult.records;
              renderRunRecords();
              renderRecordProfileFeed();
            }
          }

          console.log(
            'RunTrip 도착지 사진 기록 저장 완료:',
            photoId,
            context
          );

          pendingRunTripPhotoContext = null;
          return;
        }

        if (!selectedDetailRecord) {
          return;
        }

        const photoId =
          `activity-photo-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}`;

        await saveRunTripPhotoToDatabase({
          id: photoId,
          recordId: Number(selectedDetailRecord.id),
          sessionId: null,
          activityType: getRecordActivityType(selectedDetailRecord),
          source: 'activity',
          checkpointNumber: null,
          placeName: '',
          elapsedSeconds: durationToSeconds(selectedDetailRecord.duration),
          distanceMeters: (Number(selectedDetailRecord.distance) || 0) * 1000,
          latitude: null,
          longitude: null,
          accuracy: null,
          capturedAt: capturedAt,
          fileName: capturedFile.name || '',
          mimeType: 'image/jpeg',
          dataUrl: dataUrl
        });

        const sourceRecord = runRecords.find(function (item) {
          return Number(item.id) === Number(selectedDetailRecord.id);
        });

        if (sourceRecord) {
          sourceRecord.photoIds = Array.isArray(sourceRecord.photoIds)
            ? sourceRecord.photoIds.slice()
            : [];

          sourceRecord.photoIds.push(photoId);

          const persistResult =
            persistRunRecordsSafely(runRecords);

          if (persistResult.success) {
            runRecords = persistResult.records;
            selectedDetailRecord.photoIds =
              sourceRecord.photoIds.slice();

            renderRunTripMomentPhotos(selectedDetailRecord);
            renderRunRecords();
          }
        }
      } catch (error) {
        console.error('사진 기록 저장 실패:', error);

        alert(
          '사진을 저장하지 못했어요. 다시 촬영해 주세요.'
        );
      } finally {
        isPhotoProcessing = false;
        pendingRunTripPhotoContext = null;
        detailCameraInput.value = '';
      }
    }
  );
}

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
backToRecordsBtn.addEventListener(
  'click',
  function () {
    detailMapSection.classList.add(
      'hidden'
    );

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
let pendingRunTripPreviewFocusLatLng = null;
let selectedRunTripOrigin = null;
let selectedRunTripDestination = null;
let isRunTripDestinationAutoSetFromOrigin = false;

let isGettingRunTripCurrentLocation = false;

let mapboxRunTripPlannedRouteSourceReady = false;
let mapboxRunTripPreviewMarkers = [];

let mapboxRunTripActualRouteSourceReady = false;

const MAPBOX_RUNTRIP_ACTUAL_ROUTE_SOURCE_ID =
  'freeruntrip-runtrip-actual-route-source';

const MAPBOX_RUNTRIP_ACTUAL_ROUTE_LAYER_ID =
  'freeruntrip-runtrip-actual-route-layer';

const MAPBOX_RUNTRIP_PLANNED_ROUTE_SOURCE_ID =
  'freeruntrip-runtrip-planned-route-source';

const MAPBOX_RUNTRIP_PLANNED_ROUTE_LAYER_ID =
  'freeruntrip-runtrip-planned-route-layer';

const MAPBOX_RUNTRIP_NAVIGATION_CASING_LAYER_ID =
  'freeruntrip-runtrip-navigation-casing-layer';

const MAPBOX_RUNTRIP_NAVIGATION_ROUTE_LAYER_ID =
  'freeruntrip-runtrip-navigation-route-layer';

const MAPBOX_RUNTRIP_NAVIGATION_ARROW_LAYER_ID =
  'freeruntrip-runtrip-navigation-arrow-layer';

function initializeMapboxRunTripPlannedRouteLayer() {
  if (!freeRunTripMapboxMainMap) {
    return;
  }

  if (!freeRunTripMapboxMainMap.isStyleLoaded()) {
    return;
  }

  if (
    !freeRunTripMapboxMainMap.getSource(
      MAPBOX_RUNTRIP_PLANNED_ROUTE_SOURCE_ID
    )
  ) {
    freeRunTripMapboxMainMap.addSource(
      MAPBOX_RUNTRIP_PLANNED_ROUTE_SOURCE_ID,
      {
        type: 'geojson',

        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: []
          }
        }
      }
    );
  }

  if (
    !freeRunTripMapboxMainMap.getLayer(
      MAPBOX_RUNTRIP_PLANNED_ROUTE_LAYER_ID
    )
  ) {
    freeRunTripMapboxMainMap.addLayer({
      id:
        MAPBOX_RUNTRIP_PLANNED_ROUTE_LAYER_ID,

      type: 'line',

      source:
        MAPBOX_RUNTRIP_PLANNED_ROUTE_SOURCE_ID,

      layout: {
        'line-cap': 'round',
        'line-join': 'round'
      },

      paint: {
        'line-color': '#76e4d2',
        'line-width': 6,
        'line-opacity': 0.95,
        'line-dasharray': [0.1, 2]
      }
    });
  }

  /*
    RunTrip 실행 전 미리보기는 기존 민트 점선을 유지하고,
    실행 중에는 별도의 굵은 내비게이션 경로와 방향 화살표를 켠다.
    이렇게 하면 경로 설정 화면과 실제 러닝 화면의 역할이 명확히 구분된다.
  */
  if (
    !freeRunTripMapboxMainMap.getLayer(
      MAPBOX_RUNTRIP_NAVIGATION_CASING_LAYER_ID
    )
  ) {
    freeRunTripMapboxMainMap.addLayer({
      id:
        MAPBOX_RUNTRIP_NAVIGATION_CASING_LAYER_ID,

      type: 'line',

      source:
        MAPBOX_RUNTRIP_PLANNED_ROUTE_SOURCE_ID,

      layout: {
        visibility: 'none',
        'line-cap': 'round',
        'line-join': 'round'
      },

      paint: {
        'line-color': '#0f172a',
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          16, 11,
          18, 14,
          20, 16
        ],
        'line-opacity': 0.42
      }
    });
  }

  if (
    !freeRunTripMapboxMainMap.getLayer(
      MAPBOX_RUNTRIP_NAVIGATION_ROUTE_LAYER_ID
    )
  ) {
    freeRunTripMapboxMainMap.addLayer({
      id:
        MAPBOX_RUNTRIP_NAVIGATION_ROUTE_LAYER_ID,

      type: 'line',

      source:
        MAPBOX_RUNTRIP_PLANNED_ROUTE_SOURCE_ID,

      layout: {
        visibility: 'none',
        'line-cap': 'round',
        'line-join': 'round'
      },

      paint: {
        'line-color': '#76e4d2',
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          16, 8,
          18, 10,
          20, 12
        ],
        'line-opacity': 0.98
      }
    });
  }

  if (
    !freeRunTripMapboxMainMap.getLayer(
      MAPBOX_RUNTRIP_NAVIGATION_ARROW_LAYER_ID
    )
  ) {
    freeRunTripMapboxMainMap.addLayer({
      id:
        MAPBOX_RUNTRIP_NAVIGATION_ARROW_LAYER_ID,

      type: 'symbol',

      source:
        MAPBOX_RUNTRIP_PLANNED_ROUTE_SOURCE_ID,

      layout: {
        visibility: 'none',
        'symbol-placement': 'line',
        'symbol-spacing': 72,
        'text-field': '➤',
        'text-size': 15,
        'text-rotation-alignment': 'map',
        'text-pitch-alignment': 'map',
        'text-keep-upright': false,
        'text-allow-overlap': false,
        'text-ignore-placement': true
      },

      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#43cdbb',
        'text-halo-width': 1.2,
        'text-opacity': 0.96
      }
    });
  }

  mapboxRunTripPlannedRouteSourceReady =
    true;
}

function setMapboxRunTripNavigationAppearance(
  isNavigationActive
) {
  if (
    !freeRunTripMapboxMainMap ||
    !freeRunTripMapboxMainMap.isStyleLoaded()
  ) {
    return;
  }

  initializeMapboxRunTripPlannedRouteLayer();

  const navigationVisibility =
    isNavigationActive
      ? 'visible'
      : 'none';

  const previewVisibility =
    isNavigationActive
      ? 'none'
      : 'visible';

  if (
    freeRunTripMapboxMainMap.getLayer(
      MAPBOX_RUNTRIP_PLANNED_ROUTE_LAYER_ID
    )
  ) {
    freeRunTripMapboxMainMap.setLayoutProperty(
      MAPBOX_RUNTRIP_PLANNED_ROUTE_LAYER_ID,
      'visibility',
      previewVisibility
    );
  }

  [
    MAPBOX_RUNTRIP_NAVIGATION_CASING_LAYER_ID,
    MAPBOX_RUNTRIP_NAVIGATION_ROUTE_LAYER_ID,
    MAPBOX_RUNTRIP_NAVIGATION_ARROW_LAYER_ID
  ].forEach(function (layerId) {
    if (
      freeRunTripMapboxMainMap.getLayer(
        layerId
      )
    ) {
      freeRunTripMapboxMainMap.setLayoutProperty(
        layerId,
        'visibility',
        navigationVisibility
      );
    }
  });

  /* 진행 방향 화살표가 실제 이동 경로보다 위에서 보이도록 유지한다. */
  if (
    isNavigationActive &&
    freeRunTripMapboxMainMap.getLayer(
      MAPBOX_RUNTRIP_NAVIGATION_ARROW_LAYER_ID
    )
  ) {
    freeRunTripMapboxMainMap.moveLayer(
      MAPBOX_RUNTRIP_NAVIGATION_ARROW_LAYER_ID
    );
  }
}
function initializeMapboxRunTripActualRouteLayer() {
  if (!freeRunTripMapboxMainMap) {
    return;
  }

  if (!freeRunTripMapboxMainMap.isStyleLoaded()) {
    return;
  }

  if (
    !freeRunTripMapboxMainMap.getSource(
      MAPBOX_RUNTRIP_ACTUAL_ROUTE_SOURCE_ID
    )
  ) {
    freeRunTripMapboxMainMap.addSource(
      MAPBOX_RUNTRIP_ACTUAL_ROUTE_SOURCE_ID,
      {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'MultiLineString',
            coordinates: []
          }
        }
      }
    );
  }

  if (
    !freeRunTripMapboxMainMap.getLayer(
      MAPBOX_RUNTRIP_ACTUAL_ROUTE_LAYER_ID
    )
  ) {
    freeRunTripMapboxMainMap.addLayer({
      id:
        MAPBOX_RUNTRIP_ACTUAL_ROUTE_LAYER_ID,

      type: 'line',

      source:
        MAPBOX_RUNTRIP_ACTUAL_ROUTE_SOURCE_ID,

      layout: {
        'line-cap': 'round',
        'line-join': 'round'
      },

      paint: {
        'line-color': '#76e4d2',
        'line-width': 6,
        'line-opacity': 0.95
      }
    });
  }

  mapboxRunTripActualRouteSourceReady =
    true;

  if (
    freeRunTripMapboxMainMap.getLayer(
      MAPBOX_RUNTRIP_NAVIGATION_ARROW_LAYER_ID
    )
  ) {
    freeRunTripMapboxMainMap.moveLayer(
      MAPBOX_RUNTRIP_NAVIGATION_ARROW_LAYER_ID
    );
  }
}
function updateMapboxRunTripPlannedRoute(
  coordinates
) {
  if (!freeRunTripMapboxMainMap) {
    return;
  }

  if (!mapboxRunTripPlannedRouteSourceReady) {
    initializeMapboxRunTripPlannedRouteLayer();
  }

  if (!mapboxRunTripPlannedRouteSourceReady) {
    return;
  }

  const source =
    freeRunTripMapboxMainMap.getSource(
      MAPBOX_RUNTRIP_PLANNED_ROUTE_SOURCE_ID
    );

  if (!source) {
    return;
  }

  const mapboxCoordinates =
    Array.isArray(coordinates)
      ? coordinates
          .filter(function (point) {
            return (
              Array.isArray(point) &&
              point.length >= 2 &&
              Number.isFinite(
                Number(point[0])
              ) &&
              Number.isFinite(
                Number(point[1])
              )
            );
          })
          .map(function (point) {
            return [
              Number(point[1]),
              Number(point[0])
            ];
          })
      : [];

  source.setData({
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: mapboxCoordinates
    }
  });
}

function clearMapboxRunTripPlannedRoute() {
  updateMapboxRunTripPlannedRoute([]);
}
function updateMapboxRunTripActualRoute() {
  if (!freeRunTripMapboxMainMap) {
    return;
  }

  if (!mapboxRunTripActualRouteSourceReady) {
    initializeMapboxRunTripActualRouteLayer();
  }

  if (!mapboxRunTripActualRouteSourceReady) {
    return;
  }

  const source =
    freeRunTripMapboxMainMap.getSource(
      MAPBOX_RUNTRIP_ACTUAL_ROUTE_SOURCE_ID
    );

  if (!source) {
    return;
  }

  const mapboxSegments =
    runTripActualRouteSegments
      .filter(function (segment) {
        return (
          Array.isArray(segment) &&
          segment.length >= 2
        );
      })
      .map(function (segment) {
        return segment
          .filter(function (point) {
            return (
              Array.isArray(point) &&
              point.length >= 2 &&
              Number.isFinite(
                Number(point[0])
              ) &&
              Number.isFinite(
                Number(point[1])
              )
            );
          })
          .map(function (point) {
            return [
              Number(point[1]),
              Number(point[0])
            ];
          });
      })
      .filter(function (segment) {
        return segment.length >= 2;
      });

  source.setData({
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'MultiLineString',
      coordinates: mapboxSegments
    }
  });
}

function clearMapboxRunTripActualRoute() {
  if (
    !freeRunTripMapboxMainMap ||
    !mapboxRunTripActualRouteSourceReady
  ) {
    return;
  }

  const source =
    freeRunTripMapboxMainMap.getSource(
      MAPBOX_RUNTRIP_ACTUAL_ROUTE_SOURCE_ID
    );

  if (!source) {
    return;
  }

  source.setData({
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'MultiLineString',
      coordinates: []
    }
  });
}
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

    <button
      id="runTripDashboardFollowState"
      class="runtrip-dashboard-follow-state"
      type="button"
      aria-pressed="true"
    >
      따라가기 ON
    </button>
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
let mapboxRunTripFollowMarker = null;
let isRunTripPaused = false;
let isRunTripCountdownActive = false;
let isRunTripMapFollowing = true;
let hasRunTripArrivalNotified = false;
let isRunTripCompletionInProgress = false;
let runTripRecentPositions = [];
let runTripLastGpsTimestamp = null;
let runTripNextWaypointIndex = 0;
let runTripWaypointArrivalHits = 0;
let runTripDestinationArrivalHits = 0;
let runTripClosestDestinationDistance = Infinity;
let activeRunTripCheckpointNotice = null;
let completedRunTripRecordId = null;

const RUNTRIP_NOTICE_VISIBLE_DISTANCE_METERS = 50;
const RUNTRIP_NOTICE_DISMISS_DISTANCE_METERS = 60;
const RUNTRIP_ARRIVAL_DISTANCE_METERS = 40;
const RUNTRIP_ARRIVAL_MAX_ACCURACY_METERS = 40;
const RUNTRIP_ARRIVAL_MIN_DISTANCE_METERS = 50;
const RUNTRIP_ARRIVAL_MIN_ELAPSED_SECONDS = 120;
const RUNTRIP_WAYPOINT_ARRIVAL_DISTANCE_METERS = 35;
const RUNTRIP_WAYPOINT_REQUIRED_HITS = 2;
const RUNTRIP_DESTINATION_REQUIRED_HITS = 3;
const RUNTRIP_DIRECTION_ARROW_INTERVAL_METERS = 250;

let runTripElapsedSeconds = 0;
let runTripTimerInterval = null;

let runTripActualDistanceMeters = 0;
let runTripTotalElevationGain = 0;
let runTripTotalElevationLoss = 0;
let runTripElevationReferenceAltitude = null;
let runTripLastValidAltitude = null;
let runTripRecentAltitudeSamples = [];
let runTripCurrentSmoothedAltitude = null;
let runTripLastValidPosition = null;
let runTripStartTime = null;

let runTripActualRouteCoordinates = [];
let runTripActualRouteSegments = [];
let runTripActiveRouteSegment = null;
let runTripActualRouteLine = null;
let runTripActualRouteLines = [];
const RUNTRIP_ACTIVE_STATE_KEY =
  'freeRunTripActiveRunTripV1';

/* ========================================
   RunTrip 내비게이션 배너 · 음성 V1
   - 경로 분할: 명확한 좌회전 / 우회전만
   - 50%: 현재 회전 1차 안내
   - 75%: 현재 회전 + 다음 회전 2차 안내
======================================== */
const runTripNavigationBannerRoot = document.getElementById(
  'runTripNavigationBannerRoot'
);

const runTripNavigationPrimaryBanner = document.getElementById(
  'runTripNavigationPrimaryBanner'
);

const runTripNavigationSecondaryBanner = document.getElementById(
  'runTripNavigationSecondaryBanner'
);

const runTripNavigationPrimaryArrow = document.getElementById(
  'runTripNavigationPrimaryArrow'
);

const runTripNavigationSecondaryArrow = document.getElementById(
  'runTripNavigationSecondaryArrow'
);

const runTripNavigationPrimaryDistance = document.getElementById(
  'runTripNavigationPrimaryDistance'
);

const runTripNavigationSecondaryDistance = document.getElementById(
  'runTripNavigationSecondaryDistance'
);

let runTripNavigationRuntimeSegments = [];
let runTripNavigationRouteMetrics = null;
let runTripCurrentNavigationSegmentIndex = 0;
let runTripNavigationFirstAnnouncementDone = false;
let runTripNavigationSecondAnnouncementDone = false;
let runTripNavigationLastRouteProgressMeters = 0;
let runTripNavigationLastRouteSegmentIndex = 0;
let runTripNavigationHasJoinedRoute = false;

/*
  배너 V1 안전장치
  - RunTrip을 출발지에서 멀리 떨어진 곳에서 시작했을 때
    가장 가까운 경로 조각으로 강제 투영되어 0m 배너가 뜨는 것을 막는다.
  - 실제 예정 경로 가까이에 있고, 최초에는 경로 시작점 부근에 들어왔을 때만
    50% / 75% 진행률 안내를 활성화한다.
*/
const RUNTRIP_NAVIGATION_MAX_OFF_ROUTE_METERS = 45;
const RUNTRIP_NAVIGATION_JOIN_START_RADIUS_METERS = 120;

/*
  한국어 내비게이션 V1 - 경로 이탈 복귀 원칙
  - 예정 경로는 재탐색하지 않는다.
  - GPS 한 번 튄 것으로 오탐하지 않도록 연속 샘플로 확정한다.
  - 기본 안내는 무조건 U턴이 아니라 "원래 경로로 돌아가세요."이다.
*/
const RUNTRIP_OFF_ROUTE_TRIGGER_METERS = 20;
const RUNTRIP_OFF_ROUTE_RECOVERY_METERS = 15;
const RUNTRIP_OFF_ROUTE_REQUIRED_HITS = 3;
const RUNTRIP_ROUTE_RECOVERY_REQUIRED_HITS = 2;

let runTripOffRouteHits = 0;
let runTripRouteRecoveryHits = 0;
let runTripIsOffRoute = false;
let runTripOffRouteAnnouncementDone = false;
let runTripOffRouteBanner = null;

function getRunTripNavigationDirectionArrow(direction) {
  return direction === 'left' ? '↰' : '↱';
}

function getRunTripNavigationDirectionLabel(direction) {
  return direction === 'left' ? '좌회전' : '우회전';
}

function buildRunTripNavigationFirstMessage(
  direction,
  remainingDistanceMeters
) {
  const distance =
    getRunTripNavigationVoiceDistance(
      remainingDistanceMeters
    );

  return (
    `${distance}미터 앞에서 ` +
    `${getRunTripNavigationDirectionLabel(direction)}입니다.`
  );
}

function buildRunTripNavigationSecondMessage(
  currentDirection,
  currentRemainingDistanceMeters,
  nextSegment
) {
  const currentDistance =
    getRunTripNavigationVoiceDistance(
      currentRemainingDistanceMeters
    );

  let message =
    `${currentDistance}미터 앞에서 ` +
    `${getRunTripNavigationDirectionLabel(currentDirection)}입니다.`;

  const nextDirection =
    nextSegment?.endAction?.direction;

  if (
    nextDirection === 'left' ||
    nextDirection === 'right'
  ) {
    const nextDistance =
      getRunTripNavigationVoiceDistance(
        nextSegment.lengthMeters
      );

    message +=
      ` ${nextDistance}미터 직진 후 ` +
      `${getRunTripNavigationDirectionLabel(nextDirection)}입니다.`;
  }

  return message;
}

function ensureRunTripOffRouteBanner() {
  if (runTripOffRouteBanner) {
    return runTripOffRouteBanner;
  }

  const banner =
    document.createElement('div');

  banner.className =
    'runtrip-off-route-banner hidden';

  banner.setAttribute(
    'role',
    'alert'
  );

  banner.setAttribute(
    'aria-live',
    'assertive'
  );

  banner.style.position = 'fixed';
  banner.style.left = '50%';
  banner.style.transform = 'translateX(-50%)';
  banner.style.zIndex = '1400';
  banner.style.width = 'calc(100% - 32px)';
  banner.style.maxWidth = '398px';
  banner.style.boxSizing = 'border-box';
  banner.style.padding = '12px 14px';
  banner.style.borderRadius = '14px';
  banner.style.background = '#0f172a';
  banner.style.border = '1px solid rgba(118, 228, 210, 0.55)';
  banner.style.boxShadow = '0 8px 24px rgba(15, 23, 42, 0.24)';
  banner.style.color = '#f8fafc';
  banner.style.fontSize = '14px';
  banner.style.fontWeight = '700';
  banner.style.lineHeight = '1.45';
  banner.style.textAlign = 'center';
  banner.style.pointerEvents = 'none';

  banner.innerHTML = `
    <span
      aria-hidden="true"
      style="
        display:inline-block;
        margin-right:6px;
        color:#76e4d2;
      "
    >
      ↩
    </span>
    경로를 이탈했습니다. 원래 경로로 돌아가세요.
  `;

  document.body.appendChild(
    banner
  );

  runTripOffRouteBanner =
    banner;

  return banner;
}

function positionRunTripOffRouteBanner() {
  const banner =
    ensureRunTripOffRouteBanner();

  const executionPanel =
    document.querySelector(
      '.runtrip-following .runtrip-editor-card'
    );

  const panelBottom =
    executionPanel
      ? executionPanel.getBoundingClientRect().bottom
      : 0;

  banner.style.top =
    `${Math.max(12, Math.round(panelBottom + 10))}px`;
}

function showRunTripOffRouteBanner() {
  hideRunTripNavigationBanners();

  const banner =
    ensureRunTripOffRouteBanner();

  positionRunTripOffRouteBanner();

  banner.classList.remove(
    'hidden'
  );

  banner.style.display =
    'block';
}

function hideRunTripOffRouteBanner() {
  if (!runTripOffRouteBanner) {
    return;
  }

  runTripOffRouteBanner.classList.add(
    'hidden'
  );

  runTripOffRouteBanner.style.display =
    'none';
}

function resetRunTripOffRouteGuidance() {
  runTripOffRouteHits = 0;
  runTripRouteRecoveryHits = 0;
  runTripIsOffRoute = false;
  runTripOffRouteAnnouncementDone = false;
  hideRunTripOffRouteBanner();
}

function announceRunTripOffRoute() {
  if (runTripOffRouteAnnouncementDone) {
    return;
  }

  runTripOffRouteAnnouncementDone =
    true;

  requestRunningDynamicVoice(
    '경로를 이탈했습니다. 원래 경로로 돌아가세요.'
  );
}

function updateRunTripOffRouteGuidance(
  projection
) {
  if (!projection) {
    return false;
  }

  const distanceToRoute =
    Math.max(
      0,
      Number(
        projection.distanceToRouteMeters
      ) || 0
    );

  if (!runTripIsOffRoute) {
    if (
      distanceToRoute >=
      RUNTRIP_OFF_ROUTE_TRIGGER_METERS
    ) {
      runTripOffRouteHits++;
    } else {
      runTripOffRouteHits = 0;
    }

    if (
      runTripOffRouteHits >=
      RUNTRIP_OFF_ROUTE_REQUIRED_HITS
    ) {
      runTripIsOffRoute = true;
      runTripRouteRecoveryHits = 0;

      showRunTripOffRouteBanner();
      announceRunTripOffRoute();
    }

    return runTripIsOffRoute;
  }

  showRunTripOffRouteBanner();

  if (
    distanceToRoute <=
    RUNTRIP_OFF_ROUTE_RECOVERY_METERS
  ) {
    runTripRouteRecoveryHits++;
  } else {
    runTripRouteRecoveryHits = 0;
  }

  if (
    runTripRouteRecoveryHits >=
    RUNTRIP_ROUTE_RECOVERY_REQUIRED_HITS
  ) {
    runTripIsOffRoute = false;
    runTripOffRouteHits = 0;
    runTripRouteRecoveryHits = 0;
    runTripOffRouteAnnouncementDone = false;

    hideRunTripOffRouteBanner();
  }

  return runTripIsOffRoute;
}

function formatRunTripNavigationDistance(distanceMeters) {
  const safeDistance = Math.max(0, Number(distanceMeters) || 0);

  if (safeDistance >= 1000) {
    const kilometers = safeDistance / 1000;
    return `${kilometers.toFixed(kilometers >= 10 ? 0 : 1)}km`;
  }

  /*
    회전 직전 GPS 오차 때문에 0m가 표시되는 대신
    실제 안내가 살아 있는 동안에는 최소 5m로 표시한다.
  */
  const roundedMeters = safeDistance > 0
    ? Math.max(5, Math.round(safeDistance / 5) * 5)
    : 0;

  return `${roundedMeters}m`;
}

function getRunTripNavigationVoiceDistance(distanceMeters) {
  const safeDistance = Math.max(0, Number(distanceMeters) || 0);

  if (safeDistance <= 0) {
    return 0;
  }

  return Math.max(5, Math.round(safeDistance / 5) * 5);
}

function hideRunTripNavigationBanners() {
  if (runTripNavigationBannerRoot) {
    runTripNavigationBannerRoot.classList.add('hidden');
  }

  if (runTripNavigationPrimaryBanner) {
    runTripNavigationPrimaryBanner.classList.add('hidden');
  }

  if (runTripNavigationSecondaryBanner) {
    runTripNavigationSecondaryBanner.classList.add('hidden');
  }
}

function positionRunTripNavigationBanners() {
  if (!runTripNavigationBannerRoot) {
    return;
  }

  const executionPanel = document.querySelector(
    '.runtrip-following .runtrip-editor-card'
  );

  const panelBottom = executionPanel
    ? executionPanel.getBoundingClientRect().bottom
    : 0;

  runTripNavigationBannerRoot.style.top =
    `${Math.max(12, Math.round(panelBottom + 10))}px`;
}

function showRunTripNavigationPrimaryBanner(
  direction,
  distanceMeters
) {
  if (
    !runTripNavigationBannerRoot ||
    !runTripNavigationPrimaryBanner ||
    !runTripNavigationPrimaryArrow ||
    !runTripNavigationPrimaryDistance
  ) {
    return;
  }

  positionRunTripNavigationBanners();

  runTripNavigationPrimaryArrow.textContent =
    getRunTripNavigationDirectionArrow(direction);

  runTripNavigationPrimaryDistance.textContent =
    formatRunTripNavigationDistance(distanceMeters);

  runTripNavigationPrimaryBanner.setAttribute(
    'aria-label',
    `${formatRunTripNavigationDistance(distanceMeters)} ${getRunTripNavigationDirectionLabel(direction)}`
  );

  runTripNavigationBannerRoot.classList.remove('hidden');
  runTripNavigationPrimaryBanner.classList.remove('hidden');
}

function showRunTripNavigationSecondaryBanner(
  direction,
  distanceMeters
) {
  if (
    !runTripNavigationBannerRoot ||
    !runTripNavigationSecondaryBanner ||
    !runTripNavigationSecondaryArrow ||
    !runTripNavigationSecondaryDistance
  ) {
    return;
  }

  positionRunTripNavigationBanners();

  runTripNavigationSecondaryArrow.textContent =
    getRunTripNavigationDirectionArrow(direction);

  runTripNavigationSecondaryDistance.textContent =
    formatRunTripNavigationDistance(distanceMeters);

  runTripNavigationSecondaryBanner.setAttribute(
    'aria-label',
    `${formatRunTripNavigationDistance(distanceMeters)} 직진 후 ${getRunTripNavigationDirectionLabel(direction)}`
  );

  runTripNavigationBannerRoot.classList.remove('hidden');
  runTripNavigationSecondaryBanner.classList.remove('hidden');
}

function buildRunTripNavigationRouteMetrics(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return null;
  }

  const points = coordinates
    .filter(function (point) {
      return (
        Array.isArray(point) &&
        point.length >= 2 &&
        Number.isFinite(Number(point[0])) &&
        Number.isFinite(Number(point[1]))
      );
    })
    .map(function (point) {
      return [Number(point[0]), Number(point[1])];
    });

  if (points.length < 2) {
    return null;
  }

  const cumulativeDistances = [0];

  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1];
    const current = points[index];

    cumulativeDistances[index] =
      cumulativeDistances[index - 1] +
      calculateDistance(
        previous[0],
        previous[1],
        current[0],
        current[1]
      );
  }

  return {
    points: points,
    cumulativeDistances: cumulativeDistances,
    totalDistanceMeters: cumulativeDistances[cumulativeDistances.length - 1]
  };
}

function projectRunTripPointToRoute(
  latitude,
  longitude,
  options = {}
) {
  const metrics = runTripNavigationRouteMetrics;

  if (!metrics || metrics.points.length < 2) {
    return null;
  }

  const lat = Number(latitude);
  const lng = Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const startIndex = Math.max(
    0,
    Math.min(
      metrics.points.length - 2,
      Number.isFinite(Number(options.startIndex))
        ? Math.floor(Number(options.startIndex))
        : 0
    )
  );

  const endIndex = Math.max(
    startIndex,
    Math.min(
      metrics.points.length - 2,
      Number.isFinite(Number(options.endIndex))
        ? Math.floor(Number(options.endIndex))
        : metrics.points.length - 2
    )
  );

  const referenceLatitudeRadians = lat * Math.PI / 180;
  const metersPerDegreeLatitude = 111320;
  const metersPerDegreeLongitude =
    111320 * Math.max(0.1, Math.cos(referenceLatitudeRadians));

  let best = null;

  for (let index = startIndex; index <= endIndex; index++) {
    const first = metrics.points[index];
    const second = metrics.points[index + 1];

    const ax = (first[1] - lng) * metersPerDegreeLongitude;
    const ay = (first[0] - lat) * metersPerDegreeLatitude;
    const bx = (second[1] - lng) * metersPerDegreeLongitude;
    const by = (second[0] - lat) * metersPerDegreeLatitude;

    const abx = bx - ax;
    const aby = by - ay;
    const abLengthSquared = abx * abx + aby * aby;

    const t = abLengthSquared > 0
      ? Math.max(0, Math.min(1, -(ax * abx + ay * aby) / abLengthSquared))
      : 0;

    const projectedX = ax + abx * t;
    const projectedY = ay + aby * t;
    const distanceToRoute = Math.sqrt(
      projectedX * projectedX + projectedY * projectedY
    );

    const segmentLength =
      metrics.cumulativeDistances[index + 1] -
      metrics.cumulativeDistances[index];

    const routeDistanceMeters =
      metrics.cumulativeDistances[index] +
      segmentLength * t;

    if (
      !best ||
      distanceToRoute < best.distanceToRouteMeters
    ) {
      best = {
        routeSegmentIndex: index,
        routeDistanceMeters: routeDistanceMeters,
        distanceToRouteMeters: distanceToRoute
      };
    }
  }

  return best;
}

function buildRunTripNavigationRuntimeSegments(
  rawSegments,
  routeCoordinates
) {
  runTripNavigationRouteMetrics =
    buildRunTripNavigationRouteMetrics(routeCoordinates);

  if (
    !runTripNavigationRouteMetrics ||
    !Array.isArray(rawSegments)
  ) {
    return [];
  }

  const runtimeSegments = [];
  let previousEndDistance = 0;
  let previousRouteIndex = 0;

  rawSegments.forEach(function (segment) {
    const endLocation = segment?.endLocation;

    if (
      !Array.isArray(endLocation) ||
      endLocation.length < 2
    ) {
      return;
    }

    const projection = projectRunTripPointToRoute(
      Number(endLocation[0]),
      Number(endLocation[1]),
      {
        startIndex: Math.max(0, previousRouteIndex - 2)
      }
    );

    if (!projection) {
      return;
    }

    const endDistance = Math.max(
      previousEndDistance,
      projection.routeDistanceMeters
    );

    const lengthMeters = Math.max(
      0,
      endDistance - previousEndDistance
    );

    if (lengthMeters < 1) {
      previousRouteIndex = projection.routeSegmentIndex;
      previousEndDistance = endDistance;
      return;
    }

    runtimeSegments.push({
      index: runtimeSegments.length,
      startDistanceMeters: previousEndDistance,
      endDistanceMeters: endDistance,
      lengthMeters: lengthMeters,
      endAction: segment.endAction || null
    });

    previousRouteIndex = projection.routeSegmentIndex;
    previousEndDistance = endDistance;
  });

  return runtimeSegments;
}

function resetRunTripNavigationSegmentAnnouncements() {
  runTripNavigationFirstAnnouncementDone = false;
  runTripNavigationSecondAnnouncementDone = false;
}

function resetRunTripNavigationGuidance() {
  hideRunTripNavigationBanners();
  resetRunTripOffRouteGuidance();
  runTripNavigationRuntimeSegments = [];
  runTripNavigationRouteMetrics = null;
  runTripCurrentNavigationSegmentIndex = 0;
  runTripNavigationLastRouteProgressMeters = 0;
  runTripNavigationLastRouteSegmentIndex = 0;
  runTripNavigationHasJoinedRoute = false;
  resetRunTripNavigationSegmentAnnouncements();
}

function initializeRunTripNavigationGuidance(routeSummary) {
  resetRunTripNavigationGuidance();

  if (!routeSummary) {
    return;
  }

  runTripNavigationRuntimeSegments =
    buildRunTripNavigationRuntimeSegments(
      routeSummary.navigationSegments,
      routeSummary.coordinates
    );

  positionRunTripNavigationBanners();

  console.log(
    'FreeRunTrip 내비게이션 구간 준비:',
    runTripNavigationRuntimeSegments
  );
}

function getNextTurnNavigationSegment(currentIndex) {
  for (
    let index = currentIndex + 1;
    index < runTripNavigationRuntimeSegments.length;
    index++
  ) {
    const segment = runTripNavigationRuntimeSegments[index];
    const direction = segment?.endAction?.direction;

    if (direction === 'left' || direction === 'right') {
      return segment;
    }
  }

  return null;
}

function announceRunTripNavigationFirst(
  direction,
  remainingDistanceMeters
) {
  requestRunningDynamicVoice(
    buildRunTripNavigationFirstMessage(
      direction,
      remainingDistanceMeters
    )
  );
}

function announceRunTripNavigationSecond(
  currentDirection,
  currentRemainingDistanceMeters,
  nextSegment
) {
  requestRunningDynamicVoice(
    buildRunTripNavigationSecondMessage(
      currentDirection,
      currentRemainingDistanceMeters,
      nextSegment
    )
  );
}

function canJoinRunTripNavigationRoute(
  latitude,
  longitude,
  projection
) {
  const metrics = runTripNavigationRouteMetrics;

  if (
    !metrics ||
    !projection ||
    !Array.isArray(metrics.points) ||
    metrics.points.length === 0
  ) {
    return false;
  }

  if (
    projection.distanceToRouteMeters >
    RUNTRIP_NAVIGATION_MAX_OFF_ROUTE_METERS
  ) {
    return false;
  }

  const routeStart = metrics.points[0];

  const distanceToRouteStart = calculateDistance(
    Number(latitude),
    Number(longitude),
    Number(routeStart[0]),
    Number(routeStart[1])
  );

  return (
    Number.isFinite(distanceToRouteStart) &&
    distanceToRouteStart <=
      RUNTRIP_NAVIGATION_JOIN_START_RADIUS_METERS
  );
}

function updateRunTripNavigationGuidance(
  latitude,
  longitude
) {
  if (
    !isRunTripFollowing ||
    isRunTripPaused ||
    activeRunTripCheckpointNotice ||
    runTripNavigationRuntimeSegments.length === 0
  ) {
    if (activeRunTripCheckpointNotice) {
      hideRunTripNavigationBanners();
    }

    return;
  }

  const metrics = runTripNavigationRouteMetrics;

  if (!metrics) {
    return;
  }

  const localProjection = projectRunTripPointToRoute(
    latitude,
    longitude,
    {
      startIndex: Math.max(
        0,
        runTripNavigationLastRouteSegmentIndex - 5
      ),
      endIndex: Math.min(
        metrics.points.length - 2,
        runTripNavigationLastRouteSegmentIndex + 90
      )
    }
  );

  /*
    경로 진행률과 경로 이탈 판정을 분리한다.

    - localProjection:
      현재 진행 위치 주변의 경로만 찾아 배너/진행률 계산에 사용한다.
      루프형 RunTrip에서 가까운 다른 구간으로 진행률이 점프하는 것을 막는다.

    - globalProjection:
      화면에 보이는 전체 예정 경로를 기준으로 현재 위치와의 최단거리를 찾고
      경로 이탈 여부만 판정한다.
      사용자가 민트 예정 경로 위를 달리고 있는데도 다른 구간을 기준으로
      이탈 경고가 뜨는 문제를 방지한다.
  */
  const globalProjection =
    projectRunTripPointToRoute(
      latitude,
      longitude
    );

  let projection = localProjection;

  if (
    !projection ||
    projection.distanceToRouteMeters > 80
  ) {
    projection = globalProjection;
  }

  if (!projection || !globalProjection) {
    hideRunTripNavigationBanners();
    return;
  }

  /*
    한국어 내비게이션 V1:
    경로 이탈 여부는 반드시 전체 예정 경로(globalProjection)를 기준으로 판단한다.
    경로에서 20m 이상 벗어난 상태가 3회 연속 확인되면
    재탐색 대신 원래 예정 경로로 복귀하도록 안내한다.
    다시 15m 이내에 2회 연속 들어오면 정상 안내로 복귀한다.
  */
  if (
    updateRunTripOffRouteGuidance(
      globalProjection
    )
  ) {
    hideRunTripNavigationBanners();
    return;
  }

  /*
    경로에서 너무 멀리 떨어진 GPS는 내비게이션 진행률에 사용하지 않는다.
    오프루트 확정 전이라도 45m 이상 떨어진 샘플은 회전 진행률에서 제외한다.
  */
  if (
    projection.distanceToRouteMeters >
    RUNTRIP_NAVIGATION_MAX_OFF_ROUTE_METERS
  ) {
    hideRunTripNavigationBanners();
    return;
  }

  /*
    새 RunTrip 세션에서는 반드시 예정 경로의 시작점 부근에서 한 번
    경로에 합류한 뒤에만 진행률 추적을 시작한다.
    사용자가 선택한 출발지와 실제 현재 위치가 다른 실내 테스트에서도
    잘못된 첫 회전 배너가 뜨지 않는다.
  */
  if (!runTripNavigationHasJoinedRoute) {
    if (
      !canJoinRunTripNavigationRoute(
        latitude,
        longitude,
        projection
      )
    ) {
      hideRunTripNavigationBanners();
      return;
    }

    runTripNavigationHasJoinedRoute = true;
    runTripNavigationLastRouteProgressMeters =
      Math.max(0, projection.routeDistanceMeters);
    runTripNavigationLastRouteSegmentIndex =
      projection.routeSegmentIndex;

    console.log(
      'FreeRunTrip 내비게이션 경로 합류:',
      {
        routeProgressMeters:
          Number(projection.routeDistanceMeters.toFixed(1)),
        distanceToRouteMeters:
          Number(projection.distanceToRouteMeters.toFixed(1))
      }
    );
  }

  runTripNavigationLastRouteSegmentIndex =
    projection.routeSegmentIndex;

  const routeProgressMeters = Math.max(
    runTripNavigationLastRouteProgressMeters - 15,
    projection.routeDistanceMeters
  );

  runTripNavigationLastRouteProgressMeters = Math.max(
    runTripNavigationLastRouteProgressMeters,
    routeProgressMeters
  );

  while (
    runTripCurrentNavigationSegmentIndex <
      runTripNavigationRuntimeSegments.length - 1 &&
    routeProgressMeters >=
      runTripNavigationRuntimeSegments[
        runTripCurrentNavigationSegmentIndex
      ].endDistanceMeters + 6
  ) {
    runTripCurrentNavigationSegmentIndex++;
    resetRunTripNavigationSegmentAnnouncements();
    hideRunTripNavigationBanners();
  }

  const currentSegment =
    runTripNavigationRuntimeSegments[
      runTripCurrentNavigationSegmentIndex
    ];

  if (!currentSegment || currentSegment.lengthMeters <= 0) {
    return;
  }

  const currentDirection =
    currentSegment?.endAction?.direction;

  if (
    currentDirection !== 'left' &&
    currentDirection !== 'right'
  ) {
    hideRunTripNavigationBanners();
    return;
  }

  const segmentProgress = Math.max(
    0,
    Math.min(
      1,
      (routeProgressMeters - currentSegment.startDistanceMeters) /
        currentSegment.lengthMeters
    )
  );

  const remainingDistanceMeters = Math.max(
    0,
    currentSegment.endDistanceMeters - routeProgressMeters
  );

  if (segmentProgress < 0.5) {
    hideRunTripNavigationBanners();
    return;
  }

  showRunTripNavigationPrimaryBanner(
    currentDirection,
    remainingDistanceMeters
  );

  if (
    segmentProgress >= 0.5 &&
    !runTripNavigationFirstAnnouncementDone &&
    segmentProgress < 0.75
  ) {
    runTripNavigationFirstAnnouncementDone = true;

    announceRunTripNavigationFirst(
      currentDirection,
      remainingDistanceMeters
    );
  }

  const nextTurnSegment =
    getNextTurnNavigationSegment(
      runTripCurrentNavigationSegmentIndex
    );

  if (segmentProgress >= 0.75) {
    if (nextTurnSegment) {
      showRunTripNavigationSecondaryBanner(
        nextTurnSegment.endAction.direction,
        nextTurnSegment.lengthMeters
      );
    } else if (runTripNavigationSecondaryBanner) {
      runTripNavigationSecondaryBanner.classList.add('hidden');
    }

    if (!runTripNavigationSecondAnnouncementDone) {
      runTripNavigationFirstAnnouncementDone = true;
      runTripNavigationSecondAnnouncementDone = true;

      announceRunTripNavigationSecond(
        currentDirection,
        remainingDistanceMeters,
        nextTurnSegment
      );
    }
  } else if (runTripNavigationSecondaryBanner) {
    runTripNavigationSecondaryBanner.classList.add('hidden');
  }
}

window.addEventListener('resize', function () {
  if (isRunTripFollowing) {
    positionRunTripNavigationBanners();

    if (runTripIsOffRoute) {
      positionRunTripOffRouteBanner();
    }
  }
});


function getWeightedSmoothedRunTripPosition(
  latitude,
  longitude,
  accuracy
) {
  runTripRecentPositions.push({
    latitude: Number(latitude),
    longitude: Number(longitude),
    accuracy: Math.max(1, Number(accuracy) || MAX_ACCURACY)
  });

  if (runTripRecentPositions.length > SMOOTHING_COUNT) {
    runTripRecentPositions.shift();
  }

  let latitudeSum = 0;
  let longitudeSum = 0;
  let totalWeight = 0;

  runTripRecentPositions.forEach(function (position) {
    const weight = 1 / position.accuracy;

    latitudeSum += position.latitude * weight;
    longitudeSum += position.longitude * weight;
    totalWeight += weight;
  });

  return {
    latitude: latitudeSum / totalWeight,
    longitude: longitudeSum / totalWeight
  };
}

function resetRunTripArrivalTracking() {
  removeRunTripCheckpointNotice();
  runTripNextWaypointIndex = 0;
  runTripWaypointArrivalHits = 0;
  runTripDestinationArrivalHits = 0;
  runTripClosestDestinationDistance = Infinity;
}

function getRunTripWaypointTargets() {
  const draft = getRunTripDraft();

  return Array.isArray(draft.waypoints)
    ? draft.waypoints
        .map(function (waypoint, index) {
          return {
            index: index,
            name:
              getRunTripPlaceDisplayName(waypoint) ||
              `경유지 ${index + 1}`,
            latLng:
              getRunTripPlaceLatLng(waypoint)
          };
        })
        .filter(function (target) {
          return Array.isArray(target.latLng);
        })
    : [];
}

function getRunTripWaypointOrdinal(number) {
  const labels = [
    '첫번째',
    '두번째',
    '세번째'
  ];

  const index =
    Math.max(1, Number(number) || 1) - 1;

  return labels[index] || `${index + 1}번째`;
}

function removeRunTripCheckpointNotice() {
  if (
    activeRunTripCheckpointNotice &&
    activeRunTripCheckpointNotice.element
  ) {
    activeRunTripCheckpointNotice.element.remove();
  }

  activeRunTripCheckpointNotice = null;
}

function updateRunTripCheckpointNoticeDistance(
  latitude,
  longitude
) {
  if (
    !activeRunTripCheckpointNotice ||
    !Array.isArray(
      activeRunTripCheckpointNotice.targetLatLng
    )
  ) {
    return;
  }

  const targetLatLng =
    activeRunTripCheckpointNotice.targetLatLng;

  const distanceToNoticeTarget =
    calculateDistance(
      latitude,
      longitude,
      targetLatLng[0],
      targetLatLng[1]
    );

  activeRunTripCheckpointNotice.distanceMeters =
    distanceToNoticeTarget;

  /*
    경유지 알림은 50m 안에서 계속 유지한다.
    GPS 흔들림으로 50m 경계를 잠깐 넘는 경우 바로 닫히지 않도록
    60m를 실제 닫힘 기준으로 사용한다.
  */
  if (
    distanceToNoticeTarget >
    RUNTRIP_NOTICE_DISMISS_DISTANCE_METERS
  ) {
    removeRunTripCheckpointNotice();
  }
}

function openRunTripCheckpointCamera() {
  if (!detailCameraInput) {
    return;
  }

  pendingRunTripPhotoContext =
    getRunTripPhotoContextFromNotice();

  if (!pendingRunTripPhotoContext) {
    return;
  }

  detailCameraInput.value = '';
  detailCameraInput.click();
}

function showRunTripCheckpointNotice(options = {}) {
  removeRunTripCheckpointNotice();
  hideRunTripNavigationBanners();
  hideRunTripOffRouteBanner();

  const isWaypoint =
    options.type === 'waypoint';

  const notice =
    document.createElement('div');

  notice.className =
    isWaypoint
      ? 'runtrip-arrival-notice is-waypoint'
      : 'runtrip-arrival-notice';

  notice.setAttribute('role', 'alert');
  notice.setAttribute('aria-live', 'assertive');

  const waypointNumber =
    Math.max(1, Number(options.number) || 1);

  const title = isWaypoint
    ? `${getRunTripWaypointOrdinal(waypointNumber)} 경유지에 도착했어요.`
    : '도착지에 도착했어요.';

  const placeText =
    escapePlaceSearchText(
      options.name ||
      (isWaypoint ? '경유지' : '도착지')
    );

  notice.innerHTML = `
    <div class="runtrip-arrival-notice-icon">
      ${isWaypoint ? String(waypointNumber) : '✓'}
    </div>

    <div class="runtrip-arrival-notice-content">
      <strong>
        ${title}
      </strong>

      <span class="runtrip-arrival-notice-place">
        ${placeText}
      </span>

      <div class="runtrip-arrival-notice-actions">
        <button
          class="${
            isWaypoint
              ? 'runtrip-arrival-notice-pause'
              : 'runtrip-arrival-notice-record'
          }"
          type="button"
        >
          ${isWaypoint ? '일시정지' : '기록 확인'}
        </button>

        <button
          class="runtrip-arrival-notice-photo"
          type="button"
        >
          사진 기록 남기기
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(notice);

  activeRunTripCheckpointNotice = {
    element: notice,
    type: options.type || 'destination',
    number: isWaypoint ? waypointNumber : null,
    placeName:
      options.name ||
      (isWaypoint ? '경유지' : '도착지'),
    targetLatLng:
      Array.isArray(options.targetLatLng)
        ? options.targetLatLng.slice(0, 2)
        : null,
    distanceMeters: 0
  };

  if (isWaypoint) {
    announceRunTripWaypointArrival(
      waypointNumber
    );
  } else {
    announceRunTripDestinationThenEnd();
  }

  const pauseNoticeButton =
    notice.querySelector(
      '.runtrip-arrival-notice-pause'
    );

  const recordNoticeButton =
    notice.querySelector(
      '.runtrip-arrival-notice-record'
    );

  const photoNoticeButton =
    notice.querySelector(
      '.runtrip-arrival-notice-photo'
    );

  if (pauseNoticeButton) {
    pauseNoticeButton.addEventListener(
      'click',
      function () {
        if (
          !isRunTripFollowing ||
          isRunTripPaused
        ) {
          return;
        }

        pauseRunTripBtn.click();
      }
    );
  }

  if (recordNoticeButton) {
    recordNoticeButton.addEventListener(
      'click',
      function () {
        openCompletedRunTripRecord();
      }
    );
  }

  if (photoNoticeButton) {
    photoNoticeButton.addEventListener(
      'click',
      function () {
        openRunTripCheckpointCamera();
      }
    );
  }

  if (navigator.vibrate) {
    navigator.vibrate(
      isWaypoint
        ? [120, 70, 120]
        : [180, 80, 180]
    );
  }
}

function checkRunTripWaypointArrival(
  latitude,
  longitude,
  accuracy
) {
  if (
    !isRunTripFollowing ||
    isRunTripPaused ||
    accuracy > RUNTRIP_ARRIVAL_MAX_ACCURACY_METERS
  ) {
    return;
  }

  const targets =
    getRunTripWaypointTargets();

  if (
    runTripNextWaypointIndex >=
    targets.length
  ) {
    return;
  }

  const target =
    targets[runTripNextWaypointIndex];

  const distanceToWaypoint =
    calculateDistance(
      latitude,
      longitude,
      target.latLng[0],
      target.latLng[1]
    );

  if (
    distanceToWaypoint <=
    RUNTRIP_WAYPOINT_ARRIVAL_DISTANCE_METERS
  ) {
    runTripWaypointArrivalHits++;
  } else {
    runTripWaypointArrivalHits = 0;
  }

  if (
    runTripWaypointArrivalHits <
    RUNTRIP_WAYPOINT_REQUIRED_HITS
  ) {
    return;
  }

  showRunTripCheckpointNotice({
    type: 'waypoint',
    number: runTripNextWaypointIndex + 1,
    name: target.name,
    targetLatLng: target.latLng
  });

  runTripNextWaypointIndex++;
  runTripWaypointArrivalHits = 0;
  saveActiveRunTripState();
}

function cloneRunTripRouteSegments(
  segments
) {
  if (!Array.isArray(segments)) {
    return [];
  }

  return segments
    .filter(function (segment) {
      return Array.isArray(segment);
    })
    .map(function (segment) {
      return segment
        .filter(function (point) {
          return (
            Array.isArray(point) &&
            point.length >= 2 &&
            Number.isFinite(
              Number(point[0])
            ) &&
            Number.isFinite(
              Number(point[1])
            )
          );
        })
        .map(function (point) {
          return [
            Number(point[0]),
            Number(point[1])
          ];
        });
    });
}

function createRunTripRecoveryState() {
  if (
    !isRunTripFollowing ||
    !runTripStartTime ||
    !latestRunTripRouteSummary
  ) {
    return null;
  }

  const draft = getRunTripDraft();

  return {
    version: 1,

    savedAt:
      new Date().toISOString(),

    startTime:
      runTripStartTime.toISOString(),

    elapsedSeconds:
      Math.max(
        0,
        Number(
          runTripElapsedSeconds
        ) || 0
      ),

    actualDistanceMeters:
      Math.max(
        0,
        Number(
          runTripActualDistanceMeters
        ) || 0
      ),

    isPaused:
      Boolean(
        isRunTripPaused
     ),

    arrivalNotified:
       Boolean(
        hasRunTripArrivalNotified
      ),

    nextWaypointIndex:
      Math.max(
        0,
        Number(
          runTripNextWaypointIndex
        ) || 0
      ),

    photoIds:
      activeRunTripPhotoIds.slice(),

    navigationState: {
      currentSegmentIndex:
        Math.max(
          0,
          Number(runTripCurrentNavigationSegmentIndex) || 0
        ),

      lastRouteProgressMeters:
        Math.max(
          0,
          Number(runTripNavigationLastRouteProgressMeters) || 0
        ),

      lastRouteSegmentIndex:
        Math.max(
          0,
          Number(runTripNavigationLastRouteSegmentIndex) || 0
        ),

      firstAnnouncementDone:
        Boolean(runTripNavigationFirstAnnouncementDone),

      secondAnnouncementDone:
        Boolean(runTripNavigationSecondAnnouncementDone)
    },

    actualRouteCoordinates:
      runTripActualRouteCoordinates
        .filter(function (point) {
          return (
            Array.isArray(point) &&
            point.length >= 2
          );
        })
        .map(function (point) {
          return [
            Number(point[0]),
            Number(point[1])
          ];
        }),

    actualRouteSegments:
      cloneRunTripRouteSegments(
        runTripActualRouteSegments
      ),

    plannedRouteSummary: {
      distanceKm:
        Number(
          latestRunTripRouteSummary
            .distanceKm
        ) || 0,

      durationMinutes:
        Number(
          latestRunTripRouteSummary
            .durationMinutes
        ) || 0,

      coordinates:
        Array.isArray(
          latestRunTripRouteSummary
            .coordinates
        )
          ? latestRunTripRouteSummary
              .coordinates
              .map(function (point) {
                return [
                  Number(point[0]),
                  Number(point[1])
                ];
              })
          : [],

      provider:
        latestRunTripRouteSummary.provider ||
        'mapbox',

      navigationSegments:
        Array.isArray(
          latestRunTripRouteSummary.navigationSegments
        )
          ? latestRunTripRouteSummary.navigationSegments.map(
              function (segment) {
                return JSON.parse(JSON.stringify(segment));
              }
            )
          : []
    },

    draft: {
      origin:
        createRunTripPlaceRecord(
          draft.origin
        ),

      destination:
        createRunTripPlaceRecord(
          draft.destination
        ),

      waypoints:
        draft.waypoints
          .map(function (
            waypoint
          ) {
            return (
              createRunTripPlaceRecord(
                waypoint
              )
            );
          })
          .filter(Boolean),

      returnToStart:
        Boolean(
          draft.returnToStart
        )
    }
  };
}

function saveActiveRunTripState() {
  const recoveryState =
    createRunTripRecoveryState();

  if (!recoveryState) {
    return;
  }

  try {
    localStorage.setItem(
      RUNTRIP_ACTIVE_STATE_KEY,
      JSON.stringify(
        recoveryState
      )
    );

    console.log(
      'RunTrip 실행 상태 저장:',
      recoveryState.savedAt
    );
  } catch (error) {
    console.error(
      'RunTrip 실행 상태 저장 실패:',
      error
    );
  }
}

function loadActiveRunTripState() {
  const savedState =
    localStorage.getItem(
      RUNTRIP_ACTIVE_STATE_KEY
    );

  if (!savedState) {
    return null;
  }

  try {
    const parsedState =
      JSON.parse(savedState);

    if (
      !parsedState ||
      parsedState.version !== 1 ||
      !parsedState.startTime ||
      !parsedState.draft ||
      !parsedState
        .plannedRouteSummary
    ) {
      throw new Error(
        '저장 데이터 형식이 올바르지 않습니다.'
      );
    }

    return parsedState;
  } catch (error) {
    console.error(
      'RunTrip 복구 데이터 읽기 실패:',
      error
    );

    localStorage.removeItem(
      RUNTRIP_ACTIVE_STATE_KEY
    );

    return null;
  }
}

function clearActiveRunTripState() {
  localStorage.removeItem(
    RUNTRIP_ACTIVE_STATE_KEY
  );

  console.log(
    'RunTrip 실행 상태 삭제'
  );
}
function restoreActiveRunTripState(
  savedState
) {
  if (
    !savedState ||
    !savedState.draft ||
    !savedState
      .plannedRouteSummary
  ) {
    return false;
  }

  const savedDraft =
    savedState.draft;

  const plannedSummary =
    savedState
      .plannedRouteSummary;

  const plannedCoordinates =
    Array.isArray(
      plannedSummary.coordinates
    )
      ? plannedSummary.coordinates
          .filter(function (point) {
            return (
              Array.isArray(point) &&
              point.length >= 2 &&
              Number.isFinite(
                Number(point[0])
              ) &&
              Number.isFinite(
                Number(point[1])
              )
            );
          })
          .map(function (point) {
            return [
              Number(point[0]),
              Number(point[1])
            ];
          })
      : [];

  const restoredStartTime =
    new Date(
      savedState.startTime
    );

  if (
    Number.isNaN(
      restoredStartTime.getTime()
    ) ||
    plannedCoordinates.length < 2 ||
    !savedDraft.origin ||
    !savedDraft.destination
  ) {
    return false;
  }

  selectedRunTripOrigin =
    savedDraft.origin;

  selectedRunTripDestination =
    savedDraft.destination;

  runTripOriginInput.value =
    getRunTripPlaceDisplayName(
      selectedRunTripOrigin
    );

  runTripDestinationInput.value =
    getRunTripPlaceDisplayName(
      selectedRunTripDestination
    );

  runTripWaypoints
    .querySelectorAll(
      '.runtrip-waypoint-row'
    )
    .forEach(function (row) {
      row.remove();
    });

  runTripWaypointCount = 0;

  const recoveredWaypoints =
    Array.isArray(
      savedDraft.waypoints
    )
      ? savedDraft.waypoints
      : [];

  recoveredWaypoints
    .slice(
      0,
      MAX_RUNTRIP_WAYPOINTS
    )
    .forEach(function (waypoint) {
      addRunTripWaypoint(
        waypoint,
        false
      );
    });

  runTripReturnToggle.checked =
    Boolean(
      savedDraft.returnToStart
    );

  if (runTripReturnToggle.checked) {
    selectedRunTripDestination =
      selectedRunTripOrigin;

    runTripDestinationInput.value =
      getRunTripPlaceDisplayName(
        selectedRunTripOrigin
      );

    isRunTripDestinationAutoSetFromOrigin = true;
  } else {
    isRunTripDestinationAutoSetFromOrigin = false;
  }

  const restoredBounds =
    L.latLngBounds(
      plannedCoordinates
    );

  latestRunTripRouteSummary = {
    distanceKm:
      Math.max(
        0,
        Number(
          plannedSummary.distanceKm
        ) || 0
      ),

    durationMinutes:
      Math.max(
        0,
        Number(
          plannedSummary
            .durationMinutes
        ) || 0
      ),

    coordinates:
      plannedCoordinates,

    provider:
      plannedSummary.provider ||
      'mapbox',

    navigationSegments:
      Array.isArray(
        plannedSummary.navigationSegments
      )
        ? plannedSummary.navigationSegments.map(
            function (segment) {
              return JSON.parse(JSON.stringify(segment));
            }
          )
        : [],

    bounds:
      restoredBounds
  };

  runTripStartTime =
    restoredStartTime;

  runTripElapsedSeconds =
    Math.max(
      0,
      Math.floor(
        Number(
          savedState
            .elapsedSeconds
        ) || 0
      )
    );

  runTripActualDistanceMeters =
    Math.max(
      0,
      Number(
        savedState
          .actualDistanceMeters
      ) || 0
    );

  runTripActualRouteCoordinates =
    Array.isArray(
      savedState
        .actualRouteCoordinates
    )
      ? savedState
          .actualRouteCoordinates
          .filter(function (
            point
          ) {
            return (
              Array.isArray(point) &&
              point.length >= 2 &&
              Number.isFinite(
                Number(point[0])
              ) &&
              Number.isFinite(
                Number(point[1])
              )
            );
          })
          .map(function (point) {
            return [
              Number(point[0]),
              Number(point[1])
            ];
          })
      : [];

  runTripActualRouteSegments =
    cloneRunTripRouteSegments(
      savedState
        .actualRouteSegments
    );

  runTripActiveRouteSegment =
    null;

  isRunTripFollowing = true;

  /*
    안전을 위해 복구 직후에는
    자동 측정을 시작하지 않고
    일시정지 상태로 연다.
  */
  isRunTripPaused = true;

  /*
    복구 직후에는 도착 감지를 다시 활성화한다.
    도착 직전 페이지가 닫힌 경우에도 다음 GPS에서
    자동 종료를 다시 시도할 수 있도록 한다.
  */
  hasRunTripArrivalNotified = false;
  isRunTripCompletionInProgress = false;
  isRunTripMapFollowing = true;
  runTripNextWaypointIndex = Math.max(
    0,
    Number(savedState.nextWaypointIndex) || 0
  );
  runTripWaypointArrivalHits = 0;
  runTripDestinationArrivalHits = 0;
  runTripClosestDestinationDistance = Infinity;
  activeRunTripPhotoIds =
    Array.isArray(savedState.photoIds)
      ? savedState.photoIds.slice()
      : [];
  runTripRecentPositions = [];
  runTripLastGpsTimestamp = null;

 runTripLastValidPosition =
   null;

  clearRunTripMapPreview();

  L.polyline(
    plannedCoordinates,
    {
      color: '#76e4d2',
      weight: 6,
      opacity: 0.95,
      dashArray: '1 12',
      lineCap: 'round',
      lineJoin: 'round'
    }
  ).addTo(
    runTripPreviewLayer
  );
   updateMapboxRunTripPlannedRoute(
      plannedCoordinates
   );
  const restoredDraft =
    getRunTripDraft();

  const restoredMarkers = [];

  const originPoint =
    getRunTripPlaceLatLng(
      restoredDraft.origin
    );

  const restoredDestinationPoint =
    getRunTripPlaceLatLng(
      restoredDraft.destination
    );

  const restoredReturnToStart =
    restoredDraft.returnToStart === true &&
    isSameRunTripLatLng(
      originPoint,
      restoredDestinationPoint
    );

  if (originPoint) {
    restoredMarkers.push({
      label: 'S',
      type: 'start',
      latLng: originPoint,
      horizontalOffset:
        restoredReturnToStart ? -19 : 0
    });
  }

  restoredDraft.waypoints
    .forEach(function (
      waypoint,
      index
    ) {
      const waypointPoint =
        getRunTripPlaceLatLng(
          waypoint
        );

      if (!waypointPoint) {
        return;
      }

      restoredMarkers.push({
        label:
          String(index + 1),

        type:
          'waypoint',

        latLng:
          waypointPoint
      });
    });

  const destinationPoint =
    restoredDestinationPoint;

  if (destinationPoint) {
    restoredMarkers.push({
      label: 'D',
      type: 'destination',
      latLng:
        destinationPoint,
      horizontalOffset:
        restoredReturnToStart ? 19 : 0
    });
  }

  restoredMarkers.forEach(
  function (marker) {
    L.marker(
      marker.latLng,
      {
        icon:
          createRunTripPreviewMarkerIcon(
            marker.label,
            marker.type,
            marker.horizontalOffset || 0
          ),

        interactive: false
      }
    ).addTo(
      runTripPreviewLayer
    );

    createMapboxRunTripPreviewMarker(
      marker.label,
      marker.type,
      marker.latLng,
      marker.horizontalOffset || 0
    );
  }
);

  const restoredActualSegments =
  runTripActualRouteSegments
    .filter(function (segment) {
      return (
        Array.isArray(segment) &&
        segment.length >= 2
      );
    });

if (
  restoredActualSegments.length === 0 &&
  runTripActualRouteCoordinates.length >= 2
) {
  restoredActualSegments.push(
    runTripActualRouteCoordinates
  );
}

restoredActualSegments.forEach(
  function (segment) {
    L.polyline(
      segment,
      {
        color: '#76e4d2',
        weight: 6,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      }
    ).addTo(
      runTripPreviewLayer
    );
  }
);

updateMapboxRunTripActualRoute();

  initializeRunTripNavigationGuidance(
    latestRunTripRouteSummary
  );

  if (savedState.navigationState) {
    runTripCurrentNavigationSegmentIndex =
      Math.max(
        0,
        Math.min(
          runTripNavigationRuntimeSegments.length - 1,
          Number(savedState.navigationState.currentSegmentIndex) || 0
        )
      );

    runTripNavigationLastRouteProgressMeters =
      Math.max(
        0,
        Number(savedState.navigationState.lastRouteProgressMeters) || 0
      );

    runTripNavigationLastRouteSegmentIndex =
      Math.max(
        0,
        Number(savedState.navigationState.lastRouteSegmentIndex) || 0
      );

    runTripNavigationFirstAnnouncementDone =
      Boolean(savedState.navigationState.firstAnnouncementDone);

    runTripNavigationSecondAnnouncementDone =
      Boolean(savedState.navigationState.secondAnnouncementDone);
  }

  isRunTripConfirmed = true;

currentAppPage = 'runtrip';

updateBottomNavigationActiveState(
  'runtrip'
);

runTripPanel.classList.add(
  'runtrip-confirmed',
  'runtrip-following'
);

setMapboxRunTripNavigationAppearance(true);

  runTripConfirmedSummary.classList.add(
    'hidden'
  );

  runTripDashboard.classList.remove(
    'hidden'
  );

  map.getContainer().style.display =
  'none';

const mapboxMainContainer =
  document.getElementById('mapboxMainMap');

if (mapboxMainContainer) {
  mapboxMainContainer.style.display =
    'block';
}

if (freeRunTripMapboxMainMap) {
  requestAnimationFrame(function () {
    freeRunTripMapboxMainMap.resize();
  });
}

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

  if (appBottomNavigation) {
    appBottomNavigation.classList.add(
      'hidden'
    );
  }

  updateRunTripFollowButton();
  updateRunTripDashboard();
  updateRunTripCreateButton();

  requestAnimationFrame(
    function () {
      map.invalidateSize({
        pan: false
      });

      fitRunTripMapBounds(
        restoredBounds
      );
    }
  );

  saveActiveRunTripState();

  return true;
}
window.addEventListener(
  'pagehide',
  function () {
    if (isRunTripFollowing) {
      saveActiveRunTripState();
    }
  }
);

document.addEventListener(
  'visibilitychange',
  function () {
    if (
      document.visibilityState ===
        'hidden' &&
      isRunTripFollowing
    ) {
      saveActiveRunTripState();
    }
  }
);
function beginNewRunTripRouteSegment() {
  runTripActiveRouteSegment = [];
  runTripActualRouteLine = null;

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

  if (!runTripActualRouteLine) {
    runTripActualRouteLine =
      L.polyline(
        runTripActiveRouteSegment,
        {
          color: '#76e4d2',
          weight: 6,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round'
        }
      ).addTo(
        runTripPreviewLayer
      );

    runTripActualRouteLines.push(
      runTripActualRouteLine
    );
  } else {
    runTripActualRouteLine.setLatLngs(
      runTripActiveRouteSegment
    );
  }

    updateMapboxRunTripActualRoute();
}


function showActivityCountdown(activityLabel) {
  if (isRunTripCountdownActive) {
    return Promise.resolve(false);
  }

  isRunTripCountdownActive = true;

  return new Promise(function (resolve) {
    const overlay = document.createElement('div');
    overlay.className = 'runtrip-countdown-overlay';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'assertive');
    overlay.innerHTML = `
      <div class="runtrip-countdown-card">
        <span>${escapePlaceSearchText(activityLabel)}</span>
        <strong>3</strong>
        <small>출발 준비</small>
      </div>
    `;

    document.body.appendChild(overlay);
    const numberElement = overlay.querySelector('strong');
    const guideElement = overlay.querySelector('small');
    let count = 3;

    const intervalId = setInterval(function () {
      count--;
      if (count > 0) {
        numberElement.textContent = String(count);
        numberElement.classList.remove('is-popping');
        void numberElement.offsetWidth;
        numberElement.classList.add('is-popping');
        return;
      }

      clearInterval(intervalId);
      numberElement.textContent = 'GO';
      guideElement.textContent = '출발!';
      overlay.classList.add('is-start');

      setTimeout(function () {
        overlay.remove();
        isRunTripCountdownActive = false;
        resolve(true);
      }, 650);
    }, 1000);
  });
}

function showRunTripCountdown() {
  return showActivityCountdown('RUNTRIP');
}

function showLegacyRunTripCountdown() {
  if (isRunTripCountdownActive) {
    return Promise.resolve(false);
  }

  isRunTripCountdownActive = true;

  return new Promise(function (resolve) {
    const overlay =
      document.createElement('div');

    overlay.className =
      'runtrip-countdown-overlay';

    overlay.setAttribute(
      'role',
      'status'
    );

    overlay.setAttribute(
      'aria-live',
      'assertive'
    );

    overlay.innerHTML = `
      <div class="runtrip-countdown-card">
        <span>RUNTRIP</span>

        <strong>3</strong>

        <small>출발 준비</small>
      </div>
    `;

    document.body.appendChild(
      overlay
    );

    const numberElement =
      overlay.querySelector('strong');

    const guideElement =
      overlay.querySelector('small');

    let count = 3;

    const intervalId =
      setInterval(function () {
        count--;

        if (count > 0) {
          numberElement.textContent =
            String(count);

          numberElement.classList.remove(
            'is-popping'
          );

          void numberElement.offsetWidth;

          numberElement.classList.add(
            'is-popping'
          );

          return;
        }

        clearInterval(intervalId);

        numberElement.textContent =
          'GO';

        guideElement.textContent =
          '출발!';

        overlay.classList.add(
          'is-start'
        );

        setTimeout(function () {
          overlay.remove();

          isRunTripCountdownActive =
            false;

          resolve(true);
        }, 650);
      }, 1000);
  });
}
function getRunTripArrivalTargetLatLng() {
  const draft = getRunTripDraft();

  return getRunTripPlaceLatLng(
    draft.destination
  );
}

function showRunTripArrivalNotice() {
  const draft = getRunTripDraft();

  showRunTripCheckpointNotice({
    type: 'destination',
    name:
      getRunTripPlaceDisplayName(
        draft.destination
      ) || '도착지',
    targetLatLng:
      getRunTripArrivalTargetLatLng()
  });
}

function checkRunTripArrival(
  latitude,
  longitude,
  accuracy
) {
  if (
    hasRunTripArrivalNotified ||
    isRunTripCompletionInProgress ||
    !isRunTripFollowing ||
    isRunTripPaused ||
    accuracy >
      RUNTRIP_ARRIVAL_MAX_ACCURACY_METERS
  ) {
    return;
  }

  const hasEnoughMovement =
    runTripActualDistanceMeters >=
    RUNTRIP_ARRIVAL_MIN_DISTANCE_METERS;

  const hasEnoughElapsedTime =
    runTripElapsedSeconds >=
    RUNTRIP_ARRIVAL_MIN_ELAPSED_SECONDS;

  if (
    !hasEnoughMovement &&
    !hasEnoughElapsedTime
  ) {
    return;
  }

  const waypointTargets =
    getRunTripWaypointTargets();

  if (
    runTripNextWaypointIndex <
    waypointTargets.length
  ) {
    return;
  }

  const target =
    getRunTripArrivalTargetLatLng();

  if (!target) {
    return;
  }

  const distanceToTarget =
    calculateDistance(
      latitude,
      longitude,
      target[0],
      target[1]
    );

  runTripClosestDestinationDistance =
    Math.min(
      runTripClosestDestinationDistance,
      distanceToTarget
    );

  if (
    distanceToTarget <=
    RUNTRIP_ARRIVAL_DISTANCE_METERS
  ) {
    runTripDestinationArrivalHits++;
  } else {
    /*
      목적지 반경에 잠깐 들어온 좌표 하나만으로 종료하지 않는다.
      다만 25m 이내까지 접근한 뒤 GPS가 조금 벗어난 경우에는
      연속 감지값을 완전히 초기화하지 않아 지나침을 보완한다.
    */
    if (
      runTripClosestDestinationDistance <= 25 &&
      distanceToTarget <= 55
    ) {
      runTripDestinationArrivalHits =
        Math.max(
          1,
          runTripDestinationArrivalHits
        );
    } else {
      runTripDestinationArrivalHits = 0;
    }
  }

  if (
    runTripDestinationArrivalHits <
    RUNTRIP_DESTINATION_REQUIRED_HITS
  ) {
    return;
  }

  hasRunTripArrivalNotified = true;

  showRunTripArrivalNotice();

  /*
    도착이 확정된 순간 기록을 즉시 저장하고 측정을 종료한다.
    기록 상세 화면으로 자동 이동하지 않고 마지막 지도 화면을 유지한다.
  */
  completeRunTrip({
    arrived: true
  });
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
function updateRunTripElevation(position) {
  const altitudeData = getAltitudeData(position);

  const smoothedAltitude = addAltitudeSample(
    runTripRecentAltitudeSamples,
    altitudeData.altitude,
    altitudeData.altitudeAccuracy
  );

  if (!Number.isFinite(smoothedAltitude)) {
    return null;
  }

  const state = updateElevationAccumulator(
    smoothedAltitude,
    {
      referenceAltitude: runTripElevationReferenceAltitude,
      lastAltitude: runTripLastValidAltitude,
      gain: runTripTotalElevationGain,
      loss: runTripTotalElevationLoss
    }
  );

  runTripElevationReferenceAltitude = state.referenceAltitude;
  runTripLastValidAltitude = state.lastAltitude;
  runTripTotalElevationGain = state.gain;
  runTripTotalElevationLoss = state.loss;
  runTripCurrentSmoothedAltitude = smoothedAltitude;

  return smoothedAltitude;
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
  `${Math.round(runTripTotalElevationGain)} m`;

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
      : isRunTripMapFollowing
        ? '따라가기 ON'
        : '따라가기 OFF';

  runTripDashboardFollowState.setAttribute(
    'aria-pressed',
    String(
      isRunTripMapFollowing &&
      !isRunTripPaused
    )
  );

  runTripDashboardFollowState.disabled =
    isRunTripPaused;

  runTripDashboardFollowState.classList.toggle(
    'is-paused',
    isRunTripPaused
  );

  runTripDashboardFollowState.classList.toggle(
    'is-off',
    !isRunTripPaused &&
    !isRunTripMapFollowing
  );

  pauseRunTripBtn.textContent =
    isRunTripPaused
      ? '다시 시작'
      : '일시정지';
}

function resetRunTripDashboard() {
  hideRunTripNavigationBanners();

  clearInterval(
    runTripTimerInterval
  );

  runTripTimerInterval = null;

  runTripElapsedSeconds = 0;
  runTripActualDistanceMeters = 0;
  runTripTotalElevationGain = 0;
  runTripTotalElevationLoss = 0;
  runTripElevationReferenceAltitude = null;
  runTripLastValidAltitude = null;
  runTripRecentAltitudeSamples = [];
  runTripCurrentSmoothedAltitude = null;

  runTripLastValidPosition = null;
  runTripRecentPositions = [];
  runTripLastGpsTimestamp = null;

  isRunTripPaused = false;
  isRunTripMapFollowing = true;

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

      if (
       runTripElapsedSeconds % 5 === 0
      ) {
        saveActiveRunTripState();
     }
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

  cancelFreeRunTripVoiceGuidance();
  resetRunTripNavigationGuidance();

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

  setMapboxRunTripNavigationAppearance(false);

  if (runTripFollowMarker) {
    map.removeLayer(
      runTripFollowMarker
    );

    runTripFollowMarker = null;
  }
  if (mapboxRunTripFollowMarker) {
  mapboxRunTripFollowMarker.remove();

  mapboxRunTripFollowMarker = null;
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

        const gpsTimestamp =
          Number(position.timestamp) ||
          Date.now();

        if (accuracy > MAX_ACCURACY) {
          const altitudeData = getAltitudeData(position);

          addGpsDiagnostic(runTripGpsDiagnosticLog, {
            accepted: false,
            reason: 'low-accuracy',
            latitude: Number(latitude.toFixed(7)),
            longitude: Number(longitude.toFixed(7)),
            accuracy: Number(accuracy.toFixed(1)),
            altitude: altitudeData.altitude,
            altitudeAccuracy: altitudeData.altitudeAccuracy,
            totalDistanceMeters: Number(runTripActualDistanceMeters.toFixed(2))
          });

          runTripDashboardGps.textContent =
            `GPS 정확도 확인 중 · ${Math.round(
              accuracy
            )}m`;

          return;
        }

        const smoothedPosition =
          getWeightedSmoothedRunTripPosition(
            latitude,
            longitude,
            accuracy
          );

        const currentPosition = {
          latitude:
            smoothedPosition.latitude,
          longitude:
            smoothedPosition.longitude,
          timestamp:
            gpsTimestamp,
          accuracy:
            accuracy
        };

        let shouldAcceptPoint = true;

        if (runTripLastValidPosition) {
          const distanceFromLast =
            calculateDistance(
              runTripLastValidPosition.latitude,
              runTripLastValidPosition.longitude,
              currentPosition.latitude,
              currentPosition.longitude
            );

          const minimumAcceptedDistance =
            getMinimumAcceptedDistance(
              accuracy,
              runTripLastValidPosition.accuracy
            );

          if (
            isGpsSampleTooSoon(
              runTripLastValidPosition.timestamp,
              gpsTimestamp
            )
          ) {
            shouldAcceptPoint = false;

            addGpsDiagnostic(runTripGpsDiagnosticLog, {
              accepted: false,
              reason: 'sample-too-soon',
              accuracy: Math.round(accuracy),
              distanceMeters: Number(distanceFromLast.toFixed(2))
            });
          }

          if (
            shouldAcceptPoint &&
            distanceFromLast <
            minimumAcceptedDistance
          ) {
            shouldAcceptPoint = false;

            addGpsDiagnostic(runTripGpsDiagnosticLog, {
              accepted: false,
              reason: 'below-distance-threshold',
              accuracy: Math.round(accuracy),
              previousAccuracy: Math.round(runTripLastValidPosition.accuracy || accuracy),
              distanceMeters: Number(distanceFromLast.toFixed(2)),
              minimumMeters: Number(minimumAcceptedDistance.toFixed(2))
            });
          }

          if (
            shouldAcceptPoint &&
            isImplausibleRunningJump(
              distanceFromLast,
              runTripLastValidPosition.timestamp,
              gpsTimestamp
            )
          ) {
            shouldAcceptPoint = false;

            runTripRecentPositions = [
              {
                latitude: latitude,
                longitude: longitude,
                accuracy:
                  Math.max(1, accuracy)
              }
            ];

            addGpsDiagnostic(runTripGpsDiagnosticLog, {
              accepted: false,
              reason: 'implausible-speed',
              accuracy: Math.round(accuracy),
              distanceMeters: Number(distanceFromLast.toFixed(2))
            });
          }

          if (shouldAcceptPoint) {
            const calibratedDistance =
              getCalibratedGpsDistance(
                distanceFromLast
              );

            const timing = getGpsSampleTiming(
              runTripLastValidPosition.timestamp,
              gpsTimestamp
            );

            const speedMetersPerSecond = getGpsSpeedMetersPerSecond(
              distanceFromLast,
              runTripLastValidPosition.timestamp,
              gpsTimestamp
            );

            runTripActualDistanceMeters +=
              calibratedDistance;

            const smoothedAltitude = updateRunTripElevation(position);
            const altitudeData = getAltitudeData(position);

            addGpsDiagnostic(runTripGpsDiagnosticLog, {
              accepted: true,
              reason: 'distance-added',
              latitude: Number(latitude.toFixed(7)),
              longitude: Number(longitude.toFixed(7)),
              smoothedLatitude: Number(currentPosition.latitude.toFixed(7)),
              smoothedLongitude: Number(currentPosition.longitude.toFixed(7)),
              accuracy: Number(accuracy.toFixed(1)),
              previousAccuracy: Number((runTripLastValidPosition.accuracy || accuracy).toFixed(1)),
              altitude: altitudeData.altitude,
              altitudeAccuracy: altitudeData.altitudeAccuracy,
              smoothedAltitude:
                Number.isFinite(smoothedAltitude)
                  ? Number(smoothedAltitude.toFixed(2))
                  : null,
              elapsedMs: timing.elapsedMs,
              rawDistanceMeters: Number(distanceFromLast.toFixed(2)),
              speedMetersPerSecond:
                Number.isFinite(speedMetersPerSecond)
                  ? Number(speedMetersPerSecond.toFixed(2))
                  : null,
              calibratedDistanceMeters: Number(calibratedDistance.toFixed(2)),
              reflectedDistanceMeters: Number(calibratedDistance.toFixed(2)),
              calibrationFactor: GPS_DISTANCE_CALIBRATION_FACTOR,
              elevationGainMeters: Number(runTripTotalElevationGain.toFixed(2)),
              elevationLossMeters: Number(runTripTotalElevationLoss.toFixed(2)),
              totalDistanceMeters: Number(runTripActualDistanceMeters.toFixed(2))
            });
          }
        }

        /*
          도착 감지는 거리 측정용 GPS 필터와 분리한다.
          경유지/도착지 근처에서 사용자가 속도를 줄이거나 멈추면
          좌표 간 이동거리가 짧아 거리 계산에서는 제외될 수 있다.
          하지만 정확도가 허용 범위 안인 GPS 샘플이라면
          도착 판정에는 계속 사용해 체크포인트를 놓치지 않게 한다.
        */
        updateRunTripCheckpointNoticeDistance(
          currentPosition.latitude,
          currentPosition.longitude
        );

        checkRunTripWaypointArrival(
          currentPosition.latitude,
          currentPosition.longitude,
          accuracy
        );

        checkRunTripArrival(
          currentPosition.latitude,
          currentPosition.longitude,
          accuracy
        );

        updateRunTripNavigationGuidance(
          currentPosition.latitude,
          currentPosition.longitude
        );

        if (
          !runTripLastValidPosition ||
          shouldAcceptPoint
        ) {
          if (!runTripLastValidPosition) {
            const initialAltitude = updateRunTripElevation(position);
            const altitudeData = getAltitudeData(position);

            addGpsDiagnostic(runTripGpsDiagnosticLog, {
              accepted: true,
              reason: 'initial-position',
              latitude: Number(latitude.toFixed(7)),
              longitude: Number(longitude.toFixed(7)),
              smoothedLatitude: Number(currentPosition.latitude.toFixed(7)),
              smoothedLongitude: Number(currentPosition.longitude.toFixed(7)),
              accuracy: Number(accuracy.toFixed(1)),
              altitude: altitudeData.altitude,
              altitudeAccuracy: altitudeData.altitudeAccuracy,
              smoothedAltitude:
                Number.isFinite(initialAltitude)
                  ? Number(initialAltitude.toFixed(2))
                  : null,
              reflectedDistanceMeters: 0,
              totalDistanceMeters: Number(runTripActualDistanceMeters.toFixed(2))
            });
          }

          runTripLastValidPosition =
            currentPosition;

          runTripLastGpsTimestamp =
            gpsTimestamp;

          const acceptedLatLng = [
            currentPosition.latitude,
            currentPosition.longitude
          ];

          appendRunTripRoutePoint(
            acceptedLatLng
          );

          if (!runTripFollowMarker) {
            runTripFollowMarker =
              L.marker(
                acceptedLatLng,
                {
                  icon:
                    createRunTripFollowMarkerIcon(),

                  zIndexOffset: 1000
                }
              ).addTo(map);
           } else {
  runTripFollowMarker.setLatLng(
    acceptedLatLng
  );
}

updateMapboxRunTripFollowMarker(
  acceptedLatLng
);

if (isRunTripMapFollowing) {
  centerRunTripMapOnPosition(
    acceptedLatLng,
    {
      animate: false
    }
  );

  centerMapboxRunTripMapOnPosition(
    acceptedLatLng,
    {
      animate: false
    }
  );
}
        }

        updateRunTripDashboard();
        saveActiveRunTripState();
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
        maximumAge: 0
      }
    );
}

async function startRunTripFollowing() {
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

  const countdownCompleted =
    await showRunTripCountdown();

  if (!countdownCompleted) {
    return;
  }

  announceRunTripStart();

  resetRunTripDashboard();

  runTripStartTime = new Date();

  runTripActualRouteCoordinates = [];
  runTripActualRouteSegments = [];
  runTripActiveRouteSegment = null;
  runTripActualRouteLine = null;
  runTripActualRouteLines = [];

  clearMapboxRunTripActualRoute();

  hasRunTripArrivalNotified = false;
  isRunTripCompletionInProgress = false;
  isRunTripMapFollowing = true;
  runTripRecentPositions = [];
  runTripLastGpsTimestamp = null;
  runTripTotalElevationGain = 0;
  runTripTotalElevationLoss = 0;
  runTripElevationReferenceAltitude = null;
  runTripLastValidAltitude = null;
  runTripRecentAltitudeSamples = [];
  runTripCurrentSmoothedAltitude = null;
  runTripGpsDiagnosticLog = [];
  activeRunTripPhotoIds = [];
  pendingRunTripPhotoContext = null;
  completedRunTripRecordId = null;
  runTripPanel.classList.remove('runtrip-arrived');
  resetRunTripArrivalTracking();
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

  setMapboxRunTripNavigationAppearance(true);

  initializeRunTripNavigationGuidance(
    latestRunTripRouteSummary
  );

  runTripDashboard.classList.remove(
    'hidden'
  );

  updateRunTripFollowButton();
  updateRunTripDashboard();

  startRunTripTimer();
  startRunTripLocationWatch();

  saveActiveRunTripState();
}
function saveRunTripRecord() {
  if (!runTripStartTime) {
    return null;
  }

  const runTripEndTime = new Date();

  addGpsDiagnostic(runTripGpsDiagnosticLog, {
    accepted: true,
    reason: 'record-save',
    displayedDistance: runTripDashboardDistance.textContent,
    savedDistance: (runTripActualDistanceMeters / 1000).toFixed(2),
    totalDistanceMeters: Number(runTripActualDistanceMeters.toFixed(2)),
    elapsedSeconds: runTripElapsedSeconds
  });

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

    elevationGain: Math.round(runTripTotalElevationGain),
    elevationLoss: Math.round(runTripTotalElevationLoss),
    heartRate: null,
    cadence: null,
    gpsAccuracy: null,

pace:
      formatPaceFromSeconds(
        runTripElapsedSeconds,
        runTripActualDistanceMeters
      ),

    emotionalPace:
      'RunTrip Journey',

    originName:
      getRunTripSavedOriginName(
        draft.origin
      ),

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

plannedNavigationSegments:
  latestRunTripRouteSummary &&
  Array.isArray(latestRunTripRouteSummary.navigationSegments)
    ? latestRunTripRouteSummary.navigationSegments.map(
        function (segment) {
          return JSON.parse(JSON.stringify(segment));
        }
      )
    : [],

routeProvider:
  latestRunTripRouteSummary?.provider ||
  'mapbox',

    photoIds:
      activeRunTripPhotoIds.slice(),

    photo: '',

    memo: ''
  };

  record.gpsDiagnostics =
    getGpsDiagnosticsForRecord(
      runTripGpsDiagnosticLog
    );

record.gpsDiagnosticSummary = {
  sampleCount:
    runTripGpsDiagnosticLog.length,

  acceptedCount:
    runTripGpsDiagnosticLog.filter(
      function (entry) {
        return entry.accepted === true;
      }
    ).length,

  rejectedCount:
    runTripGpsDiagnosticLog.filter(
      function (entry) {
        return entry.accepted === false;
      }
    ).length
};

  const nextRunRecords = [
    record,
    ...runRecords
  ];

  const persistResult =
    persistRunRecordsSafely(
      nextRunRecords
    );

  if (!persistResult.success) {
    return null;
  }

  runRecords = persistResult.records;

  if (persistResult.compacted) {
    console.warn(
      '저장 공간 확보를 위해 기존 기록의 GPS 진단 로그를 정리했습니다.'
    );
  }

  renderRunRecords();
  renderRecordProfileFeed();
  renderMonthlyReport();

  if (record.photoIds.length > 0) {
    updateRunTripPhotoRecordIds(
      record.photoIds,
      record.id
    ).catch(function (error) {
      console.error(
        'RunTrip 사진과 기록 연결 실패:',
        error
      );
    });
  }

  console.log(
    '저장된 RunTrip 기록:',
    record
  );

  return record;
}

function resetRunTripDraftState() {
  selectedRunTripOrigin = null;
  selectedRunTripDestination = null;

  runTripOriginInput.value = '현재 위치';
  runTripDestinationInput.value = '';
  runTripReturnToggle.checked = false;
  isRunTripDestinationAutoSetFromOrigin = false;

  runTripWaypoints
    .querySelectorAll('.runtrip-waypoint-row')
    .forEach(function (row) {
      row.remove();
    });

  runTripWaypointCount = 0;
  refreshRunTripWaypointLabels();

  hidePlaceSearchResults(
    runTripOriginSearchResults
  );

  hidePlaceSearchResults(
    runTripDestinationSearchResults
  );

  runTripSearchRequestId++;
  clearTimeout(runTripSearchTimer);
  runTripSearchResults.innerHTML = '';
  runTripSearchInput.value = '';
  runTripSearchGuide.textContent =
    '장소명 또는 주소를 입력해 검색해 보세요.';
  runTripSearchScreen.classList.add('hidden');
  activeRunTripSearchTarget = null;

  isRunTripConfirmed = false;
  latestRunTripRouteSummary = null;

  runTripPanel.classList.remove(
    'runtrip-confirmed',
    'runtrip-following'
  );

  setMapboxRunTripNavigationAppearance(false);

  runTripConfirmedSummary.classList.add(
    'hidden'
  );

  createRunTripBtn.textContent = '확인';

  clearRunTripVisualState();
  updateRunTripCreateButton();
  updateRunTripWaypointControls();
}

function freezeRunTripAtArrival(savedRecord) {
  clearInterval(runTripTimerInterval);
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

  /*
    도착 후에는 지도와 마지막 경로/마커는 그대로 두고
    시간, 거리, GPS 경로 추가만 완전히 멈춘다.
  */
  isRunTripFollowing = false;
  isRunTripPaused = true;
  isRunTripMapFollowing = false;
  runTripActiveRouteSegment = null;
  runTripActualRouteLine = null;

  completedRunTripRecordId =
    savedRecord
      ? Number(savedRecord.id)
      : null;

  runTripPanel.classList.add(
    'runtrip-arrived'
  );

  updateRunTripDashboard();

  runTripDashboardGps.textContent =
    '기록 완료';

  runTripDashboardFollowState.textContent =
    '도착 완료';

  runTripDashboardFollowState.disabled = true;
  runTripDashboardFollowState.classList.add(
    'is-paused'
  );
}

function resetCompletedRunTripAfterArrival() {
  removeRunTripCheckpointNotice();

  runTripPanel.classList.remove(
    'runtrip-arrived'
  );

  stopRunTripFollowing({
    restoreRoute: false
  });

  clearRunTripVisualState();
  runTripRouteRequestId++;
  resetRunTripDraftState();

  runTripStartTime = null;
  runTripActualRouteCoordinates = [];
  runTripActualRouteSegments = [];
  runTripActiveRouteSegment = null;
  runTripActualRouteLine = null;
  runTripActualRouteLines = [];
  hasRunTripArrivalNotified = false;
  isRunTripMapFollowing = true;
  runTripRecentPositions = [];
  runTripLastGpsTimestamp = null;
  activeRunTripPhotoIds = [];
  pendingRunTripPhotoContext = null;
  resetRunTripArrivalTracking();
}

function openCompletedRunTripRecord() {
  const recordId =
    Number(completedRunTripRecordId);

  if (!Number.isFinite(recordId)) {
    return;
  }

  resetCompletedRunTripAfterArrival();

  selectedRecordFilter = 'all';

  recordsFilterTabs.forEach(
    function (tab) {
      const isActive =
        tab.dataset.recordFilter === 'all';

      tab.classList.toggle(
        'active',
        isActive
      );

      tab.setAttribute(
        'aria-selected',
        String(isActive)
      );
    }
  );

  openAppPage('records');

  const savedRecordCard =
    recordsList.querySelector(
      `[data-record-id="${recordId}"]`
    );

  if (savedRecordCard) {
    savedRecordCard.click();
  } else {
    window.scrollTo({
      top: 0,
      behavior: 'auto'
    });
  }

  completedRunTripRecordId = null;
}

function completeRunTrip(
  options = {}
) {
  if (
    isRunTripCompletionInProgress ||
    !isRunTripFollowing ||
    !runTripStartTime
  ) {
    return null;
  }

  isRunTripCompletionInProgress = true;

  /*
    Safari localStorage 용량 안정화:
    진행 중 RunTrip 복구 데이터에는 예정 경로/내비게이션/실제 경로가
    포함되어 있어 장거리 RunTrip 종료 시 새 기록과 동시에 저장되면
    동일한 대용량 경로 데이터가 잠깐 중복될 수 있다.

    종료 직전 복구 데이터를 문자열로 보관한 뒤 localStorage에서 잠시
    제거하고 기록 저장을 시도한다. 저장에 실패하면 복구 데이터를
    원상 복원해 사용자의 진행 기록을 잃지 않도록 한다.
  */
  let activeRunTripRecoveryBackup = null;

  try {
    activeRunTripRecoveryBackup =
      localStorage.getItem(
        RUNTRIP_ACTIVE_STATE_KEY
      );

    if (
      activeRunTripRecoveryBackup !== null
    ) {
      localStorage.removeItem(
        RUNTRIP_ACTIVE_STATE_KEY
      );
    }
  } catch (error) {
    console.warn(
      'RunTrip 종료 전 복구 데이터 임시 정리 실패:',
      error
    );
  }

  const savedRecord =
    saveRunTripRecord();

  if (!savedRecord) {
    if (
      activeRunTripRecoveryBackup !== null
    ) {
      try {
        localStorage.setItem(
          RUNTRIP_ACTIVE_STATE_KEY,
          activeRunTripRecoveryBackup
        );
      } catch (restoreError) {
        console.error(
          'RunTrip 저장 실패 후 복구 데이터 복원 실패:',
          restoreError
        );
      }
    }

    isRunTripCompletionInProgress = false;

    alert(
      'RUNTRIP 기록을 저장하지 못했어요. 기록은 그대로 유지하고 있으니 다시 종료해 주세요.'
    );

    return null;
  }

  clearActiveRunTripState();

  if (options.arrived === true) {
    freezeRunTripAtArrival(
      savedRecord
    );

    isRunTripCompletionInProgress = false;

    return savedRecord;
  }

  removeRunTripCheckpointNotice();

  stopRunTripFollowing({
    restoreRoute: false
  });

  clearRunTripVisualState();
  runTripRouteRequestId++;
  resetRunTripDraftState();

  runTripStartTime = null;
  runTripActualRouteCoordinates = [];
  runTripActualRouteSegments = [];
  runTripActiveRouteSegment = null;
  runTripActualRouteLine = null;
  runTripActualRouteLines = [];
  hasRunTripArrivalNotified = false;
  isRunTripMapFollowing = true;
  runTripRecentPositions = [];
  runTripLastGpsTimestamp = null;
  activeRunTripPhotoIds = [];
  pendingRunTripPhotoContext = null;
  resetRunTripArrivalTracking();

  setTimeout(function () {
    selectedRecordFilter = 'all';

    recordsFilterTabs.forEach(
      function (tab) {
        const isActive =
          tab.dataset.recordFilter === 'all';

        tab.classList.toggle(
          'active',
          isActive
        );

        tab.setAttribute(
          'aria-selected',
          String(isActive)
        );
      }
    );

    openAppPage('records');

    const savedRecordCard =
      recordsList.querySelector(
        `[data-record-id="${savedRecord.id}"]`
      );

    if (savedRecordCard) {
      savedRecordCard.click();
    } else {
      window.scrollTo({
        top: 0,
        behavior: 'auto'
      });
    }

    isRunTripCompletionInProgress =
      false;
  }, 0);

  return savedRecord;
}

function detectPlaceSearchLanguage(query) {
  const text = String(query || '').trim();

  if (!text) {
    return 'en';
  }

  // Korean
  if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(text)) {
    return 'ko';
  }

  // Japanese Hiragana / Katakana
  if (/[\u3040-\u30FF]/.test(text)) {
    return 'ja';
  }

  // Japanese place names written mainly with Kanji
  if (
    /[\u4E00-\u9FFF]/.test(text) &&
    /(駅|公園|神社|寺|城|橋|通り|丁目|空港|大学|病院|美術館|博物館)/.test(text)
  ) {
    return 'ja';
  }

  // German-specific characters or common place-name words
  if (
    /[äöüßÄÖÜ]/.test(text) ||
    /\b(tor|platz|strasse|straße|bahnhof|hauptbahnhof|schloss|kirche|rathaus|flughafen)\b/i.test(
      text
    )
  ) {
    return 'de';
  }

  // Latin alphabet defaults to English until app-level language selection exists.
  return 'en';
}

function getPlaceSearchUrl(query) {
  const baseUrl =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
      ? 'https://freeruntrip.vercel.app/api/place-search'
      : '/api/place-search';

  const language = detectPlaceSearchLanguage(query);

  return (
    `${baseUrl}?q=${encodeURIComponent(query)}` +
    `&language=${encodeURIComponent(language)}`
  );
}


function getReverseGeocodeUrl(
  latitude,
  longitude
) {
  const baseUrl =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
      ? 'https://freeruntrip.vercel.app/api/place-search'
      : '/api/place-search';

  return (
    `${baseUrl}?lat=${encodeURIComponent(latitude)}` +
    `&lng=${encodeURIComponent(longitude)}`
  );
}

async function reverseGeocodeRunTripOrigin(
  latitude,
  longitude
) {
  try {
    const response = await fetch(
      getReverseGeocodeUrl(
        latitude,
        longitude
      )
    );

    const data = await response.json();

    if (
      !response.ok ||
      !data.place
    ) {
      return null;
    }

    return data.place;
  } catch (error) {
    console.error(
      '현재 위치 주소 조회 실패:',
      error
    );

    return null;
  }
}

function getRunTripCurrentLocationAddress(place) {
  if (!place) {
    return '';
  }

  return (
    place.roadAddress ||
    place.lotAddress ||
    place.address ||
    place.primaryText ||
    place.displayName ||
    place.name ||
    ''
  );
}

function createRunTripCurrentLocationPlace(
  place,
  latitude,
  longitude
) {
  const actualAddress =
    getRunTripCurrentLocationAddress(
      place
    );

  if (place && actualAddress) {
    return {
      ...place,

      type: 'current-location',

      isCurrentLocation:
        true,

      displayName:
        actualAddress,

      primaryText:
        actualAddress,

      secondaryText:
        place.buildingName ||
        place.name ||
        place.secondaryText ||
        '',

      latitude:
        Number(latitude),

      longitude:
        Number(longitude)
    };
  }

  return {
    type: 'current-location',
    isCurrentLocation: true,
    name: '현재 위치',
    displayName: '현재 위치',
    primaryText: '현재 위치',
    secondaryText: '',
    address: '',
    roadAddress: '',
    lotAddress: '',
    latitude: Number(latitude),
    longitude: Number(longitude)
  };
}

function getRunTripSavedOriginName(place) {
  if (!place) {
    return '출발지';
  }

  if (
    place.isCurrentLocation === true ||
    place.type === 'current-location'
  ) {
    return (
      getRunTripCurrentLocationAddress(
        place
      ) ||
      getRunTripPlaceDisplayName(
        place
      ) ||
      '현재 위치'
    );
  }

  return (
    getRunTripPlaceDisplayName(
      place
    ) ||
    '출발지'
  );
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

function getRunTripPlaceEnglishAddress(place) {
  if (!place) {
    return '';
  }

  const englishAddress =
    String(
      place.englishAddress || ''
    ).trim();

  if (!englishAddress) {
    return '';
  }

  const localizedAddress =
    String(
      getRunTripPlaceSecondaryText(
        place
      ) || ''
    ).trim();

  const normalizeForComparison =
    function (value) {
      return String(value || '')
        .normalize('NFKC')
        .toLocaleLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
    };

  if (
    normalizeForComparison(
      englishAddress
    ) ===
    normalizeForComparison(
      localizedAddress
    )
  ) {
    return '';
  }

  return englishAddress;
}

function getRunTripPlaceLanguageLabel(place) {
  const language =
    String(
      place?.language || ''
    )
      .trim()
      .toLowerCase();

  if (language.startsWith('ko')) {
    return '한국어';
  }

  if (language.startsWith('ja')) {
    return '日本語';
  }

  if (language.startsWith('de')) {
    return 'DE';
  }

  if (language.startsWith('en')) {
    return 'EN';
  }

  return '';
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
      <span
        class="runtrip-place-search-address"
        style="display:block;"
      >
        ${
          getRunTripPlaceLanguageLabel(place)
            ? `
              <small
                style="
                  display:inline-block;
                  margin-right:7px;
                  font-size:0.72em;
                  font-weight:700;
                  letter-spacing:0.02em;
                  color:#94A3B8;
                  vertical-align:0.05em;
                "
              >
                ${escapePlaceSearchText(
                  getRunTripPlaceLanguageLabel(place)
                )}
              </small>
            `
            : ''
        }
        ${escapePlaceSearchText(
          getRunTripPlaceSecondaryText(place)
        )}
      </span>
    `
    : ''
}

${
  getRunTripPlaceEnglishAddress(place)
    ? `
      <span
        class="runtrip-place-search-address runtrip-place-search-english-address"
        style="
          display:block;
          margin-top:4px;
          color:#7F8DA3;
          font-size:0.94em;
        "
      >
        <small
          style="
            display:inline-block;
            margin-right:7px;
            font-size:0.72em;
            font-weight:700;
            letter-spacing:0.05em;
            color:#94A3B8;
            vertical-align:0.05em;
          "
        >
          EN
        </small>
        ${escapePlaceSearchText(
          getRunTripPlaceEnglishAddress(place)
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
        pendingRunTripPreviewFocusLatLng =
          getRunTripPlaceLatLng(
            selectedPlace
          );

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

  map.getContainer().style.display =
  'none';

const mapboxMainContainer =
  document.getElementById('mapboxMainMap');

if (mapboxMainContainer) {
  mapboxMainContainer.style.display =
    'block';
}

if (freeRunTripMapboxMainMap) {
  requestAnimationFrame(function () {
    freeRunTripMapboxMainMap.resize();

    requestAnimationFrame(function () {
      restoreRunTripPreviewCameraAfterSearch();
    });
  });
}

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

  const mapboxMainContainer =
  document.getElementById('mapboxMainMap');

  if (mapboxMainContainer) {
    mapboxMainContainer.style.display =
     'none';
  }
  
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

  if (runTripReturnToggle.checked) {
    syncRunTripReturnDestination();
  }

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
  isRunTripDestinationAutoSetFromOrigin = false;

  if (runTripReturnToggle.checked) {
    runTripReturnToggle.checked = false;
  }

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

  if (runTripReturnToggle.checked) {
    syncRunTripReturnDestination();
  }

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
function addRunTripWaypoint(
  recoveredPlace = null,
  shouldOpenSearch = true
) {
  if (
    runTripWaypointCount >=
    MAX_RUNTRIP_WAYPOINTS
  ) {
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

if (recoveredPlace) {
  waypointInput.runTripPlace =
    recoveredPlace;

  waypointInput.value =
    getRunTripPlaceDisplayName(
      recoveredPlace
    );
}

refreshRunTripWaypointLabels();
updateRunTripCreateButton();

if (shouldOpenSearch) {
  waypointInput.click();
}
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
function isSameRunTripLatLng(
  firstLatLng,
  secondLatLng
) {
  if (
    !Array.isArray(firstLatLng) ||
    firstLatLng.length < 2 ||
    !Array.isArray(secondLatLng) ||
    secondLatLng.length < 2
  ) {
    return false;
  }

  const latitudeDifference =
    Math.abs(
      Number(firstLatLng[0]) -
      Number(secondLatLng[0])
    );

  const longitudeDifference =
    Math.abs(
      Number(firstLatLng[1]) -
      Number(secondLatLng[1])
    );

  return (
    Number.isFinite(latitudeDifference) &&
    Number.isFinite(longitudeDifference) &&
    latitudeDifference < 0.0000001 &&
    longitudeDifference < 0.0000001
  );
}

function syncRunTripReturnDestination() {
  if (!runTripReturnToggle.checked) {
    if (isRunTripDestinationAutoSetFromOrigin) {
      selectedRunTripDestination = null;
      runTripDestinationInput.value = '';
      isRunTripDestinationAutoSetFromOrigin = false;
    }

    updateRunTripCreateButton();
    return;
  }

  if (!selectedRunTripOrigin) {
    selectedRunTripDestination = null;
    runTripDestinationInput.value = '';
    isRunTripDestinationAutoSetFromOrigin = false;

    updateRunTripCreateButton();
    return;
  }

  selectedRunTripDestination =
    selectedRunTripOrigin;

  runTripDestinationInput.value =
    getRunTripPlaceDisplayName(
      selectedRunTripOrigin
    );

  isRunTripDestinationAutoSetFromOrigin = true;

  updateRunTripCreateButton();
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

    englishAddress:
      String(
        place.englishAddress || ''
      ).trim(),

    englishDisplayName:
      String(
        place.englishDisplayName || ''
      ).trim(),

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

    isCurrentLocation:
      place.isCurrentLocation === true ||
      place.type === 'current-location',

    latitude:
      Number(latLng[0]),

    longitude:
      Number(latLng[1])
  };
}
function createRunTripPreviewMarkerIcon(
  label,
  type,
  horizontalOffset = 0
) {
  return L.divIcon({
    className: `runtrip-preview-marker ${type}`,
    html: `
      <div class="runtrip-preview-marker-body">
        <span>${escapePlaceSearchText(label)}</span>
      </div>
      <div class="runtrip-preview-marker-tip"></div>
    `,
    iconSize: [42, 50],
    iconAnchor: [
      21 - Number(horizontalOffset || 0),
      48
    ]
  });
}
function createMapboxRunTripPreviewMarker(
  label,
  type,
  latLng,
  horizontalOffset = 0
) {
  if (
    !freeRunTripMapboxMainMap ||
    !Array.isArray(latLng) ||
    latLng.length < 2
  ) {
    return null;
  }

  const latitude =
    Number(latLng[0]);

  const longitude =
    Number(latLng[1]);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  const markerElement =
    document.createElement('div');

  markerElement.className =
    `runtrip-preview-marker ${type}`;

  markerElement.innerHTML = `
    <div class="runtrip-preview-marker-body">
      <span>
        ${escapePlaceSearchText(label)}
      </span>
    </div>

    <div
      class="runtrip-preview-marker-tip"
    ></div>
  `;

  const marker =
    new mapboxgl.Marker({
      element: markerElement,
      anchor: 'bottom',
      offset: [
        Number(horizontalOffset || 0),
        0
      ]
    })
      .setLngLat([
        longitude,
        latitude
      ])
      .addTo(
        freeRunTripMapboxMainMap
      );

  mapboxRunTripPreviewMarkers.push(
    marker
  );

  return marker;
}

function clearMapboxRunTripPreviewMarkers() {
  mapboxRunTripPreviewMarkers.forEach(
    function (marker) {
      marker.remove();
    }
  );

  mapboxRunTripPreviewMarkers = [];
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
function updateMapboxRunTripFollowMarker(
  latLng
) {
  if (
    !freeRunTripMapboxMainMap ||
    !Array.isArray(latLng) ||
    latLng.length < 2
  ) {
    return;
  }

  const latitude =
    Number(latLng[0]);

  const longitude =
    Number(latLng[1]);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return;
  }

  const lngLat = [
    longitude,
    latitude
  ];

  if (!mapboxRunTripFollowMarker) {
    const markerElement =
      document.createElement('div');

    markerElement.className =
      'runtrip-follow-marker';

    markerElement.innerHTML = `
      <div class="runtrip-follow-marker-pulse">
        <span></span>
      </div>
    `;

    mapboxRunTripFollowMarker =
      new mapboxgl.Marker({
        element: markerElement,
        anchor: 'center'
      })
        .setLngLat(lngLat)
        .addTo(
          freeRunTripMapboxMainMap
        );

    return;
  }

  mapboxRunTripFollowMarker.setLngLat(
    lngLat
  );
}
function clearRunTripMapPreview() {
  runTripPreviewLayer.clearLayers();
}

function clearRunTripVisualState() {
  /* RunTrip에서 만든 모든 지도 요소를 한 번에 정리한다.
     취소·종료·다른 탭 이동 시 같은 함수를 사용해
     일반 러닝 지도에 예정/실제 경로가 남는 것을 방지한다. */
  clearRunTripMapPreview();

  clearMapboxRunTripPlannedRoute();
  clearMapboxRunTripActualRoute();
  clearMapboxRunTripPreviewMarkers();

  runTripActualRouteLines.forEach(function (line) {
    if (line && map.hasLayer(line)) {
      map.removeLayer(line);
    }
  });

  runTripActualRouteLines = [];
  runTripActualRouteLine = null;

  if (runTripFollowMarker) {
    if (map.hasLayer(runTripFollowMarker)) {
      map.removeLayer(runTripFollowMarker);
    }

    runTripFollowMarker = null;
  }
  if (mapboxRunTripFollowMarker) {
  mapboxRunTripFollowMarker.remove();

  mapboxRunTripFollowMarker = null;
}
}
function getRunTripPreviewVisibleMapGeometry() {
  if (!freeRunTripMapboxMainMap) {
    return null;
  }

  const mapboxContainer =
    freeRunTripMapboxMainMap.getContainer();

  if (!mapboxContainer) {
    return null;
  }

  const mapRect =
    mapboxContainer.getBoundingClientRect();

  if (
    !Number.isFinite(mapRect.width) ||
    !Number.isFinite(mapRect.height) ||
    mapRect.width <= 0 ||
    mapRect.height <= 0
  ) {
    return null;
  }

  let visibleTop = mapRect.top;
  let visibleBottom = mapRect.bottom;

  if (
    runTripEditorCard &&
    !runTripEditorCard.classList.contains('hidden')
  ) {
    const editorRect =
      runTripEditorCard.getBoundingClientRect();

    if (
      editorRect.bottom > mapRect.top &&
      editorRect.top < mapRect.bottom
    ) {
      visibleTop = Math.min(
        mapRect.bottom,
        Math.max(
          mapRect.top,
          editorRect.bottom + 12
        )
      );
    }
  }

  if (
    appBottomNavigation &&
    !appBottomNavigation.classList.contains('hidden')
  ) {
    const navigationRect =
      appBottomNavigation.getBoundingClientRect();

    if (
      navigationRect.bottom > mapRect.top &&
      navigationRect.top < mapRect.bottom
    ) {
      visibleBottom = Math.max(
        mapRect.top,
        Math.min(
          mapRect.bottom,
          navigationRect.top - 12
        )
      );
    }
  }

  if (visibleBottom <= visibleTop) {
    return null;
  }

  const fullCenterY =
    (mapRect.top + mapRect.bottom) / 2;

  const visibleCenterY =
    (visibleTop + visibleBottom) / 2;

  return {
    mapRect: mapRect,
    visibleTop: visibleTop,
    visibleBottom: visibleBottom,
    verticalOffset:
      Math.round(
        visibleCenterY - fullCenterY
      ),
    topPadding:
      Math.max(
        24,
        Math.round(
          visibleTop - mapRect.top + 24
        )
      ),
    bottomPadding:
      Math.max(
        24,
        Math.round(
          mapRect.bottom - visibleBottom + 24
        )
      )
  };
}

function centerRunTripPreviewMapOnPlace(
  latLng,
  options = {}
) {
  if (
    !freeRunTripMapboxMainMap ||
    !Array.isArray(latLng) ||
    latLng.length < 2
  ) {
    return false;
  }

  const latitude = Number(latLng[0]);
  const longitude = Number(latLng[1]);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return false;
  }

  freeRunTripMapboxMainMap.resize();

  const geometry =
    getRunTripPreviewVisibleMapGeometry();

  if (!geometry) {
    return false;
  }

  const currentZoom =
    Number(freeRunTripMapboxMainMap.getZoom());

  const targetZoom =
    Number.isFinite(Number(options.zoom))
      ? Number(options.zoom)
      : Math.max(
          15,
          Math.min(
            16,
            Number.isFinite(currentZoom)
              ? currentZoom
              : 15
          )
        );

  freeRunTripMapboxMainMap.easeTo({
    center: [
      longitude,
      latitude
    ],
    zoom: targetZoom,
    offset: [
      0,
      geometry.verticalOffset
    ],
    duration:
      options.animate === true
        ? 350
        : 0
  });

  return true;
}

function restoreRunTripPreviewCameraAfterSearch() {
  if (!freeRunTripMapboxMainMap) {
    pendingRunTripPreviewFocusLatLng = null;
    return;
  }

  freeRunTripMapboxMainMap.resize();

  /*
    검색창은 Mapbox 컨테이너를 display:none 상태로 만든다.
    그 상태에서 실행된 fitBounds/easeTo는 iPhone Safari에서
    이전 손가락 이동 카메라를 그대로 남길 수 있다.

    검색 화면이 닫혀 실제 지도 크기가 복구된 다음 카메라를 다시
    적용해, 사용자가 지도를 움직였더라도 다음 장소 선택 시 항상
    새 장소/새 경로로 이동하도록 한다.
  */
  if (
    latestRunTripRouteSummary &&
    latestRunTripRouteSummary.bounds
  ) {
    fitRunTripMapBounds(
      latestRunTripRouteSummary.bounds
    );

    pendingRunTripPreviewFocusLatLng = null;
    return;
  }

  if (pendingRunTripPreviewFocusLatLng) {
    centerRunTripPreviewMapOnPlace(
      pendingRunTripPreviewFocusLatLng,
      {
        animate: false
      }
    );
  }

  pendingRunTripPreviewFocusLatLng = null;
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

  if (!freeRunTripMapboxMainMap) {
    return;
  }

  freeRunTripMapboxMainMap.resize();

  const southWest =
    bounds.getSouthWest();

  const northEast =
    bounds.getNorthEast();

  if (
    !southWest ||
    !northEast
  ) {
    return;
  }

  const visibleGeometry =
    getRunTripPreviewVisibleMapGeometry();

  /*
    검색 화면에서 Mapbox가 display:none이면 실제 크기가 0이므로
    여기서 억지로 fitBounds하지 않는다. 검색 화면이 닫힐 때
    restoreRunTripPreviewCameraAfterSearch()가 다시 적용한다.
  */
  if (!visibleGeometry) {
    return;
  }

  const horizontalPadding = 36;

  freeRunTripMapboxMainMap.fitBounds(
    [
      [
        southWest.lng,
        southWest.lat
      ],

      [
        northEast.lng,
        northEast.lat
      ]
    ],
    {
      padding: {
        top:
          visibleGeometry.topPadding,

        bottom:
          visibleGeometry.bottomPadding,

        left:
          horizontalPadding,

        right:
          horizontalPadding
      },

      maxZoom: 16,

      duration: 500
    }
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
  clearMapboxRunTripPlannedRoute();
  clearMapboxRunTripPreviewMarkers();

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

  const isReturnToStartRoute =
    draft.returnToStart === true &&
    isSameRunTripLatLng(
      originLatLng,
      destinationLatLng
    );

  if (originLatLng) {
    const originMarker =
      previewMarkers.find(function (marker) {
        return marker.type === 'start';
      });

    if (originMarker) {
      originMarker.horizontalOffset =
        isReturnToStartRoute ? -19 : 0;
    }
  }

  if (destinationLatLng) {
    previewMarkers.push({
      label: 'D',
      type: 'destination',
      latLng: destinationLatLng,
      horizontalOffset:
        isReturnToStartRoute ? 19 : 0
    });
  }

  if (previewMarkers.length === 0) {
    return;
  }

  previewMarkers.forEach(function (marker) {
    L.marker(marker.latLng, {
      icon: createRunTripPreviewMarkerIcon(
        marker.label,
        marker.type,
        marker.horizontalOffset || 0
      ),
      interactive: false
    }).addTo(runTripPreviewLayer);

    createMapboxRunTripPreviewMarker(
      marker.label,
      marker.type,
      marker.latLng,
      marker.horizontalOffset || 0
    );
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

    if (routeCoordinates.length < 2) {
      throw new Error(
        '실제 보행 경로 좌표를 찾지 못했어요.'
      );
    }

    clearRunTripMapPreview();
    clearMapboxRunTripPreviewMarkers();

    L.polyline(routeCoordinates, {
      color: '#76e4d2',
      weight: 6,
      opacity: 0.95,
      dashArray: '1 12',
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(runTripPreviewLayer);
    updateMapboxRunTripPlannedRoute(
  routeCoordinates
);

    previewMarkers.forEach(function (marker) {
      L.marker(marker.latLng, {
        icon: createRunTripPreviewMarkerIcon(
          marker.label,
          marker.type,
          marker.horizontalOffset || 0
        ),
        interactive: false
      }).addTo(runTripPreviewLayer);

      createMapboxRunTripPreviewMarker(
        marker.label,
        marker.type,
        marker.latLng,
        marker.horizontalOffset || 0
      );
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
  provider:
    outwardRoute.provider ||
    'mapbox',
  navigationSegments:
    Array.isArray(outwardRoute.navigationSegments)
      ? outwardRoute.navigationSegments
      : [],
  steps:
    Array.isArray(outwardRoute.steps)
      ? outwardRoute.steps
      : [],
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

    if (fallbackPath.length >= 2) {
      L.polyline(fallbackPath, {
        color: '#76e4d2',
        weight: 6,
        opacity: 0.8,
        dashArray: '1 12',
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
  map.getContainer().style.display = 'none';

const mapboxMainContainer =
  document.getElementById('mapboxMainMap');

if (mapboxMainContainer) {
  mapboxMainContainer.style.display =
    'block';
}

if (freeRunTripMapboxMainMap) {
  requestAnimationFrame(function () {
    freeRunTripMapboxMainMap.resize();
  });
}

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

  /* RunTrip 준비 화면에서 취소한 경우에도
     이전 출발지·경유지·도착지와 지도 경로를 모두 초기화한다. */
  resetRunTripDraftState();
  clearRunTripVisualState();

  runTripPanel.classList.add('hidden');
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

if (profileFeedBtn) profileFeedBtn.addEventListener('click', function () {
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

if (monthlyReportBtn) monthlyReportBtn.addEventListener('click', function () {
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
if (runTripBtn) runTripBtn.addEventListener('click', function () {
  openRunTripPanel();
});

backFromRunTripBtn.addEventListener('click', function () {
  closeRunTripPanel();
});

addWaypointBtn.addEventListener('click', function () {
  addRunTripWaypoint();
});

runTripReturnToggle.addEventListener(
  'change',
  function () {
    syncRunTripReturnDestination();
    renderRunTripMapPreview();
  }
);

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
    async function (position) {
      const latitude =
        position.coords.latitude;

      const longitude =
        position.coords.longitude;

      const reverseGeocodedPlace =
        await reverseGeocodeRunTripOrigin(
          latitude,
          longitude
        );

      selectedRunTripOrigin =
        createRunTripCurrentLocationPlace(
          reverseGeocodedPlace,
          latitude,
          longitude
        );

      runTripOriginInput.value =
        getRunTripSavedOriginName(
          selectedRunTripOrigin
        );

      if (runTripReturnToggle.checked) {
        syncRunTripReturnDestination();
      }

      isGettingRunTripCurrentLocation = false;

      updateRunTripCreateButton();
      renderRunTripMapPreview();

      runTripStatus.textContent =
        reverseGeocodedPlace
          ? `${getRunTripSavedOriginName(selectedRunTripOrigin)}을(를) 출발지로 설정했어요.`
          : '현재 위치를 출발지로 설정했어요.';
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
    unlockFreeRunTripVoiceGuidance();

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
    unlockFreeRunTripVoiceGuidance();

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
  isRunTripMapFollowing = true;

  runTripLastValidPosition = null;
  runTripRecentPositions = [];
  runTripLastGpsTimestamp = null;
  runTripElevationReferenceAltitude = null;
  runTripLastValidAltitude = null;
  runTripRecentAltitudeSamples = [];
  runTripCurrentSmoothedAltitude = null;

  beginNewRunTripRouteSegment();

  startRunTripTimer();
  startRunTripLocationWatch();

  updateRunTripDashboard();
  saveActiveRunTripState();

  return;
}

    isRunTripPaused = true;

    cancelFreeRunTripVoiceGuidance();
    hideRunTripNavigationBanners();

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
    runTripRecentPositions = [];
    runTripLastGpsTimestamp = null;
    runTripElevationReferenceAltitude = null;
    runTripLastValidAltitude = null;
    runTripRecentAltitudeSamples = [];
    runTripCurrentSmoothedAltitude = null;
    runTripActiveRouteSegment = null;
    runTripActualRouteLine = null;
    
    updateRunTripDashboard();
    saveActiveRunTripState();
  }
);

runTripDashboardFollowState.addEventListener(
  'click',
  function () {
    if (
      !isRunTripFollowing ||
      isRunTripPaused
    ) {
      return;
    }

    isRunTripMapFollowing =
      !isRunTripMapFollowing;

    if (
      isRunTripMapFollowing &&
      runTripLastValidPosition
    ) {
      const currentLatLng = [
        runTripLastValidPosition.latitude,
        runTripLastValidPosition.longitude
      ];

      centerRunTripMapOnPosition(
        currentLatLng,
        {
          animate: true
        }
      );
      centerMapboxRunTripMapOnPosition(
         currentLatLng,
         {
           animate: true
         }
       );  
    }  

    updateRunTripDashboard();
  }
);

map.on(
  'dragstart',
  function () {
    if (
      !isRunTripFollowing ||
      isRunTripPaused ||
      !isRunTripMapFollowing
    ) {
      return;
    }

    isRunTripMapFollowing = false;
    updateRunTripDashboard();
  }
);
freeRunTripMapboxMainMap.on(
  'dragstart',
  function () {
    if (
      !isRunTripFollowing ||
      isRunTripPaused ||
      !isRunTripMapFollowing
    ) {
      return;
    }

    isRunTripMapFollowing = false;

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

    cancelFreeRunTripVoiceGuidance();

    const savedRunTripRecord =
      completeRunTrip({
        arrived: false
      });

    if (savedRunTripRecord) {
      announceRunTripEnd();
    }
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

  const mapboxMainContainer =
     document.getElementById('mapboxMainMap');

  if (mapboxMainContainer) {
    mapboxMainContainer.style.display =
      'none';
  }
  
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
    clearRunTripVisualState();
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
  /* RunTrip에서 사용한 예정 경로·마커가
     일반 러닝 지도에 남지 않도록 탭 진입 시 정리한다. */
  clearRunTripVisualState();

  map.getContainer().style.display =
    'none';

  const mapboxMainContainer =
    document.getElementById(
      'mapboxMainMap'
    );

  if (mapboxMainContainer) {
    mapboxMainContainer.style.display =
      'block';
  }

  controlsSection.style.display =
    'flex';

  recordsSection.classList.add(
    'hidden'
  );

  if (freeRunTripMapboxMainMap) {
    requestAnimationFrame(function () {
      freeRunTripMapboxMainMap.resize();
    });
  }

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

/* 일반 러닝 저장 완료 후에는
   방금 저장한 기록 상세 화면을 바로 연다.
   화면 전환은 주 저장 처리에서 담당한다. */

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

/* 첫 앱 화면 및 RunTrip 복구 감지 */
function initializeAppWithRunTripRecovery() {
  const savedRunTripState =
    loadActiveRunTripState();

  if (!savedRunTripState) {
    openAppPage('home');
    return;
  }

  const shouldResume =
    window.confirm(
      [
        '진행 중이던 RUNTRIP 기록이 있습니다.',
        '',
        `저장된 경과 시간: ${
          formatRunTripTimer(
            savedRunTripState
              .elapsedSeconds
          )
        }`,
        '',
        '확인을 누르면 이어서 진행합니다.',
        '취소를 누르면 기록 삭제 여부를 확인합니다.'
      ].join('\n')
    );

  if (shouldResume) {
    const restored =
      restoreActiveRunTripState(
        savedRunTripState
      );

    if (restored) {
      return;
    }

    clearActiveRunTripState();

    alert(
      '저장된 RUNTRIP 정보를 복구하지 못해 임시 기록을 삭제했어요.'
    );

    openAppPage('home');
    return;
  }

  const shouldDelete =
    window.confirm(
      [
        '진행 중이던 RUNTRIP 기록을 삭제할까요?',
        '',
        '삭제하면 저장된 시간, 거리, 실제 이동 경로를 복구할 수 없습니다.'
      ].join('\n')
    );

  if (shouldDelete) {
    clearActiveRunTripState();

    openAppPage('home');

    return;
  }

  /*
    삭제를 취소한 경우에는
    복구 데이터를 유지한 채 홈 화면을 연다.
    다음 새로고침 때 다시 복구 여부를 선택할 수 있다.
  */
  openAppPage('home');
}

initializeAppWithRunTripRecovery();