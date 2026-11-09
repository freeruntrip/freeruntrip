const MAPBOX_DIRECTIONS_BASE_URL =
  "https://api.mapbox.com/directions/v5/mapbox/walking";
const GOOGLE_PLACES_BASE_URL = "https://places.googleapis.com/v1/places";
const GOOGLE_DETAILS_TIMEOUT_MS = 2500;
const GOOGLE_DETAILS_CACHE_TTL_MS = 5 * 60 * 1000;
const GOOGLE_DETAILS_CACHE_MAX_ENTRIES = 128;
const MAX_PLACE_LOCATION_DISTANCE_METERS = 100;
const MAX_DESTINATION_CANDIDATE_DISTANCE_METERS = 250;
const MAX_DESTINATION_CANDIDATES = 3;
const MAX_DESTINATION_SNAP_DISTANCE_METERS = 75;
const MAX_ENDPOINT_MISMATCH_METERS = 2;
const destinationDetailsCache = new Map();
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

function finiteNumber(value) {
  if (
    typeof value !== "number" &&
    (typeof value !== "string" || value.trim() === "")
  ) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeLatLng(latitudeValue, longitudeValue) {
  const latitude = finiteNumber(latitudeValue);
  const longitude = finiteNumber(longitudeValue);

  if (
    latitude === null ||
    longitude === null ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return null;
  }

  return [latitude, longitude];
}

function isValidCoordinate(point) {
  return !!normalizeLatLng(point?.lat, point?.lng);
}

function normalizeLatLngFromMapbox(coordinate) {
  if (!Array.isArray(coordinate) || coordinate.length < 2) {
    return null;
  }

  return normalizeLatLng(coordinate[1], coordinate[0]);
}

function distanceBetweenCoordinates(first, second) {
  const radians = Math.PI / 180;
  const latitudeDelta = (second[0] - first[0]) * radians;
  const longitudeDelta = (second[1] - first[1]) * radians;

  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(first[0] * radians) *
      Math.cos(second[0] * radians) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}
function findInitialRouteLoopReturnIndex(
  coordinates,
  firstTarget
) {
  if (
    !Array.isArray(coordinates) ||
    coordinates.length < 4
  ) {
    return -1;
  }

  const start = coordinates[0];

  const target =
    Array.isArray(firstTarget)
      ? firstTarget
      : normalizeLatLng(
          firstTarget?.lat,
          firstTarget?.lng
        );

  const startToTargetDistance =
    target
      ? distanceBetweenCoordinates(
          start,
          target
        )
      : null;

  const ESCAPE_RADIUS_METERS = 60;
  const RETURN_RADIUS_METERS = 35;
  const MAX_SCAN_DISTANCE_METERS = 400;

  // 너무 짧게 꺾였다가 돌아오는 정상 도로는
  // 루프로 판정하지 않는다.
  const MIN_LOOP_TRAVEL_METERS = 120;

  // 첫 경유지/목적지 쪽으로 이 정도 이상
  // 가까워졌다면 정상적인 진행으로 본다.
  const MIN_TARGET_PROGRESS_METERS = 20;

  let cumulativeDistance = 0;
  let escapedStartArea = false;

  for (
    let index = 1;
    index < coordinates.length;
    index += 1
  ) {
    const previous = coordinates[index - 1];
    const current = coordinates[index];

    cumulativeDistance +=
      distanceBetweenCoordinates(
        previous,
        current
      );

    const distanceFromStart =
      distanceBetweenCoordinates(
        start,
        current
      );

    if (
      !escapedStartArea &&
      distanceFromStart >=
        ESCAPE_RADIUS_METERS
    ) {
      escapedStartArea = true;
    } else if (
      escapedStartArea &&
      distanceFromStart <=
        RETURN_RADIUS_METERS
    ) {
      if (
        cumulativeDistance <
        MIN_LOOP_TRAVEL_METERS
      ) {
        continue;
      }

      if (
        target &&
        Number.isFinite(
          startToTargetDistance
        )
      ) {
        const currentToTargetDistance =
          distanceBetweenCoordinates(
            current,
            target
          );

        const targetProgressMeters =
          startToTargetDistance -
          currentToTargetDistance;

        /*
          출발지 근처로 다시 왔더라도
          첫 경유지/목적지 쪽으로 충분히
          진전했다면 정상적인 도로 굴곡으로 본다.
        */
        if (
          targetProgressMeters >=
          MIN_TARGET_PROGRESS_METERS
        ) {
          continue;
        }
      }

      return index;
    }

    if (
      cumulativeDistance >=
      MAX_SCAN_DISTANCE_METERS
    ) {
      break;
    }
  }

  return -1;
}

function hasInitialRouteLoop(
  coordinates,
  firstTarget
) {
  return (
    findInitialRouteLoopReturnIndex(
      coordinates,
      firstTarget
    ) >= 0
  );
}

function findInitialLoopGuidePoints(
  coordinates,
  firstTarget
) {
  if (
    !Array.isArray(coordinates) ||
    coordinates.length < 4
  ) {
    return [];
  }

  const returnIndex =
    findInitialRouteLoopReturnIndex(
      coordinates,
      firstTarget
    );

  if (returnIndex < 0) {
    return [];
  }

  const targetDistances = [
  10,
  20,
  35,
  50,
  70,
  90,
  120,
  160,
  220
];

  const guidePoints = [];

  let distanceAfterReturn = 0;
  let targetIndex = 0;

  for (
    let index = returnIndex + 1;
    index < coordinates.length &&
    targetIndex < targetDistances.length;
    index += 1
  ) {
    distanceAfterReturn +=
      distanceBetweenCoordinates(
        coordinates[index - 1],
        coordinates[index]
      );

    while (
      targetIndex <
        targetDistances.length &&
      distanceAfterReturn >=
        targetDistances[targetIndex]
    ) {
      const point =
        coordinates[index];

      guidePoints.push({
        lat: point[0],
        lng: point[1]
      });

      targetIndex += 1;
    }
  }

  return guidePoints;
}
function normalizeGoogleLocation(location) {
  return normalizeLatLng(location?.latitude, location?.longitude);
}

function normalizePlaceId(value) {
  if (typeof value !== "string") return "";

  const id = value.trim();
  return id && id.length <= 512 && !/[\s/]/.test(id) ? id : "";
}

function cacheDestinationDetails(id, details) {
  const now = Date.now();

  for (const [key, entry] of destinationDetailsCache) {
    if (entry.expiresAt <= now) {
      destinationDetailsCache.delete(key);
    }
  }

  destinationDetailsCache.delete(id);

  while (destinationDetailsCache.size >= GOOGLE_DETAILS_CACHE_MAX_ENTRIES) {
    destinationDetailsCache.delete(destinationDetailsCache.keys().next().value);
  }

  destinationDetailsCache.set(id, {
    details,
    expiresAt: now + GOOGLE_DETAILS_CACHE_TTL_MS
  });
}

async function getDestinationDetails(id, apiKey) {
  const cached = destinationDetailsCache.get(id);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.details;
  }

  if (cached) {
    destinationDetailsCache.delete(id);
  }

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    GOOGLE_DETAILS_TIMEOUT_MS
  );

  try {
    const result = await fetch(
      `${GOOGLE_PLACES_BASE_URL}/${encodeURIComponent(id)}`,
      {
        method: "GET",
        signal: controller.signal,
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "id,location,entrances,navigationPoints"
        }
      }
    );

    if (!result.ok) return null;

    const data = await result.json();
    const location = normalizeGoogleLocation(data?.location);

    if (data?.id !== id || !location) {
      return null;
    }

    const details = {
      id,
      location,

      preferredEntrances: (
        Array.isArray(data.entrances) ? data.entrances : []
      )
        .filter(
          entrance =>
            Array.isArray(entrance?.tags) &&
            entrance.tags.includes("PREFERRED")
        )
        .map(entrance => normalizeGoogleLocation(entrance?.location))
        .filter(Boolean)
        .slice(0, 100),

      walkingNavigationPoints: (
        Array.isArray(data.navigationPoints) ? data.navigationPoints : []
      )
        .filter(
          point =>
            Array.isArray(point?.travelModes) &&
            point.travelModes.includes("WALK")
        )
        .map(point => normalizeGoogleLocation(point?.location))
        .filter(Boolean)
        .slice(0, 100)
    };

    cacheDestinationDetails(id, details);
    return details;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function destinationCandidates(details, requestedDestination) {
  if (
    !details ||
    distanceBetweenCoordinates(details.location, requestedDestination) >
      MAX_PLACE_LOCATION_DISTANCE_METERS
  ) {
    return [];
  }

  for (const [points, source] of [
    [details.preferredEntrances, "google-preferred-entrance"],
    [details.walkingNavigationPoints, "google-walking-navigation"]
  ]) {
    const candidates = [];

    for (const location of points) {
      if (
        distanceBetweenCoordinates(location, requestedDestination) >
          MAX_DESTINATION_CANDIDATE_DISTANCE_METERS ||
        candidates.some(
          candidate =>
            distanceBetweenCoordinates(candidate.location, location) < 1
        )
      ) {
        continue;
      }

      candidates.push({ location, source });

      if (candidates.length === MAX_DESTINATION_CANDIDATES) {
        break;
      }
    }

    if (candidates.length) {
      return candidates;
    }
  }

  return [];
}

function normalizeSnappedWaypoints(data, route, inputs) {
  const waypoints = [route?.waypoints, data?.waypoints].find(
    points => Array.isArray(points) && points.length === inputs.length
  );

  return inputs.map((point, index) => {
    const inputLocation = normalizeLatLng(point.lat, point.lng);
    const waypoint = waypoints?.[index];
    const location = normalizeLatLngFromMapbox(waypoint?.location);
    const reportedDistance = finiteNumber(waypoint?.distance);

    return {
      index,
      inputLocation,
      location,
      distanceMeters: location
        ? reportedDistance !== null && reportedDistance >= 0
          ? reportedDistance
          : distanceBetweenCoordinates(inputLocation, location)
        : null,
      name: typeof waypoint?.name === "string" ? waypoint.name : ""
    };
  });
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

    voiceInstructions: Array.isArray(step?.voiceInstructions)
      ? step.voiceInstructions
      : [],

    bannerInstructions: Array.isArray(step?.bannerInstructions)
      ? step.bannerInstructions
      : [],
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
    .map(point => `${Number(point.lng)},${Number(point.lat)}`)
    .join(";");
}

function routeError(message, status = 502) {
  const error = new Error(message);

  error.status =
    Number.isInteger(status) && status >= 400 && status <= 599
      ? status
      : 502;

  return error;
}

async function requestWalkingRoute({
  origin,
  destination,
  waypoints,
  language,
  mapboxAccessToken
}) {
  const userRoutePoints = [
    origin,
    ...waypoints,
    destination
  ];
  const firstTarget =
  waypoints.length > 0
    ? waypoints[0]
    : destination;

  async function requestRoute(
    routePoints,
    waypointIndexes = null
  ) {
    const coordinatePath =
      routePoints
        .map(
          point =>
            `${Number(point.lng)},${Number(point.lat)}`
        )
        .join(";");

    const mapboxUrl = new URL(
      `${MAPBOX_DIRECTIONS_BASE_URL}/${coordinatePath}`
    );

    mapboxUrl.searchParams.set(
      "access_token",
      mapboxAccessToken
    );

    mapboxUrl.searchParams.set(
      "alternatives",
      "true"
    );

    mapboxUrl.searchParams.set(
      "waypoints_per_route",
      "true"
    );

    if (
      Array.isArray(waypointIndexes) &&
      waypointIndexes.length >= 2
    ) {
      mapboxUrl.searchParams.set(
        "waypoints",
        waypointIndexes.join(";")
      );
    }

    mapboxUrl.searchParams.set(
      "steps",
      "true"
    );

    mapboxUrl.searchParams.set(
      "voice_instructions",
      "true"
    );

    mapboxUrl.searchParams.set(
      "banner_instructions",
      "true"
    );

    mapboxUrl.searchParams.set(
      "voice_units",
      "metric"
    );

    mapboxUrl.searchParams.set(
      "geometries",
      "geojson"
    );

    mapboxUrl.searchParams.set(
      "overview",
      "full"
    );

    mapboxUrl.searchParams.set(
      "language",
      normalizeMapboxLanguage(language)
    );

    mapboxUrl.searchParams.set(
      "roundabout_exits",
      "false"
    );

    const mapboxResponse =
      await fetch(mapboxUrl, {
        method: "GET",
        headers: {
          Accept: "application/json"
        }
      });

    const data =
      await mapboxResponse
        .json()
        .catch(() => null);

    if (
      !mapboxResponse.ok ||
      data?.code !== "Ok"
    ) {
      throw routeError(
        typeof data?.message === "string"
          ? data.message
          : "Mapbox 보행 경로를 불러오지 못했습니다.",
        mapboxResponse.status
      );
    }

    console.log(
      "FreeRunTrip Mapbox alternatives",
      Array.isArray(data?.routes)
        ? data.routes.map(
            (candidate, index) => ({
              index,
              distanceMeters:
                candidate.distance,
              durationSeconds:
                candidate.duration
            })
          )
        : []
    );

    const routeCandidates =
  Array.isArray(data?.routes)
    ? data.routes
        .map(function (candidate) {
          const rawCoordinates =
            candidate?.geometry?.coordinates;

          const candidateCoordinates =
            Array.isArray(rawCoordinates)
              ? rawCoordinates
                  .map(normalizeLatLngFromMapbox)
                  .filter(Boolean)
              : [];

          return {
            route: candidate,
            coordinates: candidateCoordinates
          };
        })
        .filter(function (candidate) {
          return candidate.coordinates.length >= 2;
        })
    : [];

const selectedCandidate =
  routeCandidates.find(function (candidate) {
    return !hasInitialRouteLoop(
      candidate.coordinates,
      firstTarget
    );
  }) ||
  routeCandidates[0] ||
  null;

const route =
  selectedCandidate?.route ||
  null;

const coordinates =
  selectedCandidate?.coordinates ||
  [];

    if (coordinates.length < 2) {
      throw routeError(
        "Mapbox 응답에서 경로 좌표를 찾지 못했습니다."
      );
    }

    const snappedInputPoints =
  Array.isArray(waypointIndexes)
    ? waypointIndexes
        .map(index => routePoints[index])
        .filter(Boolean)
    : routePoints;

    const snappedWaypoints =
       normalizeSnappedWaypoints(
        data,
    route,
    snappedInputPoints
  );

    console.log(
      "FreeRunTrip route snapping diagnostics",
      {
        inputs: snappedInputPoints,
        snappedWaypoints,
        distanceMeters: route?.distance,
        durationSeconds: route?.duration,
        initialLoop:
          hasInitialRouteLoop(
            coordinates,
            firstTarget
        )
      }
    );

    return {
      route,
      coordinates,
      snappedWaypoints
    };
  }

  const primaryRoute =
    await requestRoute(
      userRoutePoints
    );

  if (
  !hasInitialRouteLoop(
    primaryRoute.coordinates,
    firstTarget
  )
) {
  return primaryRoute;
}

  console.log(
    "FreeRunTrip initial route loop detected"
  );
  const guidePoints =
  findInitialLoopGuidePoints(
  primaryRoute.coordinates,
  firstTarget
);

if (guidePoints.length === 0) {
  throw routeError(
    "출발지 주변에서 정상적인 보행 경로를 확정하지 못했습니다."
  );
}

for (const guidePoint of guidePoints) {
  const retryRoutePoints = [
    origin,
    guidePoint,
    ...waypoints,
    destination
  ];

  const realWaypointIndexes = [
    0
  ];

  for (
    let index = 2;
    index < retryRoutePoints.length;
    index += 1
  ) {
    realWaypointIndexes.push(index);
  }

  try {
    const retryRoute =
      await requestRoute(
        retryRoutePoints,
        realWaypointIndexes
      );

    if (
      hasInitialRouteLoop(
        retryRoute.coordinates,
       firstTarget
      )
    ) {
      console.log(
        "FreeRunTrip retry route still loops",
        guidePoint
      );

      continue;
    }

    console.log(
      "FreeRunTrip initial route loop removed",
      guidePoint
    );

    return retryRoute;
  } catch (error) {
    console.log(
      "FreeRunTrip loop retry failed",
      {
        guidePoint,
        message: error?.message || ""
      }
    );
  }
}

throw routeError(
  "출발지 주변에서 정상적인 보행 경로를 확정하지 못했습니다."
);
}

function isUsableDestinationRoute(result, target) {
  const snappedDestination = result.snappedWaypoints.at(-1);
  const routeEnd = result.coordinates.at(-1);
  const routeDistance = finiteNumber(result.route?.distance);

  return !!(
    snappedDestination?.location &&
    routeDistance !== null &&
    routeDistance >= 0 &&
    snappedDestination.distanceMeters <= MAX_DESTINATION_SNAP_DISTANCE_METERS &&
    distanceBetweenCoordinates(target, snappedDestination.location) <=
      MAX_DESTINATION_SNAP_DISTANCE_METERS &&
    distanceBetweenCoordinates(target, routeEnd) <=
      MAX_DESTINATION_SNAP_DISTANCE_METERS &&
    distanceBetweenCoordinates(snappedDestination.location, routeEnd) <=
      MAX_ENDPOINT_MISMATCH_METERS
  );
}

module.exports = async function handler(request, response) {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    return response.status(204).end();
  }

  if (request.method !== "POST") {
    return response.status(405).json({
      error: "POST 요청만 사용할 수 있습니다."
    });
  }

  const {
    origin,
    destination,
    waypoints = [],
    language = "ko",
    destinationPlaceId,
    autoAdjustDestination = false
  } = request.body || {};

  if (!isValidCoordinate(origin) || !isValidCoordinate(destination)) {
    return response.status(400).json({
      error: "올바른 출발지와 도착지 좌표가 필요합니다."
    });
  }

  if (!Array.isArray(waypoints) || waypoints.length > 23) {
    return response.status(400).json({
      error: "경유지는 최대 23개까지 사용할 수 있습니다."
    });
  }

  if (!waypoints.every(isValidCoordinate)) {
    return response.status(400).json({
      error: "모든 경유지에 올바른 좌표가 필요합니다."
    });
  }

  const mapboxAccessToken =
    process.env.MAPBOX_ACCESS_TOKEN ||
    process.env.MAPBOX_PUBLIC_ACCESS_TOKEN ||
    PUBLIC_MAPBOX_FALLBACK_TOKEN;

  if (!mapboxAccessToken) {
    return response.status(500).json({
      error: "Mapbox access token이 설정되지 않았습니다."
    });
  }

  const requestedDestination = normalizeLatLng(
    destination.lat,
    destination.lng
  );

  const routeOptions = {
    origin,
    destination,
    waypoints,
    language,
    mapboxAccessToken
  };

  try {
    let chosenRoute = null;
    let destinationTarget = requestedDestination;
    let destinationSource = "place-coordinate";

    const googleApiKey = String(
      process.env.GOOGLE_MAPS_API_KEY || ""
    ).trim();

    const placeId = normalizePlaceId(destinationPlaceId);

    if (autoAdjustDestination === true && googleApiKey && placeId) {
      const details = await getDestinationDetails(placeId, googleApiKey);

      const candidates = destinationCandidates(
        details,
        requestedDestination
      );

      const results = await Promise.allSettled(
        candidates.map(async candidate => {
          const result = await requestWalkingRoute({
            ...routeOptions,
            destination: {
              lat: candidate.location[0],
              lng: candidate.location[1]
            }
          });

          return isUsableDestinationRoute(result, candidate.location)
            ? { ...candidate, result }
            : null;
        })
      );

      const validCandidates = results
        .filter(result => result.status === "fulfilled" && result.value)
        .map(result => result.value)
        .sort(
          (first, second) =>
            first.result.route.distance - second.result.route.distance
        );

      if (validCandidates.length) {
        const best = validCandidates[0];

        chosenRoute = best.result;
        destinationTarget = best.location;
        destinationSource = best.source;
      }
    }

    if (!chosenRoute) {
      chosenRoute = await requestWalkingRoute(routeOptions);
    }

    const { route, coordinates, snappedWaypoints } = chosenRoute;

    const steps = flattenRouteSteps(route);
    const legSteps = buildRouteLegSteps(route);
    const legCoordinates = buildRouteLegCoordinates(route);

    const navigationSegments =
      createFreeRunTripNavigationSegments(steps);

    const legNavigationSegments =
      buildRouteLegNavigationSegments(route);

    return response.status(200).json({
      provider: "mapbox",
      profile: "mapbox/walking",
      language: normalizeMapboxLanguage(language),
      coordinates,
      distanceMeters: Math.max(0, Number(route?.distance) || 0),
      durationSeconds: Math.max(0, Number(route?.duration) || 0),
      steps,
      legSteps,
      legCoordinates,
      navigationSegments,
      legNavigationSegments,
      requestedDestination,
      destinationTarget,
      destinationSource,
      snappedWaypoints
    });
  } catch (error) {
    console.error(
      "RunTrip Mapbox route server error:",
      error?.message
    );

    const status =
      Number.isInteger(error?.status) &&
      error.status >= 400 &&
      error.status <= 599
        ? error.status
        : 502;

    return response.status(status).json({
      error: error?.status
        ? error.message
        : "Mapbox 보행 경로 요청 중 서버 오류가 발생했습니다."
    });
  }
};
