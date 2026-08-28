const GOOGLE_PLACES_TEXT_SEARCH_URL =
  'https://places.googleapis.com/v1/places:searchText';

const GOOGLE_GEOCODING_REVERSE_URL =
  'https://maps.googleapis.com/maps/api/geocode/json';

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

function getGoogleMapsApiKey() {
  return String(
    process.env.GOOGLE_MAPS_API_KEY || ''
  ).trim();
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

function getRunTripIncludedTypeHint(query, language) {
  const text = String(query || '').trim();

  if (!text || normalizeLanguage(language) !== 'ko') {
    return '';
  }

  const compact = text.replace(/\s+/g, '');

  if (/역$/.test(compact)) {
    return 'transit_station';
  }

  if (/공원$/.test(compact)) {
    return 'park';
  }

  if (/공항$/.test(compact)) {
    return 'airport';
  }

  if (/병원$/.test(compact)) {
    return 'hospital';
  }

  if (/(대학교|대학)$/.test(compact)) {
    return 'university';
  }

  if (/박물관$/.test(compact)) {
    return 'museum';
  }

  if (/미술관$/.test(compact)) {
    return 'art_gallery';
  }

  return '';
}

function getHeader(request, name) {
  if (!request?.headers) {
    return '';
  }

  if (typeof request.headers.get === 'function') {
    return request.headers.get(name) || '';
  }

  const lowerName = String(name || '').toLowerCase();

  return (
    request.headers[name] ||
    request.headers[lowerName] ||
    ''
  );
}

function getRequestRegionCode(request) {
  return normalizeCountryCode(
    getHeader(request, 'x-vercel-ip-country')
  );
}

function getAddressComponent(components, wantedType) {
  if (!Array.isArray(components)) {
    return null;
  }

  return (
    components.find(function (component) {
      return (
        Array.isArray(component?.types) &&
        component.types.includes(wantedType)
      );
    }) || null
  );
}

function getCountryCodeFromGooglePlace(place) {
  const country = getAddressComponent(
    place?.addressComponents,
    'country'
  );

  return normalizeCountryCode(
    country?.shortText ||
    country?.short_name ||
    ''
  );
}

function getGooglePlaceName(place) {
  return String(
    place?.displayName?.text ||
    place?.shortFormattedAddress ||
    place?.formattedAddress ||
    ''
  ).trim();
}

function normalizeGooglePlace(place) {
  if (!place) {
    return null;
  }

  const latitude = Number(place?.location?.latitude);
  const longitude = Number(place?.location?.longitude);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  const primaryText = getGooglePlaceName(place);
  const formattedAddress = String(
    place?.formattedAddress ||
    place?.shortFormattedAddress ||
    ''
  ).trim();

  const primaryType = String(
    place?.primaryType || ''
  ).trim();

  const primaryTypeLabel = String(
    place?.primaryTypeDisplayName?.text || ''
  ).trim();

  const types = Array.isArray(place?.types)
    ? place.types.filter(Boolean)
    : [];

  const countryCode = getCountryCodeFromGooglePlace(place);

  return {
    id:
      String(place?.id || '').trim() ||
      `${longitude}-${latitude}`,

    name: primaryText || formattedAddress,
    displayName: primaryText || formattedAddress,
    primaryText: primaryText || formattedAddress,

    secondaryText:
      formattedAddress === primaryText
        ? ''
        : formattedAddress,

    address: formattedAddress,
    roadAddress: formattedAddress,
    lotAddress: '',
    buildingName: primaryText,

    latitude,
    longitude,

    category:
      primaryTypeLabel ||
      primaryType ||
      types[0] ||
      'place',

    categoryGroupCode: '',
    categoryGroupName: '',

    resultType:
      primaryType ||
      'place',

    source: 'google-places',

    language: String(
      place?.displayName?.languageCode || ''
    ),

    countryCode,
    regionCode: '',

    googlePlaceId: String(place?.id || '').trim(),
    types,
  };
}

function normalizeGooglePlaces(places) {
  return (Array.isArray(places) ? places : [])
    .map(normalizeGooglePlace)
    .filter(Boolean);
}

function normalizePlaceSearchText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\s\-_.·•'",(){}\[\]/\\]+/g, '');
}

function isAdministrativePlace(place) {
  const types = Array.isArray(place?.types)
    ? place.types
    : [];

  const administrativeTypes = new Set([
    'country',
    'administrative_area_level_1',
    'administrative_area_level_2',
    'administrative_area_level_3',
    'locality',
    'postal_town',
    'sublocality',
    'neighborhood',
  ]);

  return types.some(function (type) {
    return administrativeTypes.has(type);
  });
}

function isRunTripPoi(place) {
  const types = Array.isArray(place?.types)
    ? place.types
    : [];

  const poiTypes = new Set([
    'train_station',
    'subway_station',
    'transit_station',
    'bus_station',
    'airport',
    'park',
    'tourist_attraction',
    'museum',
    'art_gallery',
    'university',
    'school',
    'hospital',
    'stadium',
    'shopping_mall',
    'restaurant',
    'cafe',
    'lodging',
    'place_of_worship',
    'premise',
    'establishment',
    'point_of_interest',
  ]);

  return types.some(function (type) {
    return poiTypes.has(type);
  });
}

function rankGooglePlacesForRunTrip(places, query) {
  const normalizedQuery = normalizePlaceSearchText(query);

  return (Array.isArray(places) ? places : [])
    .map(function (place, index) {
      const primaryText = normalizePlaceSearchText(
        place?.primaryText ||
        place?.displayName ||
        place?.name
      );

      let score = 0;

      if (normalizedQuery && primaryText === normalizedQuery) {
        score += 1200;
      } else if (
        normalizedQuery &&
        primaryText.startsWith(normalizedQuery)
      ) {
        score += 700;
      } else if (
        normalizedQuery &&
        primaryText.includes(normalizedQuery)
      ) {
        score += 400;
      } else if (
        normalizedQuery &&
        normalizedQuery.includes(primaryText) &&
        primaryText.length >= 2
      ) {
        score += 150;
      }

      if (isRunTripPoi(place)) {
        score += 250;
      }

      if (isAdministrativePlace(place)) {
        score -= 350;
      }

      // Preserve Google's relevance ranking as a tie-breaker.
      score -= index;

      return {
        place,
        score,
        index,
      };
    })
    .sort(function (a, b) {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return a.index - b.index;
    })
    .map(function (item) {
      return item.place;
    });
}

function normalizeKoreanPlaceDisplayNames(
  places,
  query,
  language
) {
  if (normalizeLanguage(language) !== 'ko') {
    return places;
  }

  const text = String(query || '').trim();
  const compact = text.replace(/\s+/g, '');

  if (!/역$/.test(compact)) {
    return places;
  }

  const baseQuery = normalizePlaceSearchText(
    compact.replace(/역$/, '')
  );

  const stationTypes = new Set([
    'train_station',
    'subway_station',
    'transit_station',
    'light_rail_station',
  ]);

  return (Array.isArray(places) ? places : []).map(
    function (place) {
      const types = Array.isArray(place?.types)
        ? place.types
        : [];

      const isStation = types.some(function (type) {
        return stationTypes.has(type);
      });

      if (!isStation) {
        return place;
      }

      const currentName = normalizePlaceSearchText(
        place?.primaryText ||
        place?.displayName ||
        place?.name
      );

      if (
        baseQuery &&
        currentName === baseQuery &&
        !String(place?.primaryText || '').trim().endsWith('역')
      ) {
        return {
          ...place,
          name: text,
          displayName: text,
          primaryText: text,
          buildingName: text,
        };
      }

      return place;
    }
  );
}

function getGoogleGeocodeCountryCode(result) {
  const components = Array.isArray(result?.address_components)
    ? result.address_components
    : [];

  const country = components.find(function (component) {
    return (
      Array.isArray(component?.types) &&
      component.types.includes('country')
    );
  });

  return normalizeCountryCode(
    country?.short_name || ''
  );
}

function normalizeGoogleReverseResult(
  result,
  latitude,
  longitude
) {
  if (!result) {
    return null;
  }

  const formattedAddress = String(
    result.formatted_address || ''
  ).trim();

  if (!formattedAddress) {
    return null;
  }

  const resultTypes = Array.isArray(result.types)
    ? result.types.filter(Boolean)
    : [];

  return {
    id:
      String(result.place_id || '').trim() ||
      `reverse-${longitude}-${latitude}`,

    name: formattedAddress,
    displayName: formattedAddress,
    primaryText: formattedAddress,
    secondaryText: '',

    address: formattedAddress,
    roadAddress: formattedAddress,
    lotAddress: '',
    buildingName: '',

    latitude: Number(latitude),
    longitude: Number(longitude),

    category:
      resultTypes[0] ||
      'reverse-geocode',

    categoryGroupCode: '',
    categoryGroupName: '',

    resultType:
      resultTypes[0] ||
      'reverse-geocode',

    source: 'google-geocoding',
    language: '',

    countryCode:
      getGoogleGeocodeCountryCode(result),

    regionCode: '',

    googlePlaceId: String(
      result.place_id || ''
    ).trim(),

    types: resultTypes,
    isCurrentLocation: true,
  };
}

function chooseBestReverseGeocodeResult(results) {
  if (!Array.isArray(results) || results.length === 0) {
    return null;
  }

  const priority = [
    'street_address',
    'premise',
    'subpremise',
    'route',
    'intersection',
    'neighborhood',
    'sublocality',
    'locality',
    'administrative_area_level_2',
    'administrative_area_level_1',
    'country',
  ];

  const scored = results.map(function (result, index) {
    const types = Array.isArray(result?.types)
      ? result.types
      : [];

    let bestPriority = priority.length + 1;

    types.forEach(function (type) {
      const priorityIndex = priority.indexOf(type);

      if (
        priorityIndex >= 0 &&
        priorityIndex < bestPriority
      ) {
        bestPriority = priorityIndex;
      }
    });

    return {
      result,
      score: bestPriority * 100 + index,
    };
  });

  scored.sort(function (a, b) {
    return a.score - b.score;
  });

  return scored[0]?.result || results[0];
}

function getExplicitProximity(url) {
  const latitude = Number(
    url.searchParams.get('proximityLat')
  );

  const longitude = Number(
    url.searchParams.get('proximityLng')
  );

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  return { latitude, longitude };
}

function getVercelProximity(request) {
  const latitude = Number(
    getHeader(request, 'x-vercel-ip-latitude')
  );

  const longitude = Number(
    getHeader(request, 'x-vercel-ip-longitude')
  );

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  return { latitude, longitude };
}

function getLocationBias(request, url) {
  return (
    getExplicitProximity(url) ||
    getVercelProximity(request)
  );
}

async function requestGooglePlacesTextSearch({
  query,
  language,
  regionCode,
  locationBias,
  includedType,
  strictTypeFiltering = false,
  apiKey,
}) {
  const body = {
    textQuery: String(query || '').trim(),
    languageCode: normalizeLanguage(language),
    pageSize: 10,
  };

  if (includedType) {
    body.includedType = includedType;

    if (strictTypeFiltering) {
      body.strictTypeFiltering = true;
    }
  }

  if (
    locationBias &&
    Number.isFinite(Number(locationBias.latitude)) &&
    Number.isFinite(Number(locationBias.longitude))
  ) {
    body.locationBias = {
      circle: {
        center: {
          latitude: Number(locationBias.latitude),
          longitude: Number(locationBias.longitude),
        },
        radius: 50000,
      },
    };
  }

  if (regionCode) {
    body.regionCode = regionCode;
  }

  const response = await fetch(
    GOOGLE_PLACES_TEXT_SEARCH_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': [
          'places.id',
          'places.displayName',
          'places.formattedAddress',
          'places.shortFormattedAddress',
          'places.location',
          'places.types',
          'places.primaryType',
          'places.primaryTypeDisplayName',
          'places.addressComponents',
        ].join(','),
      },
      body: JSON.stringify(body),
    }
  );

  const data = await response
    .json()
    .catch(() => ({}));

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

async function requestGoogleReverseGeocode({
  latitude,
  longitude,
  language,
  regionCode,
  apiKey,
}) {
  const googleUrl = new URL(
    GOOGLE_GEOCODING_REVERSE_URL
  );

  googleUrl.searchParams.set(
    'latlng',
    `${latitude},${longitude}`
  );

  googleUrl.searchParams.set('key', apiKey);
  googleUrl.searchParams.set(
    'language',
    normalizeLanguage(language)
  );

  if (regionCode) {
    googleUrl.searchParams.set(
      'region',
      String(regionCode).toLowerCase()
    );
  }

  const response = await fetch(googleUrl, {
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

  const query = String(
    url.searchParams.get('q') || ''
  ).trim();

  const language = normalizeLanguage(
    url.searchParams.get('language') ||
    url.searchParams.get('lang') ||
    'ko'
  );

  const latitudeParam = url.searchParams.get('lat');
  const longitudeParam = url.searchParams.get('lng');

  const hasReverseParams =
    latitudeParam !== null &&
    longitudeParam !== null &&
    String(latitudeParam).trim() !== '' &&
    String(longitudeParam).trim() !== '';

  const latitude = hasReverseParams
    ? Number(latitudeParam)
    : NaN;

  const longitude = hasReverseParams
    ? Number(longitudeParam)
    : NaN;

  const isReverseRequest =
    hasReverseParams &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);

  if (!query && !isReverseRequest) {
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

  const apiKey = getGoogleMapsApiKey();

  if (!apiKey) {
    return jsonResponse(
      {
        error: 'Google Maps API 키가 설정되지 않았어요.',
        places: [],
      },
      500
    );
  }

  const regionCode = getRequestRegionCode(request);

  if (isReverseRequest) {
    try {
      const reverseResult = await requestGoogleReverseGeocode({
        latitude,
        longitude,
        language,
        regionCode,
        apiKey,
      });

      if (!reverseResult.ok) {
        console.error(
          'Google reverse geocode HTTP error:',
          {
            status: reverseResult.status,
            data: reverseResult.data,
          }
        );

        return jsonResponse(
          {
            error: '현재 위치 주소를 찾지 못했어요.',
            place: null,
            googleStatus: reverseResult.status,
          },
          reverseResult.status || 500
        );
      }

      const googleStatus = String(
        reverseResult.data?.status || ''
      );

      if (
        googleStatus !== 'OK' &&
        googleStatus !== 'ZERO_RESULTS'
      ) {
        console.error(
          'Google reverse geocode API error:',
          {
            status: googleStatus,
            errorMessage:
              reverseResult.data?.error_message || '',
          }
        );

        return jsonResponse(
          {
            error:
              reverseResult.data?.error_message ||
              '현재 위치 주소를 찾지 못했어요.',
            place: null,
            googleStatus,
          },
          googleStatus === 'REQUEST_DENIED'
            ? 403
            : 502
        );
      }

      const results = Array.isArray(
        reverseResult.data?.results
      )
        ? reverseResult.data.results
        : [];

      const bestResult = chooseBestReverseGeocodeResult(
        results
      );

      const place = normalizeGoogleReverseResult(
        bestResult,
        latitude,
        longitude
      );

      return jsonResponse({
        place,
        provider: 'google-geocoding',
        language,
      });
    } catch (error) {
      console.error(
        'Google reverse geocoding server error:',
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
    // Global text search must not be silently biased by the runner's
    // current IP country/location. Only an explicit proximity supplied
    // by the client is allowed to influence place-name search.
    const searchRegionCode = '';
    const locationBias = getExplicitProximity(url);

    const includedType = getRunTripIncludedTypeHint(
      query,
      language
    );

    let searchResult = await requestGooglePlacesTextSearch({
      query,
      language,
      regionCode: searchRegionCode,
      locationBias,
      includedType,
      strictTypeFiltering: Boolean(includedType),
      apiKey,
    });

    const strictPlaces = Array.isArray(
      searchResult.data?.places
    )
      ? searchResult.data.places
      : [];

    if (
      searchResult.ok &&
      includedType &&
      strictPlaces.length === 0
    ) {
      searchResult = await requestGooglePlacesTextSearch({
        query,
        language,
        regionCode: searchRegionCode,
        locationBias,
        includedType: '',
        strictTypeFiltering: false,
        apiKey,
      });
    }

    if (!searchResult.ok) {
      console.error(
        'Google Places Text Search error:',
        {
          status: searchResult.status,
          data: searchResult.data,
        }
      );

      const googleMessage =
        searchResult.data?.error?.message ||
        'Google Places에서 자세한 오류 메시지를 보내지 않았어요.';

      return jsonResponse(
        {
          error: 'Google 장소 검색에 실패했어요.',
          googleStatus: searchResult.status,
          googleMessage,
          places: [],
        },
        searchResult.status || 500
      );
    }

    const normalizedPlaces =
      normalizeKoreanPlaceDisplayNames(
        normalizeGooglePlaces(
          searchResult.data?.places
        ),
        query,
        language
      );

    const places = rankGooglePlacesForRunTrip(
      normalizedPlaces,
      query
    ).slice(0, 10);

    return jsonResponse({
      places,
      provider: 'google-places-new',
      language,
      regionCode: searchRegionCode,
      includedType,
      searchSources: {
        googlePlacesNew: true,
        googleGeocoding: false,
      },
    });
  } catch (error) {
    console.error(
      'Google Places server error:',
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

  const webResponse = await handleFetchRequest(
    webRequest
  );

  const body = await webResponse.text();

  webResponse.headers.forEach(function (value, key) {
    response.setHeader(key, value);
  });

  response.status(webResponse.status);
  response.send(body);
}
