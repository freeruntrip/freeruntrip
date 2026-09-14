const MAPBOX_DIRECTIONS_BASE_URL =
  "https://api.mapbox.com/directions/v5/mapbox/walking";

/*
  FreeRunTrip 글로벌 RunTrip 라우팅 V2
  - Mapbox Directions API walking profile 사용
  - 전체 경로 좌표 + turn-by-turn step + FreeRunTrip용 좌/우회전 구간 반환
  - 클라이언트 언어를 받을 수 있도록 language 파라미터를 글로벌화
  - 기본 언어는 현재 한국어 UI 호환을 위해 ko
*/

const PUBLIC_MAPBOX_FALLBACK_TOKEN = [
  "pk.",
  "eyJ1IjoiZnJlZXJ1bnRyaXAiLCJhIjoiY21zbXN1MW52MG82ZjM0cHZuaDV1ZGduZSJ9",
  ".dVLnvYx-HQirD4OBzHBgHQ",
].join("");

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function normalizeMapboxLanguage(value) {
  const language = String(value || "")
    .trim()
    .toLowerCase();

  if (!language) return "ko";
  if (language.startsWith("ko")) return "ko";
  if (language.startsWith("en")) return "en";
  if (language.startsWith("ja")) return "ja";
  if (language.startsWith("de")) return "de";

  return language.slice(0, 2) || "en";
}

function isValidCoordinate(point) {
  return (
    point &&
    Number.isFinite(Number(point.lat)) &&
    Number.isFinite(Number(point.lng))
  );
}

function normalizeLatLngFromMapbox(coordinate) {
  if (!Array.isArray(coordinate) || coordinate.length < 2) {
    return null;
  }

  const longitude = Number(coordinate[0]);
  const latitude = Number(coordinate[1]);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return [latitude, longitude];
}

function normalizeStep(step, legIndex, stepIndex) {
  const geometryCoordinates =
    Array.isArray(step?.geometry?.coordinates)
      ? step.geometry.coordinates
          .map(normalizeLatLngFromMapbox)
          .filter(Boolean)
      : [];

  const maneuverLocation = normalizeLatLngFromMapbox(
    step?.maneuver?.location
  );

  return {
    legIndex,
    stepIndex,
    distanceMeters: Math.max(0, Number(step?.distance) || 0),
    durationSeconds: Math.max(0, Number(step?.duration) || 0),
    name: String(step?.name || ""),
    mode: String(step?.mode || "walking"),
    maneuver: {
      type: String(step?.maneuver?.type || ""),
      modifier: String(step?.maneuver?.modifier || ""),
      instruction: String(step?.maneuver?.instruction || ""),
      location: maneuverLocation,
            exit:
        Number.isInteger(step?.maneuver?.exit) &&
        step.maneuver.exit > 0
          ? step.maneuver.exit
          : null,
      bearingBefore: Number.isFinite(Number(step?.maneuver?.bearing_before))
        ? Number(step.maneuver.bearing_before)
        : null,
      bearingAfter: Number.isFinite(Number(step?.maneuver?.bearing_after))
        ? Number(step.maneuver.bearing_after)
        : null,
    },
        // Mapbox 원본 교차로 정보를 그대로 전달한다.
    // intersections의 location은 [경도, 위도] 순서다.
    intersections: Array.isArray(step?.intersections)
      ? step.intersections
      : [],
    geometry: geometryCoordinates,
  };
}

function flattenRouteSteps(route) {
  const legs = Array.isArray(route?.legs) ? route.legs : [];
  const steps = [];

  legs.forEach((leg, legIndex) => {
    const legSteps = Array.isArray(leg?.steps) ? leg.steps : [];

    legSteps.forEach((step, stepIndex) => {
      steps.push(normalizeStep(step, legIndex, stepIndex));
    });
  });

  return steps;
}

function buildRouteLegNavigationSegments(route) {
  const legs =
    Array.isArray(route?.legs)
      ? route.legs
      : [];

  return legs.map(function (
    leg,
    legIndex
  ) {
    const legSteps =
      Array.isArray(leg?.steps)
        ? leg.steps.map(function (
            step,
            stepIndex
          ) {
            return normalizeStep(
              step,
              legIndex,
              stepIndex
            );
          })
        : [];

    return createFreeRunTripNavigationSegments(
      legSteps
    );
  });
}

function buildRouteLegSteps(route) {
  const legs =
    Array.isArray(route?.legs)
      ? route.legs
      : [];

  return legs.map(function (
    leg,
    legIndex
  ) {
    const legSteps =
      Array.isArray(leg?.steps)
        ? leg.steps
        : [];

    return legSteps.map(function (
      step,
      stepIndex
    ) {
      return normalizeStep(
        step,
        legIndex,
        stepIndex
      );
    });
  });
}

function buildRouteLegCoordinates(route) {
  const legs = Array.isArray(route?.legs) ? route.legs : [];

  return legs
    .map((leg) => {
      const legSteps = Array.isArray(leg?.steps) ? leg.steps : [];
      const coordinates = [];

      legSteps.forEach((step) => {
        const stepCoordinates =
          Array.isArray(step?.geometry?.coordinates)
            ? step.geometry.coordinates
                .map(normalizeLatLngFromMapbox)
                .filter(Boolean)
            : [];

        stepCoordinates.forEach((point) => {
          const previous = coordinates[coordinates.length - 1];

          if (
            previous &&
            Math.abs(previous[0] - point[0]) < 1e-10 &&
            Math.abs(previous[1] - point[1]) < 1e-10
          ) {
            return;
          }

          coordinates.push(point);
        });
      });

      return coordinates;
    })
    .filter((coordinates) => coordinates.length >= 2);
}

function isFreeRunTripLeftRightTurn(step) {
  const maneuverType = String(
    step?.maneuver?.type || ""
  ).toLowerCase();

  const modifier = String(
    step?.maneuver?.modifier || ""
  ).toLowerCase();

  return (
    maneuverType === "turn" &&
    (modifier === "left" || modifier === "right")
  );
}

function createFreeRunTripNavigationSegments(steps) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return [];
  }

  const segments = [];
  let segmentStartLocation =
    steps[0]?.maneuver?.location ||
    steps[0]?.geometry?.[0] ||
    null;
  let accumulatedDistance = 0;

  steps.forEach((step) => {
    if (isFreeRunTripLeftRightTurn(step)) {
      const endLocation = step?.maneuver?.location || null;

      if (
        segmentStartLocation &&
        endLocation &&
        accumulatedDistance > 0
      ) {
        segments.push({
          index: segments.length,
          startLocation: segmentStartLocation,
          endLocation,
          distanceMeters: accumulatedDistance,
          endAction: {
            type: "turn",
            direction: step.maneuver.modifier,
            instruction: step.maneuver.instruction || "",
          },
        });
      }

      segmentStartLocation = endLocation || segmentStartLocation;
      accumulatedDistance = 0;
    }

    accumulatedDistance += Math.max(
      0,
      Number(step?.distanceMeters) || 0
    );
  });

  const routeEndLocation =
    [...steps]
      .reverse()
      .find((step) => step?.maneuver?.type === "arrive")
      ?.maneuver?.location ||
    steps[steps.length - 1]?.geometry?.at?.(-1) ||
    null;

  if (
    segmentStartLocation &&
    routeEndLocation &&
    accumulatedDistance > 0
  ) {
    segments.push({
      index: segments.length,
      startLocation: segmentStartLocation,
      endLocation: routeEndLocation,
      distanceMeters: accumulatedDistance,
      endAction: {
        type: "arrive",
        direction: null,
        instruction: "",
      },
    });
  }

  return segments;
}

function buildMapboxCoordinates(origin, destination, waypoints) {
  return [origin, ...waypoints, destination]
    .filter(isValidCoordinate)
    .map((point) => `${Number(point.lng)},${Number(point.lat)}`)
    .join(";");
}

// 횡단 구간 조회 결과를 잠시 보관한다.
const RUNTRIP_CROSSING_CACHE = new Map();

// [위도, 경도]를 거리 비교용 평면 좌표로 변환한다.
function crossingXY(point, latitude) {
  return [
    point[1] * 111320 *
      Math.cos(latitude * Math.PI / 180),

    point[0] * 111320
  ];
}

// 경로의 각 좌표까지 누적 거리를 계산한다.
function crossingMetric(points) {
  const latitude = points[0][0];

  const xy = points.map(function (point) {
    return crossingXY(point, latitude);
  });

  const cumulative = [0];

  for (let i = 1; i < xy.length; i++) {
    const distance = Math.hypot(
      xy[i][0] - xy[i - 1][0],
      xy[i][1] - xy[i - 1][1]
    );

    cumulative.push(
      cumulative[i - 1] + distance
    );
  }

  return {
    points,
    latitude,
    xy,
    cumulative,
    length: cumulative[cumulative.length - 1]
  };
}
// 좌표를 경로에 투영해 이격 거리와 경로상 누적 거리를 구한다.
function crossingProject(point, metric) {
  const p = crossingXY(
    point,
    metric.latitude
  );

  const matches = [];

  for (let i = 1; i < metric.xy.length; i++) {
    const a = metric.xy[i - 1];
    const b = metric.xy[i];

    const dx = b[0] - a[0];
    const dy = b[1] - a[1];

    const square = dx * dx + dy * dy;

    if (!square) {
      continue;
    }

    const t = Math.max(
      0,
      Math.min(
        1,
        (
          (p[0] - a[0]) * dx +
          (p[1] - a[1]) * dy
        ) / square
      )
    );

    const distance = Math.hypot(
      p[0] - a[0] - t * dx,
      p[1] - a[1] - t * dy
    );

    // 경로에서 4m 이내인 지점만 비교 대상으로 삼는다.
    if (distance <= 4) {
      matches.push({
        distance,
        progress:
          metric.cumulative[i - 1] +
          t * Math.sqrt(square)
      });
    }
  }

  if (matches.length === 0) {
    return null;
  }

  matches.sort(function (a, b) {
    return a.distance - b.distance;
  });

  // 왕복·교차 경로에서 서로 다른 진행 위치가 겹치면
  // 가장 가까운 지점만으로 판단하지 않는다.
  const isAmbiguous = matches.some(function (match) {
    return Math.abs(
      match.progress - matches[0].progress
    ) > 12;
  });

  if (isAmbiguous) {
    return null;
  }

  return matches[0];
}
// 경로 시작점에서 지정한 거리만큼 이동한 위치의 좌표를 구한다.
function crossingPointAt(metric, progress) {
  for (let i = 1; i < metric.points.length; i++) {
    if (metric.cumulative[i] < progress) {
      continue;
    }

    const segmentLength =
      metric.cumulative[i] -
      metric.cumulative[i - 1];

    const t = segmentLength > 0
      ? (
          progress -
          metric.cumulative[i - 1]
        ) / segmentLength
      : 0;

    const start = metric.points[i - 1];
    const end = metric.points[i];

    return [
      start[0] + (end[0] - start[0]) * t,
      start[1] + (end[1] - start[1]) * t
    ];
  }

  // 지정한 거리가 경로 길이를 넘으면 마지막 좌표를 반환한다.
  return metric.points[
    metric.points.length - 1
  ].slice();
}
// 제한 정보나 높이 차이가 있는 구간은 횡단 안내 후보에서 제외한다.
function crossingRestricted(tags = {}) {
  const hasFootRestriction = [
    'no',
    'private',
    'use_sidepath'
  ].includes(tags.foot);

  const hasAccessRestriction = [
    'no',
    'private'
  ].includes(tags.access);

  const hasCrossingRestriction =
    tags.crossing === 'no' ||
    tags.crossing === 'informal' ||
    tags.informal === 'yes';

  const isArea = tags.area === 'yes';

  const hasBridge =
    Boolean(tags.bridge) &&
    tags.bridge !== 'no';

  const hasTunnel =
    Boolean(tags.tunnel) &&
    tags.tunnel !== 'no';

  const hasDifferentLayer =
    Boolean(tags.layer) &&
    tags.layer !== '0';

  const hasLevelInformation =
    Boolean(tags.level);

  const hasConditionalOrInactiveTags =
    Object.keys(tags).some(function (key) {
      return /conditional|construction|proposed|disused/.test(
        key
      );
    });

  return (
    hasFootRestriction ||
    hasAccessRestriction ||
    hasCrossingRestriction ||
    isArea ||
    hasBridge ||
    hasTunnel ||
    hasDifferentLayer ||
    hasLevelInformation ||
    hasConditionalOrInactiveTags
  );
}
// 횡단 보행로와 연결된 횡단 지점이 함께 있는 후보를 추린다.
function collectRunTripCrossingWays(elements) {
  if (!Array.isArray(elements)) {
    return [];
  }

  const nodes = new Map();

  elements.forEach(function (element) {
    if (element?.type === 'node') {
      nodes.set(element.id, element);
    }
  });

  return elements.filter(function (element) {
    if (
      element?.type !== 'way' ||
      element.tags?.highway !== 'footway' ||
      element.tags?.footway !== 'crossing'
    ) {
      return false;
    }

    if (crossingRestricted(element.tags)) {
      return false;
    }

    const geometry = element.geometry;

    if (
      !Array.isArray(geometry) ||
      geometry.length < 2 ||
      !geometry.every(function (point) {
        return (
          Number.isFinite(point?.lat) &&
          Number.isFinite(point?.lon)
        );
      })
    ) {
      return false;
    }

    const nodeIds = element.nodes;

    if (
      !Array.isArray(nodeIds) ||
      nodeIds.length < 2
    ) {
      return false;
    }

    // 구성 지점의 정보가 빠졌거나 제한 정보가 있으면 제외한다.
    const allNodesAllowed = nodeIds.every(function (id) {
      const node = nodes.get(id);

      return (
        Boolean(node) &&
        !crossingRestricted(node.tags || {})
      );
    });

    if (!allNodesAllowed) {
      return false;
    }

    // 이 보행로에 실제로 연결된 횡단 지점 표시가 필요하다.
    const hasCrossingNode = nodeIds.some(function (id) {
      return (
        nodes.get(id)?.tags?.highway === 'crossing'
      );
    });

    return hasCrossingNode;
  });
}

// 횡단 후보 하나를 현재 안내 구간의 경로와 비교한다.
function matchRunTripCrossingWay(way, route) {
  const crossingPoints = way.geometry.map(function (point) {
    return [point.lat, point.lon];
  });

  const crossing = crossingMetric(crossingPoints);

  if (crossing.length < 6 || crossing.length > 100) {
    return null;
  }

  const first = crossingProject(
    crossing.points[0],
    route
  );

  const last = crossingProject(
    crossing.points[crossing.points.length - 1],
    route
  );

  if (!first || !last) {
    return null;
  }

  const start = Math.min(
    first.progress,
    last.progress
  );

  const end = Math.max(
    first.progress,
    last.progress
  );

  const matchedLength = end - start;

  if (
    start < 6 ||
    end > route.length - 3 ||
    matchedLength < 6
  ) {
    return null;
  }

  const allowedLengthDifference = Math.max(
    3,
    crossing.length * 0.15
  );

  if (
    Math.abs(matchedLength - crossing.length) >
    allowedLengthDifference
  ) {
    return null;
  }

  const direction = Math.sign(
    last.progress - first.progress
  );

  for (let d = 0; d <= crossing.length; d += 3) {
    const point = crossingPointAt(crossing, d);
    const projected = crossingProject(point, route);

    const expectedProgress =
      first.progress + direction * d;

    if (
      !projected ||
      Math.abs(
        projected.progress - expectedProgress
      ) > 5
    ) {
      return null;
    }
  }

  for (let d = start; d <= end; d += 3) {
    const point = crossingPointAt(route, d);

    if (!crossingProject(point, crossing)) {
      return null;
    }
  }

  return {
    id: `osm-way-${way.id}`,
    source: 'openstreetmap',
    evidence: 'tagged-crossing-way-and-node',
    startMeters: start,
    endMeters: end,
    location: crossingPointAt(route, start),
    endLocation: crossingPointAt(route, end)
  };
}
// 각 안내 구간에 경로와 일치하는 횡단 정보를 저장한다.
function matchRunTripCrossings(legSteps, elements) {
  const ways = collectRunTripCrossingWays(elements);

  let matched = 0;

  for (const steps of legSteps) {
    for (const step of steps) {
      step.crossingEvents = [];

      if (
        !Array.isArray(step.geometry) ||
        step.geometry.length < 2 ||
        step.mode !== 'walking'
      ) {
        continue;
      }

      const intersections = Array.isArray(step.intersections)
        ? step.intersections
        : [];

      // 고가·터널 등 높이 차이가 의심되는 안내 구간은 제외한다.
      const hasDifferentStructure = intersections.some(
        function (intersection) {
          const classes = Array.isArray(intersection?.classes)
            ? intersection.classes
            : [];

          const structure =
            intersection?.mapbox_streets_v8?.structure;

          return (
            classes.some(function (value) {
              return [
                'tunnel',
                'bridge',
                'ferry'
              ].includes(value);
            }) ||
            (
              Boolean(structure) &&
              structure !== 'none'
            )
          );
        }
      );

      if (hasDifferentStructure) {
        continue;
      }

      // 한 안내 구간의 비교 작업량을 제한한다.
      if (step.geometry.length > 3000) {
        continue;
      }

      const route = crossingMetric(step.geometry);

      if (route.length > 10000) {
        continue;
      }

      const candidates = [];

      for (const way of ways) {
        const crossing = matchRunTripCrossingWay(
          way,
          route
        );

        if (crossing) {
          candidates.push(crossing);
        }
      }

      candidates.sort(function (a, b) {
        return a.startMeters - b.startMeters;
      });

      // 서로 겹치거나 간격이 너무 짧은 후보는 이번 단계에서 보류한다.
      step.crossingEvents = candidates.filter(
        function (candidate, index) {
          const hasNearbyCandidate = candidates.some(
            function (other, otherIndex) {
              if (index === otherIndex) {
                return false;
              }

              return (
                other.startMeters < candidate.endMeters + 6 &&
                other.endMeters > candidate.startMeters - 6
              );
            }
          );

          return !hasNearbyCandidate;
        }
      );

      matched += step.crossingEvents.length;
    }
  }

  return matched;
}
// 예정 경로 주변의 횡단 보행로와 구성 지점을 조회할 검색문을 만든다.
function buildRunTripCrossingQuery(coordinates) {
  if (
    !Array.isArray(coordinates) ||
    coordinates.length < 2 ||
    coordinates.length > 15000
  ) {
    return null;
  }

  const validCoordinates = coordinates.every(function (point) {
    return (
      Array.isArray(point) &&
      point.length >= 2 &&
      Number.isFinite(point[0]) &&
      Number.isFinite(point[1]) &&
      Math.abs(point[0]) <= 90 &&
      Math.abs(point[1]) <= 180
    );
  });

  if (!validCoordinates) {
    return null;
  }

  const latitudes = coordinates.map(function (point) {
    return point[0];
  });

  const longitudes = coordinates.map(function (point) {
    return point[1];
  });

  const south = Math.min(...latitudes) - 0.0002;
  const north = Math.max(...latitudes) + 0.0002;
  const west = Math.min(...longitudes) - 0.0002;
  const east = Math.max(...longitudes) + 0.0002;

  // 과도하게 넓은 조회와 현재 거리 계산 방식에 부적합한 범위는 보류한다.
  if (
    north - south > 0.12 ||
    east - west > 0.15 ||
    Math.max(Math.abs(south), Math.abs(north)) > 75 ||
    west < -180 ||
    east > 180
  ) {
    return null;
  }

  const bounds = [
    south,
    west,
    north,
    east
  ].map(function (value) {
    return value.toFixed(5);
  }).join(',');

  return [
    '[out:json][timeout:3][maxsize:8388608];',
    'way["highway"="footway"]["footway"="crossing"]',
    `(${bounds});`,
    'out body geom;',
    '>;',
    'out body;'
  ].join('');
}
// 횡단 데이터를 조회하고, 성공한 결과를 5분간 재사용한다.
async function fetchRunTripCrossingElements(query) {
  if (!query) {
    return null;
  }

  const cached = RUNTRIP_CROSSING_CACHE.get(query);

  if (cached && cached.expires > Date.now()) {
    return cached.elements;
  }

  RUNTRIP_CROSSING_CACHE.delete(query);

  function lookupError(reason, httpStatus = null) {
    const error = new Error('Crossing lookup failed');
    error.crossingReason = reason;
    error.crossingHttpStatus = httpStatus;
    return error;
  }

  const controller = new AbortController();

  const timeout = setTimeout(function () {
    controller.abort();
  }, 3500);

  try {
    const response = await fetch(
      'https://overpass-api.de/api/interpreter',
      {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type':
            'application/x-www-form-urlencoded',
          Accept: 'application/json'
        },
        body: new URLSearchParams({
          data: query
        }).toString()
      }
    );

    if (!response.ok) {
      throw lookupError('http-error', response.status);
    }

    const data = await response.json();

    if (data?.remark) {
      throw lookupError('provider-remark');
    }

    if (!Array.isArray(data?.elements)) {
      throw lookupError('invalid-response');
    }

    if (data.elements.length > 10000) {
      throw lookupError('element-limit');
    }

    if (RUNTRIP_CROSSING_CACHE.size >= 20) {
      const oldestKey =
        RUNTRIP_CROSSING_CACHE.keys().next().value;

      RUNTRIP_CROSSING_CACHE.delete(oldestKey);
    }

    RUNTRIP_CROSSING_CACHE.set(query, {
      elements: data.elements,
      expires: Date.now() + 5 * 60 * 1000
    });

    return data.elements;
  } catch (error) {
    if (error?.crossingReason) {
      throw error;
    }

    if (controller.signal.aborted) {
      throw lookupError('timeout');
    }

    if (error?.name === 'SyntaxError') {
      throw lookupError('invalid-json');
    }

    throw lookupError('fetch-error');
  } finally {
    clearTimeout(timeout);
  }
}
// 횡단 데이터를 조회해 각 안내 구간에 연결하고 처리 결과를 반환한다.
async function enrichRunTripCrossings(legSteps, coordinates) {
  const result = {
    source: 'openstreetmap',
    status: 'unavailable',
    matched: 0
  };

  // 안내 구간 배열이 올바른지 확인한다.
  if (
    !Array.isArray(legSteps) ||
    !legSteps.every(function (steps) {
      return (
        Array.isArray(steps) &&
        steps.every(function (step) {
          return step && typeof step === 'object';
        })
      );
    })
  ) {
    return result;
  }

  // 이전에 붙은 횡단 정보가 있다면 초기화한다.
  legSteps.forEach(function (steps) {
    steps.forEach(function (step) {
      delete step.crossingEvents;
    });
  });

  try {
    const query = buildRunTripCrossingQuery(coordinates);

    if (!query) {
      result.status = 'skipped-query-range';
      return result;
    }

    const elements = await fetchRunTripCrossingElements(query);

    if (elements === null) {
      return result;
    }

    result.matched = matchRunTripCrossings(
      legSteps,
      elements
    );

    result.status = result.matched > 0
      ? 'matched'
      : 'no-confirmed-match';

    return result;
  } catch (error) {
    // 비교 도중 오류가 나면 일부만 추가된 횡단 정보도 제거한다.
    legSteps.forEach(function (steps) {
      steps.forEach(function (step) {
        delete step.crossingEvents;
      });
    });

        return {
      source: 'openstreetmap',
      status: 'unavailable',
      matched: 0,
      reason: error?.crossingReason || 'processing-error',
      httpStatus: error?.crossingHttpStatus || null
    };
  }
}
module.exports = async function handler(request, response) {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    return response.status(204).end();
  }

  if (request.method !== "POST") {
    return response.status(405).json({
      error: "POST 요청만 사용할 수 있습니다.",
    });
  }

  const {
    origin,
    destination,
    waypoints = [],
    language = "ko",
  } = request.body || {};

  if (!isValidCoordinate(origin) || !isValidCoordinate(destination)) {
    return response.status(400).json({
      error: "출발지와 도착지 좌표가 필요합니다.",
    });
  }

  if (!Array.isArray(waypoints) || waypoints.length > 23) {
    return response.status(400).json({
      error: "경유지는 최대 23개까지 사용할 수 있습니다.",
    });
  }

  const mapboxAccessToken =
    process.env.MAPBOX_ACCESS_TOKEN ||
    process.env.MAPBOX_PUBLIC_ACCESS_TOKEN ||
    PUBLIC_MAPBOX_FALLBACK_TOKEN;

  if (!mapboxAccessToken) {
    return response.status(500).json({
      error: "Mapbox access token이 설정되지 않았습니다.",
    });
  }

  const coordinatePath = buildMapboxCoordinates(
    origin,
    destination,
    waypoints
  );

  const mapboxUrl = new URL(
    `${MAPBOX_DIRECTIONS_BASE_URL}/${coordinatePath}`
  );

  mapboxUrl.searchParams.set("access_token", mapboxAccessToken);
  mapboxUrl.searchParams.set("alternatives", "false");
  mapboxUrl.searchParams.set("steps", "true");
  mapboxUrl.searchParams.set("geometries", "geojson");
  mapboxUrl.searchParams.set("overview", "full");
  mapboxUrl.searchParams.set(
    "language",
    normalizeMapboxLanguage(language)
  );
  mapboxUrl.searchParams.set("roundabout_exits", "false");

  try {
    const mapboxResponse = await fetch(mapboxUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    const data = await mapboxResponse.json().catch(() => null);

    if (!mapboxResponse.ok || data?.code !== "Ok") {
      console.error("Mapbox Directions error:", {
        status: mapboxResponse.status,
        code: data?.code,
        message: data?.message,
      });

      return response.status(mapboxResponse.status || 502).json({
        error:
          data?.message ||
          "Mapbox 보행 경로를 불러오지 못했습니다.",
      });
    }

    const route = Array.isArray(data?.routes) ? data.routes[0] : null;

    const routeCoordinates =
      Array.isArray(route?.geometry?.coordinates)
        ? route.geometry.coordinates
            .map(normalizeLatLngFromMapbox)
            .filter(Boolean)
        : [];

    if (routeCoordinates.length < 2) {
      return response.status(502).json({
        error: "Mapbox 응답에서 경로 좌표를 찾지 못했습니다.",
      });
    }

    const steps = flattenRouteSteps(route);
    const legSteps =
       buildRouteLegSteps(route);
    const legCoordinates =
      buildRouteLegCoordinates(route);

    const crossingCoverage = await enrichRunTripCrossings(
      legSteps,
      routeCoordinates
    );

    const navigationSegments =
      createFreeRunTripNavigationSegments(steps);

    const legNavigationSegments =
       buildRouteLegNavigationSegments(route);
      
           return response.status(200).json({
      provider: "mapbox",
      profile: "mapbox/walking",
      language: normalizeMapboxLanguage(language),
      coordinates: routeCoordinates,
      distanceMeters: Math.max(0, Number(route?.distance) || 0),
      durationSeconds: Math.max(0, Number(route?.duration) || 0),
      steps,
      legSteps,
      crossingCoverage,
      legCoordinates,
      navigationSegments,
      legNavigationSegments,
    });
  } catch (error) {
    console.error("RunTrip Mapbox route server error:", error);

    return response.status(500).json({
      error: "Mapbox 보행 경로 요청 중 서버 오류가 발생했습니다.",
    });
  }
};
