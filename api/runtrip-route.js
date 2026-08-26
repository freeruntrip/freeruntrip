const MAPBOX_DIRECTIONS_BASE_URL =
  "https://api.mapbox.com/directions/v5/mapbox/walking";

/*
  FreeRunTrip 글로벌 RunTrip 라우팅 V1
  - TMAP 의존성을 제거하고 Mapbox Directions API의 walking profile 사용
  - 전체 경로 좌표 + turn-by-turn step + FreeRunTrip용 좌/우회전 구간을 반환
  - V1 경로 분할 기준은 명확한 modifier "left" / "right"만 사용
  - slight/sharp/uturn/roundabout/fork 등은 후속 야외 테스트 뒤 별도 규칙으로 확장
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
      bearingBefore: Number.isFinite(Number(step?.maneuver?.bearing_before))
        ? Number(step.maneuver.bearing_before)
        : null,
      bearingAfter: Number.isFinite(Number(step?.maneuver?.bearing_after))
        ? Number(step.maneuver.bearing_after)
        : null,
    },
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

function isFreeRunTripLeftRightTurn(step) {
  const maneuverType = String(
    step?.maneuver?.type || ""
  ).toLowerCase();

  const modifier = String(
    step?.maneuver?.modifier || ""
  ).toLowerCase();

  /*
    테스트 V1은 사용자가 정한 원칙대로 Mapbox의 명확한 turn maneuver 중
    정확히 left / right만 경로 분할점으로 사용한다.
    depart/arrive, slight/sharp, fork, uturn, roundabout는 의도적으로 제외한다.
  */
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
    /*
      Mapbox step.distance는 해당 step의 시작 maneuver 지점에서
      다음 maneuver 지점까지 이동하는 거리다.

      따라서 현재 step의 maneuver가 좌/우회전이면 그 지점이
      직전 FreeRunTrip 구간의 끝이다. 회전 이후의 step.distance는
      다음 구간에 포함되어야 하므로 먼저 구간을 닫고 누적한다.
    */
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
  mapboxUrl.searchParams.set("language", "ko");
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
    const navigationSegments =
      createFreeRunTripNavigationSegments(steps);

    return response.status(200).json({
      provider: "mapbox",
      profile: "mapbox/walking",
      coordinates: routeCoordinates,
      distanceMeters: Math.max(0, Number(route?.distance) || 0),
      durationSeconds: Math.max(0, Number(route?.duration) || 0),
      steps,
      navigationSegments,
    });
  } catch (error) {
    console.error("RunTrip Mapbox route server error:", error);

    return response.status(500).json({
      error: "Mapbox 보행 경로 요청 중 서버 오류가 발생했습니다.",
    });
  }
};
