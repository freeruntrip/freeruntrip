const MAPBOX_SEARCHBOX_BASE_URL =
  'https://api.mapbox.com/search/searchbox/v1';

const PUBLIC_MAPBOX_FALLBACK_TOKEN = [
  'pk.',
  'eyJ1IjoiZnJlZXJ1bnRyaXAiLCJhIjoiY21zbXN1MW52MG82ZjM0cHZuaDV1ZGduZSJ9',
  '.dVLnvYx-HQirD4OBzHBgHQ',
].join('');

function jsonResponse(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

function getMapboxAccessToken() {
  return (
    process.env.MAPBOX_ACCESS_TOKEN ||
    process.env.MAPBOX_PUBLIC_ACCESS_TOKEN ||
    PUBLIC_MAPBOX_FALLBACK_TOKEN
  );
}

function normalizeLanguage(value) {
  const language = String(value || '')
    .trim()
    .toLowerCase();

  if (!language) {
    return 'ko';
  }

  if (language.startsWith('ko')) return 'ko';
  if (language.startsWith('en')) return 'en';
  if (language.startsWith('ja')) return 'ja';
  if (language.startsWith('de')) return 'de';

  return language.slice(0, 2) || 'en';
}

function getFeatureCoordinates(feature) {
  const properties = feature?.properties || {};
  const propertyCoordinates = properties?.coordinates || {};

  const longitude = Number(
    propertyCoordinates.longitude ??
    feature?.geometry?.coordinates?.[0]
  );

  const latitude = Number(
    propertyCoordinates.latitude ??
    feature?.geometry?.coordinates?.[1]
  );

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  return {
    latitude,
    longitude,
  };
}

function getContextText(context = {}) {
  return [
    context.neighborhood?.name,
    context.locality?.name,
    context.place?.name,
    context.city?.name,
    context.district?.name,
    context.region?.name,
    context.postcode?.name,
    context.country?.name,
  ]
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index)
    .join(', ');
}

function getMapboxFeatureAddress(properties = {}) {
  return (
    properties.full_address ||
    properties.address ||
    [
      properties.name,
      properties.place_formatted,
    ].filter(Boolean).join(', ') ||
    ''
  );
}

function getSecondaryText(properties = {}) {
  const featureType = String(
    properties.feature_type || ''
  ).toLowerCase();

  if (featureType === 'poi') {
    return (
      properties.full_address ||
      properties.address ||
      properties.place_formatted ||
      getContextText(properties.context)
    );
  }

  return (
    properties.place_formatted ||
    getContextText(properties.context) ||
    properties.full_address ||
    ''
  );
}

function normalizeMapboxFeature(feature) {
  if (!feature || feature.type !== 'Feature') {
    return null;
  }

  const properties = feature.properties || {};
  const coordinates = getFeatureCoordinates(feature);

  if (!coordinates) {
    return null;
  }

  const name = String(
    properties.name_preferred ||
    properties.name ||
    properties.full_address ||
    ''
  ).trim();

  const address = String(
    getMapboxFeatureAddress(properties)
  ).trim();

  const featureType = String(
    properties.feature_type || ''
  ).trim();

  const poiCategories = Array.isArray(
    properties.poi_category
  )
    ? properties.poi_category.filter(Boolean)
    : [];

  const countryCode = String(
    properties.context?.country?.country_code || ''
  ).toUpperCase();

  const regionCode = String(
    properties.context?.region?.region_code || ''
  );

  const primaryText = name || address;
  const secondaryText = String(
    getSecondaryText(properties)
  ).trim();

  return {
    id: String(
      properties.mapbox_id ||
      feature.id ||
      `${coordinates.longitude}-${coordinates.latitude}`
    ),

    name: primaryText,
    displayName: primaryText,
    primaryText,
    secondaryText:
      secondaryText === primaryText
        ? ''
        : secondaryText,

    address,

    /*
      기존 앱/저장 데이터와의 하위 호환성을 위해 필드를 유지한다.
      Mapbox는 한국 Kakao식 도로명/지번을 별도 필드로 보장하지 않으므로
      새 검색 결과에서는 공통 address를 사용한다.
    */
    roadAddress: address,
    lotAddress: '',
    buildingName:
      featureType === 'poi'
        ? primaryText
        : '',

    latitude: coordinates.latitude,
    longitude: coordinates.longitude,

    category:
      poiCategories.join(' · ') ||
      featureType,

    categoryGroupCode: '',
    categoryGroupName: '',

    resultType: featureType || 'place',
    source: 'mapbox-searchbox',

    language: String(properties.language || ''),
    countryCode,
    regionCode,
    maki: String(properties.maki || ''),

    mapboxId: String(properties.mapbox_id || ''),
    routablePoints:
      Array.isArray(properties.coordinates?.routable_points)
        ? properties.coordinates.routable_points
        : [],
  };
}

function normalizeMapboxFeatures(features = []) {
  return features
    .map(normalizeMapboxFeature)
    .filter(Boolean);
}

async function requestMapboxForwardSearch({
  query,
  language,
  accessToken,
  proximity,
}) {
  const mapboxUrl = new URL(
    `${MAPBOX_SEARCHBOX_BASE_URL}/forward`
  );

  mapboxUrl.searchParams.set('q', query);
  mapboxUrl.searchParams.set(
    'access_token',
    accessToken
  );
  mapboxUrl.searchParams.set(
    'language',
    normalizeLanguage(language)
  );
  mapboxUrl.searchParams.set('limit', '10');
  mapboxUrl.searchParams.set(
    'auto_complete',
    'true'
  );

  /*
    글로벌 검색을 국가 하나로 제한하지 않는다.
    GPS/지도 중심 좌표가 프런트에서 넘어오면 가까운 결과를 우선하고,
    없으면 Mapbox 기본 proximity(IP 기반)를 사용한다.
  */
  if (
    proximity &&
    Number.isFinite(proximity.longitude) &&
    Number.isFinite(proximity.latitude)
  ) {
    mapboxUrl.searchParams.set(
      'proximity',
      `${proximity.longitude},${proximity.latitude}`
    );
  }

  const response = await fetch(mapboxUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  const data = await response
    .json()
    .catch(() => ({}));

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

async function requestMapboxReverseSearch({
  latitude,
  longitude,
  language,
  accessToken,
}) {
  const mapboxUrl = new URL(
    `${MAPBOX_SEARCHBOX_BASE_URL}/reverse`
  );

  mapboxUrl.searchParams.set(
    'longitude',
    String(longitude)
  );
  mapboxUrl.searchParams.set(
    'latitude',
    String(latitude)
  );
  mapboxUrl.searchParams.set(
    'access_token',
    accessToken
  );
  mapboxUrl.searchParams.set(
    'language',
    normalizeLanguage(language)
  );
  mapboxUrl.searchParams.set('limit', '5');

  const response = await fetch(mapboxUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  const data = await response
    .json()
    .catch(() => ({}));

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

function getBestReversePlace(places) {
  if (!Array.isArray(places) || places.length === 0) {
    return null;
  }

  const priority = [
    'address',
    'poi',
    'street',
    'neighborhood',
    'locality',
    'place',
    'city',
    'district',
    'region',
    'country',
  ];

  return (
    places
      .slice()
      .sort(function (a, b) {
        return (
          priority.indexOf(a.resultType) -
          priority.indexOf(b.resultType)
        );
      })[0] ||
    places[0]
  );
}

async function handleFetchRequest(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method !== 'GET') {
    return jsonResponse(
      {
        error: '지원하지 않는 요청 방식이에요.',
        places: [],
      },
      405
    );
  }

  const url = new URL(request.url);

  const query =
    url.searchParams.get('q')?.trim() || '';

  const language = normalizeLanguage(
    url.searchParams.get('language') ||
    url.searchParams.get('lang') ||
    'ko'
  );

  const latitudeParam =
    url.searchParams.get('lat');

  const longitudeParam =
    url.searchParams.get('lng');

  const proximityLatitudeParam =
    url.searchParams.get('proximityLat');

  const proximityLongitudeParam =
    url.searchParams.get('proximityLng');

  const hasReverseGeocodeParams =
    latitudeParam !== null &&
    longitudeParam !== null &&
    latitudeParam.trim() !== '' &&
    longitudeParam.trim() !== '';

  const latitude = hasReverseGeocodeParams
    ? Number(latitudeParam)
    : NaN;

  const longitude = hasReverseGeocodeParams
    ? Number(longitudeParam)
    : NaN;

  const isReverseGeocodeRequest =
    hasReverseGeocodeParams &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);

  if (!query && !isReverseGeocodeRequest) {
    return jsonResponse(
      {
        error: '검색어 또는 좌표를 입력해 주세요.',
        places: [],
      },
      400
    );
  }

  if (query.length > 256) {
    return jsonResponse(
      {
        error: '검색어는 256자 이하로 입력해 주세요.',
        places: [],
      },
      400
    );
  }

  const accessToken = getMapboxAccessToken();

  if (!accessToken) {
    return jsonResponse(
      {
        error: 'Mapbox access token이 설정되지 않았어요.',
        places: [],
      },
      500
    );
  }

  if (isReverseGeocodeRequest) {
    try {
      const reverseResult =
        await requestMapboxReverseSearch({
          latitude,
          longitude,
          language,
          accessToken,
        });

      if (!reverseResult.ok) {
        console.error(
          'Mapbox reverse search error:',
          {
            status: reverseResult.status,
            data: reverseResult.data,
          }
        );

        return jsonResponse(
          {
            error: '현재 위치 주소를 찾지 못했어요.',
            place: null,
            mapboxStatus: reverseResult.status,
          },
          reverseResult.status || 500
        );
      }

      const places = normalizeMapboxFeatures(
        Array.isArray(reverseResult.data?.features)
          ? reverseResult.data.features
          : []
      );

      const normalizedPlace =
        getBestReversePlace(places);

      if (!normalizedPlace) {
        return jsonResponse({
          place: null,
        });
      }

      /* 실제 GPS 좌표를 출발 좌표로 사용한다. */
      normalizedPlace.latitude = latitude;
      normalizedPlace.longitude = longitude;
      normalizedPlace.isCurrentLocation = true;

      return jsonResponse({
        place: normalizedPlace,
        provider: 'mapbox-searchbox',
      });
    } catch (error) {
      console.error(
        'Mapbox reverse search server error:',
        error
      );

      return jsonResponse(
        {
          error: '현재 위치 주소 조회 중 문제가 발생했어요.',
          place: null,
        },
        500
      );
    }
  }

  try {
    const proximityLatitude = Number(
      proximityLatitudeParam
    );

    const proximityLongitude = Number(
      proximityLongitudeParam
    );

    const searchResult =
      await requestMapboxForwardSearch({
        query,
        language,
        accessToken,
        proximity:
          Number.isFinite(proximityLatitude) &&
          Number.isFinite(proximityLongitude)
            ? {
                latitude: proximityLatitude,
                longitude: proximityLongitude,
              }
            : null,
      });

    if (!searchResult.ok) {
      console.error(
        'Mapbox place search error:',
        {
          status: searchResult.status,
          data: searchResult.data,
        }
      );

      return jsonResponse(
        {
          error: 'Mapbox 장소 검색에 실패했어요.',
          mapboxStatus: searchResult.status,
          mapboxMessage:
            searchResult.data?.message ||
            'Mapbox에서 자세한 오류 메시지를 보내지 않았어요.',
          places: [],
        },
        searchResult.status || 500
      );
    }

    const places = normalizeMapboxFeatures(
      Array.isArray(searchResult.data?.features)
        ? searchResult.data.features
        : []
    ).slice(0, 10);

    return jsonResponse({
      places,
      provider: 'mapbox-searchbox',
      language,
      searchSources: {
        mapboxSearchBox: true,
      },
    });
  } catch (error) {
    console.error(
      'Mapbox place search server error:',
      error
    );

    return jsonResponse(
      {
        error: '장소 검색 중 문제가 발생했어요.',
        places: [],
      },
      500
    );
  }
}

export default async function handler(
  request,
  response
) {
  /* Vercel Node API와 Web Fetch 런타임을 모두 지원한다. */
  if (
    !response &&
    typeof Request !== 'undefined' &&
    request instanceof Request
  ) {
    return handleFetchRequest(request);
  }

  const protocol =
    request.headers?.['x-forwarded-proto'] ||
    'https';

  const host =
    request.headers?.host ||
    'freeruntrip.vercel.app';

  const absoluteUrl = new URL(
    request.url || '/api/place-search',
    `${protocol}://${host}`
  );

  const webRequest = new Request(absoluteUrl, {
    method: request.method || 'GET',
    headers: request.headers || {},
  });

  const webResponse =
    await handleFetchRequest(webRequest);

  const body = await webResponse.text();

  webResponse.headers.forEach(
    function (value, key) {
      response.setHeader(key, value);
    }
  );

  response.status(webResponse.status);
  response.send(body);
}
