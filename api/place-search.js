const MAPBOX_SEARCHBOX_BASE_URL =
  'https://api.mapbox.com/search/searchbox/v1';

const MAPBOX_GEOCODING_BASE_URL =
  'https://api.mapbox.com/search/geocode/v6';

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

  if (!language) return 'ko';
  if (language.startsWith('ko')) return 'ko';
  if (language.startsWith('en')) return 'en';
  if (language.startsWith('ja')) return 'ja';
  if (language.startsWith('de')) return 'de';

  return language.slice(0, 2) || 'en';
}

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ');
}

function tokenizeSearchText(value) {
  return normalizeSearchText(value)
    .split(' ')
    .filter(Boolean);
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

  return { latitude, longitude };
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
    [properties.name, properties.place_formatted]
      .filter(Boolean)
      .join(', ') ||
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

function normalizeMapboxSearchFeature(feature) {
  if (!feature || feature.type !== 'Feature') {
    return null;
  }

  const properties = feature.properties || {};
  const coordinates = getFeatureCoordinates(feature);

  if (!coordinates) return null;

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

  const poiCategories = Array.isArray(properties.poi_category)
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
      secondaryText === primaryText ? '' : secondaryText,
    address,
    roadAddress: address,
    lotAddress: '',
    buildingName:
      featureType === 'poi' ? primaryText : '',
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    category:
      poiCategories.join(' · ') || featureType,
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

function normalizeGeocodingFeature(feature) {
  if (!feature || feature.type !== 'Feature') {
    return null;
  }

  const properties = feature.properties || {};
  const coordinates = getFeatureCoordinates(feature);

  if (!coordinates) return null;

  const featureType = String(
    properties.feature_type || feature.id?.split('.')?.[0] || ''
  ).trim();

  const context = properties.context || {};
  const name = String(
    properties.name_preferred ||
    properties.name ||
    properties.full_address ||
    ''
  ).trim();

  const address = String(
    properties.full_address ||
    properties.place_formatted ||
    name ||
    ''
  ).trim();

  const primaryText = name || address;
  const secondaryText = String(
    properties.place_formatted ||
    getContextText(context) ||
    properties.full_address ||
    ''
  ).trim();

  return {
    id: String(
      properties.mapbox_id ||
      feature.id ||
      `geocode-${coordinates.longitude}-${coordinates.latitude}`
    ),
    name: primaryText,
    displayName: primaryText,
    primaryText,
    secondaryText:
      secondaryText === primaryText ? '' : secondaryText,
    address,
    roadAddress: address,
    lotAddress: '',
    buildingName: '',
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    category: featureType || 'geocode',
    categoryGroupCode: '',
    categoryGroupName: '',
    resultType: featureType || 'place',
    source: 'mapbox-geocoding',
    language: String(properties.language || ''),
    countryCode: String(
      context.country?.country_code || ''
    ).toUpperCase(),
    regionCode: String(
      context.region?.region_code || ''
    ),
    maki: '',
    mapboxId: String(properties.mapbox_id || ''),
    routablePoints:
      Array.isArray(properties.coordinates?.routable_points)
        ? properties.coordinates.routable_points
        : [],
  };
}

function normalizeFeatures(features, normalizer) {
  return (Array.isArray(features) ? features : [])
    .map(normalizer)
    .filter(Boolean);
}

function getDistanceMeters(first, second) {
  if (!first || !second) return Infinity;

  const lat1 = Number(first.latitude);
  const lon1 = Number(first.longitude);
  const lat2 = Number(second.latitude);
  const lon2 = Number(second.longitude);

  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lon1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lon2)
  ) {
    return Infinity;
  }

  const radius = 6371000;
  const toRadians = (value) => value * Math.PI / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * radius * Math.atan2(
    Math.sqrt(a),
    Math.sqrt(1 - a)
  );
}

function getTextMatchScore(query, place) {
  const normalizedQuery = normalizeSearchText(query);
  const queryTokens = tokenizeSearchText(query);
  const primary = normalizeSearchText(place?.primaryText);
  const secondary = normalizeSearchText(place?.secondaryText);
  const address = normalizeSearchText(place?.address);
  const combined = `${primary} ${secondary} ${address}`.trim();

  if (!normalizedQuery || !combined) return 0;

  let score = 0;

  if (primary === normalizedQuery) score += 5000;
  if (combined.includes(normalizedQuery)) score += 2200;
  if (primary.startsWith(normalizedQuery)) score += 1400;

  let matchedTokens = 0;
  queryTokens.forEach((token) => {
    if (combined.includes(token)) matchedTokens += 1;
  });

  score += matchedTokens * 420;

  if (
    queryTokens.length > 0 &&
    matchedTokens === queryTokens.length
  ) {
    score += 900;
  }

  if (place?.resultType === 'poi') score += 250;
  if (place?.source === 'mapbox-searchbox') score += 120;

  return score;
}

function mergeAndRankPlaces({
  query,
  groups,
  anchorPlace,
  proximity,
  limit = 10,
}) {
  const deduped = new Map();

  groups.flat().forEach((place) => {
    if (!place) return;

    const key = place.mapboxId
      ? `id:${place.mapboxId}`
      : [
          normalizeSearchText(place.primaryText),
          Number(place.latitude).toFixed(5),
          Number(place.longitude).toFixed(5),
        ].join('|');

    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, place);
      return;
    }

    if (
      getTextMatchScore(query, place) >
      getTextMatchScore(query, existing)
    ) {
      deduped.set(key, place);
    }
  });

  return Array.from(deduped.values())
    .map((place) => {
      let score = getTextMatchScore(query, place);

      if (anchorPlace) {
        const anchorDistance = getDistanceMeters(
          place,
          anchorPlace
        );

        if (Number.isFinite(anchorDistance)) {
          if (anchorDistance <= 5000) score += 1200;
          else if (anchorDistance <= 30000) score += 700;
          else if (anchorDistance <= 150000) score += 250;
        }
      }

      if (proximity) {
        const proximityDistance = getDistanceMeters(
          place,
          proximity
        );

        if (Number.isFinite(proximityDistance)) {
          if (proximityDistance <= 5000) score += 350;
          else if (proximityDistance <= 30000) score += 180;
        }
      }

      return { place, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.place);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  const data = await response.json().catch(() => ({}));

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

async function requestSearchBoxForward({
  query,
  language,
  accessToken,
  proximity,
}) {
  const mapboxUrl = new URL(
    `${MAPBOX_SEARCHBOX_BASE_URL}/forward`
  );

  mapboxUrl.searchParams.set('q', query);
  mapboxUrl.searchParams.set('access_token', accessToken);
  mapboxUrl.searchParams.set('language', normalizeLanguage(language));
  mapboxUrl.searchParams.set('limit', '10');
  mapboxUrl.searchParams.set('auto_complete', 'true');

  if (
    proximity &&
    Number.isFinite(Number(proximity.longitude)) &&
    Number.isFinite(Number(proximity.latitude))
  ) {
    mapboxUrl.searchParams.set(
      'proximity',
      `${Number(proximity.longitude)},${Number(proximity.latitude)}`
    );
  }

  return fetchJson(mapboxUrl);
}

async function requestGeocodingForward({
  query,
  language,
  accessToken,
  proximity,
}) {
  const mapboxUrl = new URL(
    `${MAPBOX_GEOCODING_BASE_URL}/forward`
  );

  mapboxUrl.searchParams.set('q', query);
  mapboxUrl.searchParams.set('access_token', accessToken);
  mapboxUrl.searchParams.set('language', normalizeLanguage(language));
  mapboxUrl.searchParams.set('limit', '10');
  mapboxUrl.searchParams.set('autocomplete', 'false');
  mapboxUrl.searchParams.set('permanent', 'false');

  if (
    proximity &&
    Number.isFinite(Number(proximity.longitude)) &&
    Number.isFinite(Number(proximity.latitude))
  ) {
    mapboxUrl.searchParams.set(
      'proximity',
      `${Number(proximity.longitude)},${Number(proximity.latitude)}`
    );
  }

  return fetchJson(mapboxUrl);
}

async function requestGeocodingReverse({
  latitude,
  longitude,
  language,
  accessToken,
}) {
  const mapboxUrl = new URL(
    `${MAPBOX_GEOCODING_BASE_URL}/reverse`
  );

  mapboxUrl.searchParams.set('longitude', String(longitude));
  mapboxUrl.searchParams.set('latitude', String(latitude));
  mapboxUrl.searchParams.set('access_token', accessToken);
  mapboxUrl.searchParams.set('language', normalizeLanguage(language));
  mapboxUrl.searchParams.set('limit', '5');
  mapboxUrl.searchParams.set('permanent', 'false');

  return fetchJson(mapboxUrl);
}

function chooseAnchorPlace(query, geocodingPlaces) {
  if (!Array.isArray(geocodingPlaces)) return null;

  const ranked = geocodingPlaces
    .map((place) => ({
      place,
      score: getTextMatchScore(query, place),
    }))
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.place || null;
}

function getSearchLanguages(requestedLanguage) {
  const languages = [
    normalizeLanguage(requestedLanguage),
    'en',
    'ja',
    'de',
  ];

  return [...new Set(languages)];
}

function getBestReversePlace(places) {
  if (!Array.isArray(places) || places.length === 0) {
    return null;
  }

  const priority = [
    'address',
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
      .sort((a, b) => {
        const aIndex = priority.indexOf(a.resultType);
        const bIndex = priority.indexOf(b.resultType);
        return (
          (aIndex === -1 ? 999 : aIndex) -
          (bIndex === -1 ? 999 : bIndex)
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
  const query = url.searchParams.get('q')?.trim() || '';

  const language = normalizeLanguage(
    url.searchParams.get('language') ||
    url.searchParams.get('lang') ||
    'ko'
  );

  const latitudeParam = url.searchParams.get('lat');
  const longitudeParam = url.searchParams.get('lng');
  const proximityLatitudeParam = url.searchParams.get('proximityLat');
  const proximityLongitudeParam = url.searchParams.get('proximityLng');

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
      const reverseResult = await requestGeocodingReverse({
        latitude,
        longitude,
        language,
        accessToken,
      });

      if (!reverseResult.ok) {
        console.error('Mapbox Geocoding reverse error:', {
          status: reverseResult.status,
          data: reverseResult.data,
        });

        return jsonResponse(
          {
            error: '현재 위치 주소를 찾지 못했어요.',
            place: null,
            mapboxStatus: reverseResult.status,
          },
          reverseResult.status || 500
        );
      }

      const places = normalizeFeatures(
        reverseResult.data?.features,
        normalizeGeocodingFeature
      );

      const normalizedPlace = getBestReversePlace(places);

      if (!normalizedPlace) {
        return jsonResponse({ place: null });
      }

      normalizedPlace.latitude = latitude;
      normalizedPlace.longitude = longitude;
      normalizedPlace.isCurrentLocation = true;

      return jsonResponse({
        place: normalizedPlace,
        provider: 'mapbox-geocoding',
      });
    } catch (error) {
      console.error(
        'Mapbox reverse geocoding server error:',
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
    const proximityLatitude = Number(proximityLatitudeParam);
    const proximityLongitude = Number(proximityLongitudeParam);

    const proximity =
      Number.isFinite(proximityLatitude) &&
      Number.isFinite(proximityLongitude)
        ? {
            latitude: proximityLatitude,
            longitude: proximityLongitude,
          }
        : null;

    /*
      1) Temporary Geocoding으로 주소/도시/행정구역 문맥을 먼저 찾는다.
      2) 그 결과를 anchor로 사용해 Search Box POI 검색을 한 번 더 수행한다.
      3) 요청 언어 + en/ja/de 결과를 합치고 텍스트 일치도/anchor 거리로 재정렬한다.
      이 방식은 특정 국가를 하드코딩하지 않고도 글로벌 검색 랭킹을 보완한다.
    */
    const geocodingLanguageResults = await Promise.all(
      getSearchLanguages(language).map((searchLanguage) =>
        requestGeocodingForward({
          query,
          language: searchLanguage,
          accessToken,
          proximity,
        })
      )
    );

    const geocodingGroups = geocodingLanguageResults.map((result) =>
      result.ok
        ? normalizeFeatures(
            result.data?.features,
            normalizeGeocodingFeature
          )
        : []
    );

    const geocodingPlaces = geocodingGroups.flat();
    const anchorPlace = chooseAnchorPlace(query, geocodingPlaces);

    const searchLanguages = getSearchLanguages(language);

    const searchBoxBaseResults = await Promise.all(
      searchLanguages.map((searchLanguage) =>
        requestSearchBoxForward({
          query,
          language: searchLanguage,
          accessToken,
          proximity,
        })
      )
    );

    const searchBoxBaseGroups = searchBoxBaseResults.map((result) =>
      result.ok
        ? normalizeFeatures(
            result.data?.features,
            normalizeMapboxSearchFeature
          )
        : []
    );

    let anchoredSearchBoxGroups = [];

    if (anchorPlace) {
      const anchorProximity = {
        latitude: anchorPlace.latitude,
        longitude: anchorPlace.longitude,
      };

      const anchoredResults = await Promise.all(
        searchLanguages.map((searchLanguage) =>
          requestSearchBoxForward({
            query,
            language: searchLanguage,
            accessToken,
            proximity: anchorProximity,
          })
        )
      );

      anchoredSearchBoxGroups = anchoredResults.map((result) =>
        result.ok
          ? normalizeFeatures(
              result.data?.features,
              normalizeMapboxSearchFeature
            )
          : []
      );
    }

    const places = mergeAndRankPlaces({
      query,
      groups: [
        ...searchBoxBaseGroups,
        ...anchoredSearchBoxGroups,
        geocodingPlaces,
      ],
      anchorPlace,
      proximity,
      limit: 10,
    });

    return jsonResponse({
      places,
      provider: 'mapbox-hybrid-search-v2',
      language,
      searchSources: {
        mapboxSearchBox: true,
        mapboxTemporaryGeocoding: true,
      },
      debug: {
        anchor:
          anchorPlace
            ? {
                primaryText: anchorPlace.primaryText,
                countryCode: anchorPlace.countryCode,
                latitude: anchorPlace.latitude,
                longitude: anchorPlace.longitude,
              }
            : null,
      },
    });
  } catch (error) {
    console.error('Mapbox hybrid place search server error:', error);

    return jsonResponse(
      {
        error: '장소 검색 중 문제가 발생했어요.',
        places: [],
      },
      500
    );
  }
}

export default async function handler(request, response) {
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

  const webResponse = await handleFetchRequest(webRequest);
  const body = await webResponse.text();

  webResponse.headers.forEach((value, key) => {
    response.setHeader(key, value);
  });

  response.status(webResponse.status);
  response.send(body);
}
