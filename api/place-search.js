const MAPBOX_SEARCHBOX_BASE_URL =
  'https://api.mapbox.com/search/searchbox/v1';

const MAPBOX_GEOCODING_BASE_URL =
  'https://api.mapbox.com/search/geocode/v6';

const PUBLIC_MAPBOX_FALLBACK_TOKEN = [
  'pk.',
  'eyJ1IjoiZnJlZXJ1bnRyaXAiLCJhIjoiY21zbXN1MW52MG82ZjM0cHZuaDV1ZGduZSJ9',
  '.dVLnvYx-HQirD4OBzHBgHQ',
].join('');

const COUNTRY_LANGUAGE_MAP = {
  KR: 'ko',
  JP: 'ja',
  DE: 'de',
  US: 'en',
  CA: 'en',
  GB: 'en',
  AU: 'en',
};

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

function normalizeCountryCode(value) {
  const countryCode = String(value || '')
    .trim()
    .toUpperCase();

  return /^[A-Z]{2}$/.test(countryCode)
    ? countryCode
    : '';
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

function detectQueryScript(query) {
  const text = String(query || '');

  if (/[가-힣ㄱ-ㅎㅏ-ㅣ]/u.test(text)) {
    return 'ko';
  }

  if (/[ぁ-ゖァ-ヺ一-龯]/u.test(text)) {
    return 'ja';
  }

  return 'latin';
}

function getHeader(request, name) {
  if (!request?.headers) {
    return '';
  }

  if (typeof request.headers.get === 'function') {
    return request.headers.get(name) || '';
  }

  const lowerName = name.toLowerCase();

  return (
    request.headers[name] ||
    request.headers[lowerName] ||
    ''
  );
}

function getRequestLocationContext(request) {
  const countryCode = normalizeCountryCode(
    getHeader(request, 'x-vercel-ip-country')
  );

  const latitude = Number(
    getHeader(request, 'x-vercel-ip-latitude')
  );

  const longitude = Number(
    getHeader(request, 'x-vercel-ip-longitude')
  );

  return {
    countryCode,
    language:
      COUNTRY_LANGUAGE_MAP[countryCode] || '',
    proximity:
      Number.isFinite(latitude) &&
      Number.isFinite(longitude)
        ? {
            latitude,
            longitude,
          }
        : null,
  };
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
    .filter((value, index, array) =>
      array.indexOf(value) === index
    )
    .join(', ');
}

function getMapboxFeatureAddress(properties = {}) {
  return (
    properties.full_address ||
    properties.address ||
    [
      properties.name,
      properties.place_formatted,
    ]
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

  const poiCategories = Array.isArray(
    properties.poi_category
  )
    ? properties.poi_category.filter(Boolean)
    : [];

  const countryCode = normalizeCountryCode(
    properties.context?.country?.country_code ||
    properties.country_code ||
    ''
  );

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
      Array.isArray(
        properties.coordinates?.routable_points
      )
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
    properties.feature_type ||
    feature.id?.split('.')?.[0] ||
    ''
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
      secondaryText === primaryText
        ? ''
        : secondaryText,
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
    countryCode: normalizeCountryCode(
      context.country?.country_code ||
      properties.country_code ||
      ''
    ),
    regionCode: String(
      context.region?.region_code || ''
    ),
    maki: '',
    mapboxId: String(properties.mapbox_id || ''),
    routablePoints:
      Array.isArray(
        properties.coordinates?.routable_points
      )
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
  const toRadians = (value) =>
    value * Math.PI / 180;

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
  const primary = normalizeSearchText(
    place?.primaryText
  );
  const secondary = normalizeSearchText(
    place?.secondaryText
  );
  const address = normalizeSearchText(
    place?.address
  );

  const combined =
    `${primary} ${secondary} ${address}`.trim();

  if (!normalizedQuery || !combined) return 0;

  let score = 0;

  if (primary === normalizedQuery) score += 6000;
  if (combined.includes(normalizedQuery)) score += 2400;
  if (primary.startsWith(normalizedQuery)) score += 1600;

  let matchedTokens = 0;

  queryTokens.forEach((token) => {
    if (combined.includes(token)) {
      matchedTokens += 1;
    }
  });

  score += matchedTokens * 500;

  if (
    queryTokens.length > 0 &&
    matchedTokens === queryTokens.length
  ) {
    score += 1200;
  }

  if (place?.resultType === 'poi') {
    score += 400;
  }

  if (place?.source === 'mapbox-searchbox') {
    score += 180;
  }

  return score;
}

function dedupePlaces(places, query) {
  const deduped = new Map();

  places.forEach((place) => {
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

  return Array.from(deduped.values());
}

function mergeAndRankPlaces({
  query,
  groups,
  anchorPlace,
  preferredCountryCode,
  localContext,
  limit = 10,
}) {
  const places = dedupePlaces(
    groups.flat().filter(Boolean),
    query
  );

  return places
    .map((place) => {
      let score = getTextMatchScore(query, place);

      if (
        preferredCountryCode &&
        place.countryCode === preferredCountryCode
      ) {
        score += 5200;
      }

      if (anchorPlace) {
        const anchorDistance = getDistanceMeters(
          place,
          anchorPlace
        );

        if (Number.isFinite(anchorDistance)) {
          if (anchorDistance <= 5000) {
            score += 5000;
          } else if (anchorDistance <= 30000) {
            score += 3400;
          } else if (anchorDistance <= 100000) {
            score += 2200;
          } else if (anchorDistance <= 250000) {
            score += 900;
          }
        }
      }

      if (
        !anchorPlace &&
        localContext?.countryCode &&
        place.countryCode === localContext.countryCode
      ) {
        score += 1600;
      }

      if (
        !anchorPlace &&
        localContext?.proximity
      ) {
        const localDistance = getDistanceMeters(
          place,
          localContext.proximity
        );

        if (Number.isFinite(localDistance)) {
          if (localDistance <= 5000) score += 1200;
          else if (localDistance <= 30000) score += 700;
          else if (localDistance <= 150000) score += 250;
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

async function requestSearchBoxForward({
  query,
  language,
  accessToken,
  proximity,
  countryCode,
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

  if (
    proximity &&
    Number.isFinite(
      Number(proximity.longitude)
    ) &&
    Number.isFinite(
      Number(proximity.latitude)
    )
  ) {
    mapboxUrl.searchParams.set(
      'proximity',
      `${Number(proximity.longitude)},${Number(proximity.latitude)}`
    );
  }

  if (normalizeCountryCode(countryCode)) {
    mapboxUrl.searchParams.set(
      'country',
      normalizeCountryCode(countryCode)
    );
  }

  return fetchJson(mapboxUrl);
}

async function requestGeocodingForward({
  query,
  language,
  accessToken,
  proximity,
  countryCode,
  types,
}) {
  const mapboxUrl = new URL(
    `${MAPBOX_GEOCODING_BASE_URL}/forward`
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
    'autocomplete',
    'false'
  );
  mapboxUrl.searchParams.set(
    'permanent',
    'false'
  );

  if (
    proximity &&
    Number.isFinite(
      Number(proximity.longitude)
    ) &&
    Number.isFinite(
      Number(proximity.latitude)
    )
  ) {
    mapboxUrl.searchParams.set(
      'proximity',
      `${Number(proximity.longitude)},${Number(proximity.latitude)}`
    );
  }

  if (normalizeCountryCode(countryCode)) {
    mapboxUrl.searchParams.set(
      'country',
      normalizeCountryCode(countryCode)
    );
  }

  if (types) {
    mapboxUrl.searchParams.set(
      'types',
      types
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
  mapboxUrl.searchParams.set(
    'permanent',
    'false'
  );

  return fetchJson(mapboxUrl);
}

function getAnchorCandidateQueries(query) {
  const normalized = String(query || '')
    .trim()
    .replace(/\s+/g, ' ');

  const tokens = normalized
    .split(' ')
    .filter(Boolean);

  if (tokens.length < 2) {
    return [];
  }

  const suffixWords = new Set([
    'station',
    'gate',
    'park',
    'airport',
    'terminal',
    'museum',
    'tower',
    'bridge',
    'square',
    'palace',
    'temple',
    'shrine',
    'hotel',
    'mall',
    'center',
    'centre',
  ]);

  const lastToken = normalizeSearchText(
    tokens[tokens.length - 1]
  );

  const candidates = [];

  if (suffixWords.has(lastToken)) {
    const leading = tokens
      .slice(0, -1)
      .join(' ')
      .trim();

    if (leading) {
      candidates.push(leading);
    }
  }

  if (tokens.length >= 2) {
    candidates.push(tokens[0]);
  }

  if (tokens.length >= 3) {
    candidates.push(
      tokens.slice(0, 2).join(' ')
    );
  }

  return [...new Set(candidates)]
    .filter((value) =>
      normalizeSearchText(value) !==
      normalizeSearchText(query)
    );
}

function chooseBestAdministrativeAnchor(
  query,
  places
) {
  if (!Array.isArray(places)) {
    return null;
  }

  const allowedTypes = new Set([
    'place',
    'city',
    'locality',
    'district',
    'region',
    'country',
  ]);

  const ranked = places
    .filter((place) =>
      allowedTypes.has(place.resultType)
    )
    .map((place) => ({
      place,
      score:
        getTextMatchScore(query, place) +
        (place.resultType === 'place' ||
        place.resultType === 'city'
          ? 1000
          : 0),
    }))
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.place || null;
}

async function discoverQueryAnchor({
  query,
  requestedLanguage,
  accessToken,
}) {
  const candidates =
    getAnchorCandidateQueries(query);

  if (candidates.length === 0) {
    return null;
  }

  const languages = [
    normalizeLanguage(requestedLanguage),
    'en',
    'ja',
    'de',
  ].filter(
    (value, index, array) =>
      array.indexOf(value) === index
  );

  for (const candidate of candidates) {
    for (const language of languages) {
      const result =
        await requestGeocodingForward({
          query: candidate,
          language,
          accessToken,
          proximity: null,
          countryCode: '',
          types:
            'place,locality,district,region,country',
        });

      if (!result.ok) {
        continue;
      }

      const places = normalizeFeatures(
        result.data?.features,
        normalizeGeocodingFeature
      );

      const anchor =
        chooseBestAdministrativeAnchor(
          candidate,
          places
        );

      if (anchor) {
        return anchor;
      }
    }
  }

  return null;
}

function getSearchStrategy({
  query,
  requestedLanguage,
  localContext,
  anchorPlace,
}) {
  const script = detectQueryScript(query);

  let preferredCountryCode = '';
  let searchLanguage =
    normalizeLanguage(requestedLanguage);

  if (anchorPlace?.countryCode) {
    preferredCountryCode =
      anchorPlace.countryCode;

    searchLanguage =
      COUNTRY_LANGUAGE_MAP[
        preferredCountryCode
      ] || searchLanguage;
  } else if (
    script === 'ko' &&
    localContext?.countryCode === 'KR'
  ) {
    preferredCountryCode = 'KR';
    searchLanguage = 'ko';
  } else if (script === 'ja') {
    preferredCountryCode = 'JP';
    searchLanguage = 'ja';
  }

  const proximity = anchorPlace
    ? {
        latitude: anchorPlace.latitude,
        longitude: anchorPlace.longitude,
      }
    : localContext?.proximity || null;

  return {
    script,
    preferredCountryCode,
    searchLanguage,
    proximity,
  };
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
        const aIndex = priority.indexOf(
          a.resultType
        );
        const bIndex = priority.indexOf(
          b.resultType
        );

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
        'Access-Control-Allow-Methods':
          'GET, OPTIONS',
        'Access-Control-Allow-Headers':
          'Content-Type',
      },
    });
  }

  if (request.method !== 'GET') {
    return jsonResponse(
      {
        error:
          '지원하지 않는 요청 방식이에요.',
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
        error:
          '검색어 또는 좌표를 입력해 주세요.',
        places: [],
      },
      400
    );
  }

  if (query.length > 256) {
    return jsonResponse(
      {
        error:
          '검색어는 256자 이하로 입력해 주세요.',
        places: [],
      },
      400
    );
  }

  const accessToken = getMapboxAccessToken();

  if (!accessToken) {
    return jsonResponse(
      {
        error:
          'Mapbox access token이 설정되지 않았어요.',
        places: [],
      },
      500
    );
  }

  if (isReverseGeocodeRequest) {
    try {
      const reverseResult =
        await requestGeocodingReverse({
          latitude,
          longitude,
          language,
          accessToken,
        });

      if (!reverseResult.ok) {
        console.error(
          'Mapbox Geocoding reverse error:',
          {
            status: reverseResult.status,
            data: reverseResult.data,
          }
        );

        return jsonResponse(
          {
            error:
              '현재 위치 주소를 찾지 못했어요.',
            place: null,
            mapboxStatus:
              reverseResult.status,
          },
          reverseResult.status || 500
        );
      }

      const places = normalizeFeatures(
        reverseResult.data?.features,
        normalizeGeocodingFeature
      );

      const normalizedPlace =
        getBestReversePlace(places);

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
          error:
            '현재 위치 주소 조회 중 문제가 발생했어요.',
          place: null,
        },
        500
      );
    }
  }

  try {
    const requestLocationContext =
      getRequestLocationContext(request);

    const explicitProximityLatitude = Number(
      proximityLatitudeParam
    );

    const explicitProximityLongitude = Number(
      proximityLongitudeParam
    );

    const explicitProximity =
      Number.isFinite(
        explicitProximityLatitude
      ) &&
      Number.isFinite(
        explicitProximityLongitude
      )
        ? {
            latitude:
              explicitProximityLatitude,
            longitude:
              explicitProximityLongitude,
          }
        : null;

    const localContext = {
      ...requestLocationContext,
      proximity:
        explicitProximity ||
        requestLocationContext.proximity,
    };

    const anchorPlace =
      await discoverQueryAnchor({
        query,
        requestedLanguage: language,
        accessToken,
      });

    const strategy = getSearchStrategy({
      query,
      requestedLanguage: language,
      localContext,
      anchorPlace,
    });

    const baseSearch =
      await requestSearchBoxForward({
        query,
        language:
          strategy.searchLanguage,
        accessToken,
        proximity:
          strategy.proximity,
        countryCode:
          strategy.preferredCountryCode,
      });

    const globalSearch =
      strategy.preferredCountryCode
        ? await requestSearchBoxForward({
            query,
            language,
            accessToken,
            proximity: null,
            countryCode: '',
          })
        : null;

    const geocodingResult =
      await requestGeocodingForward({
        query,
        language:
          strategy.searchLanguage,
        accessToken,
        proximity:
          strategy.proximity,
        countryCode:
          strategy.preferredCountryCode,
        types: '',
      });

    const basePlaces = baseSearch.ok
      ? normalizeFeatures(
          baseSearch.data?.features,
          normalizeMapboxSearchFeature
        )
      : [];

    const globalPlaces =
      globalSearch?.ok
        ? normalizeFeatures(
            globalSearch.data?.features,
            normalizeMapboxSearchFeature
          )
        : [];

    const geocodingPlaces =
      geocodingResult.ok
        ? normalizeFeatures(
            geocodingResult.data?.features,
            normalizeGeocodingFeature
          )
        : [];

    const places = mergeAndRankPlaces({
      query,
      groups: [
        basePlaces,
        globalPlaces,
        geocodingPlaces,
      ],
      anchorPlace,
      preferredCountryCode:
        strategy.preferredCountryCode,
      localContext,
      limit: 10,
    });

    return jsonResponse({
      places,
      provider:
        'mapbox-context-search-v3',
      language,
      searchSources: {
        mapboxSearchBox: true,
        mapboxTemporaryGeocoding: true,
      },
      debug: {
        queryScript: strategy.script,
        requestedLanguage: language,
        searchLanguage:
          strategy.searchLanguage,
        preferredCountryCode:
          strategy.preferredCountryCode,
        localCountryCode:
          localContext.countryCode || '',
        anchor:
          anchorPlace
            ? {
                primaryText:
                  anchorPlace.primaryText,
                countryCode:
                  anchorPlace.countryCode,
                latitude:
                  anchorPlace.latitude,
                longitude:
                  anchorPlace.longitude,
              }
            : null,
      },
    });
  } catch (error) {
    console.error(
      'Mapbox context place search server error:',
      error
    );

    return jsonResponse(
      {
        error:
          '장소 검색 중 문제가 발생했어요.',
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

  const webRequest = new Request(
    absoluteUrl,
    {
      method: request.method || 'GET',
      headers: request.headers || {},
    }
  );

  const webResponse =
    await handleFetchRequest(webRequest);

  const body = await webResponse.text();

  webResponse.headers.forEach(
    (value, key) => {
      response.setHeader(key, value);
    }
  );

  response.status(webResponse.status);
  response.send(body);
}
