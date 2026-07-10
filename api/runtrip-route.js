const TMAP_PEDESTRIAN_ROUTE_URL =
  "https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1";

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

function extractRouteCoordinates(features = []) {
  const coordinates = [];

  features.forEach((feature) => {
    if (feature?.geometry?.type !== "LineString") {
      return;
    }

    feature.geometry.coordinates.forEach(([lng, lat]) => {
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        coordinates.push([lat, lng]);
      }
    });
  });

  return coordinates;
}

function getRouteSummary(features = []) {
  const summaryFeature = features.find(
    (feature) =>
      feature?.properties &&
      Number.isFinite(Number(feature.properties.totalDistance))
  );

  return {
    distanceMeters: Number(summaryFeature?.properties?.totalDistance || 0),
    durationSeconds: Number(summaryFeature?.properties?.totalTime || 0),
  };
}

function buildPassList(waypoints = []) {
  return waypoints
    .filter(isValidCoordinate)
    .map((point) => `${Number(point.lng)},${Number(point.lat)}`)
    .join("_");
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

  const appKey = process.env.TMAP_APP_KEY;

  if (!appKey) {
    return response.status(500).json({
      error: "TMAP_APP_KEY 환경변수가 설정되지 않았습니다.",
    });
  }

  const {
    origin,
    destination,
    waypoints = [],
    originName = "출발지",
    destinationName = "도착지",
  } = request.body || {};

  if (!isValidCoordinate(origin) || !isValidCoordinate(destination)) {
    return response.status(400).json({
      error: "출발지와 도착지 좌표가 필요합니다.",
    });
  }

  if (!Array.isArray(waypoints) || waypoints.length > 5) {
    return response.status(400).json({
      error: "경유지는 최대 5개까지 사용할 수 있습니다.",
    });
  }

  const requestBody = {
    startX: String(Number(origin.lng)),
    startY: String(Number(origin.lat)),
    endX: String(Number(destination.lng)),
    endY: String(Number(destination.lat)),
    startName: originName,
    endName: destinationName,
    reqCoordType: "WGS84GEO",
    resCoordType: "WGS84GEO",
    searchOption: "0",
  };

  const passList = buildPassList(waypoints);

  if (passList) {
    requestBody.passList = passList;
  }

  try {
    const tmapResponse = await fetch(TMAP_PEDESTRIAN_ROUTE_URL, {
      method: "POST",
      headers: {
        appKey,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await tmapResponse.text();

    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
      data = null;
    }

    if (!tmapResponse.ok) {
      console.error("TMAP pedestrian route error:", {
        status: tmapResponse.status,
        body: responseText,
      });

      return response.status(tmapResponse.status).json({
        error:
          data?.error?.message ||
          data?.errorMessage ||
          "TMAP 보행 경로를 불러오지 못했습니다.",
      });
    }

    const features = Array.isArray(data?.features) ? data.features : [];
    const coordinates = extractRouteCoordinates(features);
    const summary = getRouteSummary(features);

    if (coordinates.length < 2) {
      return response.status(502).json({
        error: "TMAP 응답에서 경로 좌표를 찾지 못했습니다.",
      });
    }

    return response.status(200).json({
      coordinates,
      distanceMeters: summary.distanceMeters,
      durationSeconds: summary.durationSeconds,
    });
  } catch (error) {
    console.error("RunTrip route server error:", error);

    return response.status(500).json({
      error: "보행 경로 요청 중 서버 오류가 발생했습니다.",
    });
  }
};