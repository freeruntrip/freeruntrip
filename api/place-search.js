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

function createKakaoHeaders(kakaoRestApiKey) {
  return {
    Authorization: `KakaoAK ${kakaoRestApiKey}`,
  };
}

function normalizeKeywordPlaces(documents = []) {
  return documents.map((place) => {
    const roadAddress = place.road_address_name || '';
    const lotAddress = place.address_name || '';
    const placeName = place.place_name || '';

    return {
      id: `keyword-${place.id}`,

      name: placeName,
      displayName: placeName,
      primaryText: placeName,
      secondaryText: roadAddress || lotAddress,

      address: roadAddress || lotAddress,
      roadAddress,
      lotAddress,
      buildingName: placeName,

      latitude: Number(place.y),
      longitude: Number(place.x),

      category: place.category_name || '',
      categoryGroupCode: place.category_group_code || '',
      categoryGroupName: place.category_group_name || '',
      distance: Number(place.distance) || null,
      resultType: 'place',
      source: 'keyword',
    };
  });
}

function getShortAddress(address) {
  const normalizedAddress =
    String(address || '')
      .trim()
      .replace(/\s+/g, ' ');

  if (!normalizedAddress) {
    return '';
  }

  const parts = normalizedAddress.split(' ');

  const roadIndex = parts.findIndex(function (part) {
    return /(?:대로|로|길)$/.test(part);
  });

  if (roadIndex >= 0) {
    return parts
      .slice(roadIndex)
      .join(' ');
  }

  if (parts.length <= 2) {
    return normalizedAddress;
  }

  return parts.slice(-2).join(' ');
}

function isRoadAddressQuery(query) {
  const normalizedQuery = String(query || '')
    .trim()
    .replace(/\s+/g, ' ');

  return /(?:대로|로|길)(?:\s|\d|$)/.test(
    normalizedQuery
  );
}

function isLotAddressQuery(query) {
  const normalizedQuery = String(query || '')
    .trim()
    .replace(/\s+/g, ' ');

  if (isRoadAddressQuery(normalizedQuery)) {
    return false;
  }

  return /(?:읍|면|동|리)\s+(?:산\s*)?\d+(?:-\d+)?(?:\s|$)/.test(
    normalizedQuery
  );
}

function normalizeAddressPlaces(documents = [], query = '') {
  const preferLotAddress =
    isLotAddressQuery(query);

  const preferRoadAddress =
    isRoadAddressQuery(query);

  return documents.map((place) => {
    const roadAddress =
      place.road_address?.address_name || '';

    const lotAddress =
      place.address?.address_name ||
      place.address_name ||
      '';

    const buildingName =
      place.road_address?.building_name || '';

    let mainAddress =
      roadAddress || lotAddress;

    let addressType =
      roadAddress
        ? '도로명 주소'
        : '지번 주소';

    if (preferLotAddress && lotAddress) {
      mainAddress = lotAddress;
      addressType = '지번 주소';
    } else if (
      preferRoadAddress &&
      roadAddress
    ) {
      mainAddress = roadAddress;
      addressType = '도로명 주소';
    }

    const shortAddress =
      getShortAddress(mainAddress);

    const secondaryParts = [
      buildingName,
      addressType,
    ].filter(Boolean);

    return {
      id: `address-${place.x}-${place.y}`,

      name: shortAddress || mainAddress,
      displayName: shortAddress || mainAddress,
      primaryText: mainAddress,
      secondaryText: secondaryParts.join(' · '),

      address: mainAddress,
      roadAddress,
      lotAddress,
      buildingName,

      latitude: Number(place.y),
      longitude: Number(place.x),

      category: '주소',
      resultType: 'address',
      source: 'address',
    };
  });
}


function normalizeReverseGeocodeDocument(document) {
  if (!document) {
    return null;
  }

  const roadAddress =
    document.road_address?.address_name || '';

  const lotAddress =
    document.address?.address_name || '';

  const buildingName =
    document.road_address?.building_name || '';

  const mainAddress =
    roadAddress || lotAddress;

  if (!mainAddress) {
    return null;
  }

  const shortAddress =
    getShortAddress(mainAddress);

  return {
    id:
      `reverse-${document.x || ''}-${document.y || ''}`,

    name:
      shortAddress || mainAddress,

    displayName:
      shortAddress || mainAddress,

    primaryText:
      mainAddress,

    secondaryText:
      [
        buildingName,
        roadAddress
          ? '도로명 주소'
          : '지번 주소',
      ]
        .filter(Boolean)
        .join(' · '),

    address:
      mainAddress,

    roadAddress,
    lotAddress,
    buildingName,

    latitude:
      Number(document.y),

    longitude:
      Number(document.x),

    category:
      '현재 위치 주소',

    resultType:
      'reverse-geocode',

    source:
      'reverse-geocode',
  };
}

async function requestKakaoReverseGeocode({
  latitude,
  longitude,
  kakaoRestApiKey,
}) {
  const kakaoUrl = new URL(
    'https://dapi.kakao.com/v2/local/geo/coord2address.json'
  );

  kakaoUrl.searchParams.set(
    'x',
    String(longitude)
  );

  kakaoUrl.searchParams.set(
    'y',
    String(latitude)
  );

  kakaoUrl.searchParams.set(
    'input_coord',
    'WGS84'
  );

  const response = await fetch(kakaoUrl, {
    headers:
      createKakaoHeaders(
        kakaoRestApiKey
      ),
  });

  let data;

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

function calculateCoordinateDistanceMeters(firstPlace, secondPlace) {
  const firstLatitude = Number(firstPlace?.latitude);
  const firstLongitude = Number(firstPlace?.longitude);
  const secondLatitude = Number(secondPlace?.latitude);
  const secondLongitude = Number(secondPlace?.longitude);

  if (
    !Number.isFinite(firstLatitude) ||
    !Number.isFinite(firstLongitude) ||
    !Number.isFinite(secondLatitude) ||
    !Number.isFinite(secondLongitude)
  ) {
    return Infinity;
  }

  const earthRadiusMeters = 6371000;
  const toRadians = (value) => value * Math.PI / 180;
  const latitudeDifference =
    toRadians(secondLatitude - firstLatitude);
  const longitudeDifference =
    toRadians(secondLongitude - firstLongitude);

  const haversine =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(toRadians(firstLatitude)) *
      Math.cos(toRadians(secondLatitude)) *
      Math.sin(longitudeDifference / 2) ** 2;

  return 2 * earthRadiusMeters * Math.atan2(
    Math.sqrt(haversine),
    Math.sqrt(1 - haversine)
  );
}


function normalizeAddressKey(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[()]/g, '')
    .toLowerCase();
}

function isMeaningfulBuildingName(name) {
  const normalizedName = String(name || '').trim();

  if (!normalizedName) {
    return false;
  }

  /* 주소 API가 제공한 실제 건물·공동주택 명칭은
     주변 상호보다 먼저 보여준다. */
  return /(아파트|오피스텔|빌딩|타워|센터|몰|백화점|시장|학교|대학교|병원|공원|역|터미널|공항|회관|관|호텔|리조트|주상복합|단지)$/u.test(
    normalizedName
  );
}

function isExactAddressMatch(addressPlace, place) {
  const addressKeys = new Set(
    [
      addressPlace?.roadAddress,
      addressPlace?.lotAddress,
      addressPlace?.address,
    ]
      .map(normalizeAddressKey)
      .filter(Boolean)
  );

  const placeKeys = [
    place?.roadAddress,
    place?.lotAddress,
    place?.address,
  ]
    .map(normalizeAddressKey)
    .filter(Boolean);

  return placeKeys.some((key) => addressKeys.has(key));
}

function findBestExactAddressPlace(
  addressPlace,
  candidatePlaces,
  usedIndexes
) {
  let bestIndex = -1;
  let bestScore = -Infinity;

  candidatePlaces.forEach((place, index) => {
    if (usedIndexes.has(index)) {
      return;
    }

    if (!isExactAddressMatch(addressPlace, place)) {
      return;
    }

    const name = String(place?.name || '').trim();
    const category = String(place?.category || '');
    const distance = calculateCoordinateDistanceMeters(
      addressPlace,
      place
    );

    let score = 3000;

    /* 정확히 같은 주소에 등록된 시설 중에서도
       건물·주거단지·공공시설·상호명을 우선한다. */
    if (/(아파트|오피스텔|빌딩|타워|센터|학교|병원|공원|역|터미널|공항)/u.test(name)) {
      score += 500;
    }

    if (/(음식점|카페|교통|공공기관|학교|병원|문화시설)/u.test(category)) {
      score += 250;
    }

    /* '점'으로 끝나는 정상 상호는 주소가 정확히 일치하면
       감점하지 않는다. */
    if (/(부동산|공인중개사|주차장)/u.test(name)) {
      score -= 180;
    }

    if (Number.isFinite(distance)) {
      score -= distance;
    }

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function getRepresentativePlaceScore(addressPlace, place) {
  const distance = calculateCoordinateDistanceMeters(
    addressPlace,
    place
  );

  if (!Number.isFinite(distance) || distance > 180) {
    return -Infinity;
  }

  const name = String(place?.name || '').trim();
  const category = String(place?.category || '');
  const categoryGroupCode = String(
    place?.categoryGroupCode || ''
  );

  let score = 0;

  /* 주소의 대표 지명으로 가장 중요한 교통시설을 우선한다. */
  if (categoryGroupCode === 'SW8') {
    score += 1400;
  }

  if (/(지하철|전철|철도|기차역|버스터미널|여객터미널|공항)/.test(category)) {
    score += 1100;
  }

  if (/(공공기관|관공서|학교|대학교|병원|공원|문화시설)/.test(category)) {
    score += 500;
  }

  /* 순수 역명이나 노선명이 붙은 역 결과를 높인다. */
  if (/역(?:\s*\d+호선|\s*신분당선|\s*[가-힣]+선)?$/.test(name)) {
    score += 650;
  }

  if (/터미널$|공항$|공원$|학교$|대학교$|병원$|구청$|시청$/.test(name)) {
    score += 350;
  }

  /* 매장·지점은 같은 주소의 대표 시설보다 뒤로 보낸다. */
  if (/(스타벅스|카페|커피|식당|음식점|편의점|마트|약국|부동산)/.test(name)) {
    score -= 500;
  }

  if (/(점|지점|매장|센터)$/.test(name)) {
    score -= 320;
  }

  /* 가까운 후보를 선호하되 대표성 점수가 거리를 이기도록 한다. */
  score -= distance * 1.5;

  return score;
}

function findBestRepresentativePlace(
  addressPlace,
  candidatePlaces,
  usedIndexes
) {
  let bestIndex = -1;
  let bestScore = -Infinity;

  candidatePlaces.forEach((place, index) => {
    if (usedIndexes.has(index)) {
      return;
    }

    const score = getRepresentativePlaceScore(
      addressPlace,
      place
    );

    if (score > bestScore) {
      bestIndex = index;
      bestScore = score;
    }
  });

  return bestScore > -Infinity
    ? bestIndex
    : -1;
}

function mergePlaces(
  addressPlaces,
  keywordPlaces,
  query = '',
  limit = 15
) {
  const isAddressSearch =
    isRoadAddressQuery(query) ||
    isLotAddressQuery(query);

  if (isAddressSearch) {
    const usedKeywordIndexes = new Set();

    const mergedAddressPlaces = addressPlaces.map((addressPlace) => {
      const exactAddressIndex = findBestExactAddressPlace(
        addressPlace,
        keywordPlaces,
        usedKeywordIndexes
      );

      const representativeIndex =
        exactAddressIndex >= 0
          ? exactAddressIndex
          : findBestRepresentativePlace(
              addressPlace,
              keywordPlaces,
              usedKeywordIndexes
            );

      const representativePlace =
        representativeIndex >= 0
          ? keywordPlaces[representativeIndex]
          : null;

      if (representativeIndex >= 0) {
        usedKeywordIndexes.add(representativeIndex);
      }

      const placeName =
        isMeaningfulBuildingName(addressPlace.buildingName)
          ? addressPlace.buildingName
          : representativePlace?.name ||
            addressPlace.buildingName ||
            '';

      return {
        ...addressPlace,
        buildingName: placeName,
        secondaryText: placeName,
      };
    });

    /* 주소 검색에서는 같은 위치의 장소 결과를 별도 카드로
       반복하지 않는다. 주소 API 결과가 없을 때만 장소 결과를 보여준다. */
    if (mergedAddressPlaces.length > 0) {
      return mergedAddressPlaces.slice(0, limit);
    }

    return keywordPlaces.slice(0, limit);
  }

  /* 장소명 검색에서는 장소명을 굵게, 도로명 주소를 얇게 표시한다.
     도로명 주소가 없을 때만 지번 주소를 대신 사용한다. */
  return keywordPlaces
    .map((place) => ({
      ...place,
      primaryText: place.name,
      secondaryText: place.roadAddress || place.lotAddress,
      displayName: place.name,
    }))
    .slice(0, limit);
}

async function requestKakaoSearch({
  endpoint,
  query,
  kakaoRestApiKey,
  size = 10,
}) {
  const kakaoUrl = new URL(endpoint);

  kakaoUrl.searchParams.set('query', query);
  kakaoUrl.searchParams.set('size', String(size));

  const response = await fetch(kakaoUrl, {
    headers: createKakaoHeaders(kakaoRestApiKey),
  });

  let data;

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

async function requestKakaoCategorySearch({
  categoryGroupCode,
  longitude,
  latitude,
  kakaoRestApiKey,
  radius = 180,
  size = 15,
}) {
  const kakaoUrl = new URL(
    'https://dapi.kakao.com/v2/local/search/category.json'
  );

  kakaoUrl.searchParams.set(
    'category_group_code',
    categoryGroupCode
  );
  kakaoUrl.searchParams.set('x', String(longitude));
  kakaoUrl.searchParams.set('y', String(latitude));
  kakaoUrl.searchParams.set('radius', String(radius));
  kakaoUrl.searchParams.set('sort', 'distance');
  kakaoUrl.searchParams.set('size', String(size));

  const response = await fetch(kakaoUrl, {
    headers: createKakaoHeaders(kakaoRestApiKey),
  });

  let data;

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

async function getNearbyRepresentativePlaces(
  addressPlaces,
  kakaoRestApiKey
) {
  if (!Array.isArray(addressPlaces) || addressPlaces.length === 0) {
    return [];
  }

  const searches = addressPlaces
    .slice(0, 5)
    .map((addressPlace) =>
      requestKakaoCategorySearch({
        categoryGroupCode: 'SW8',
        longitude: addressPlace.longitude,
        latitude: addressPlace.latitude,
        kakaoRestApiKey,
        radius: 180,
        size: 15,
      })
    );

  const results = await Promise.all(searches);
  const documents = results.flatMap((result) =>
    result.ok && Array.isArray(result.data?.documents)
      ? result.data.documents
      : []
  );

  return normalizeKeywordPlaces(documents);
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
    const query = url.searchParams.get('q')?.trim();
    const latitudeParam =
      url.searchParams.get('lat');

    const longitudeParam =
      url.searchParams.get('lng');

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

    if (query && query.length > 100) {
      return jsonResponse(
        {
          error: '검색어는 100자 이하로 입력해 주세요.',
          places: [],
        },
        400
      );
    }

    const kakaoRestApiKey = process.env.KAKAO_REST_API_KEY;

    if (!kakaoRestApiKey) {
      return jsonResponse(
        {
          error: '카카오 API 키가 설정되지 않았어요.',
          places: [],
        },
        500
      );
    }

    if (isReverseGeocodeRequest) {
      try {
        const reverseResult =
          await requestKakaoReverseGeocode({
            latitude,
            longitude,
            kakaoRestApiKey,
          });

        if (!reverseResult.ok) {
          return jsonResponse(
            {
              error:
                '현재 위치 주소를 찾지 못했어요.',
              place: null,
              kakaoStatus:
                reverseResult.status,
            },
            reverseResult.status || 500
          );
        }

        const document =
          Array.isArray(
            reverseResult.data?.documents
          )
            ? reverseResult.data.documents[0]
            : null;

        const normalizedPlace =
          normalizeReverseGeocodeDocument(
            document
          );

        if (!normalizedPlace) {
          return jsonResponse({
            place: null,
          });
        }

        normalizedPlace.latitude =
          latitude;

        normalizedPlace.longitude =
          longitude;

        return jsonResponse({
          place: normalizedPlace,
        });
      } catch (error) {
        console.error(
          'Kakao reverse geocode error:',
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
      const [addressResult, keywordResult] = await Promise.all([
        requestKakaoSearch({
          endpoint:
            'https://dapi.kakao.com/v2/local/search/address.json',
          query,
          kakaoRestApiKey,
          size: 10,
        }),
        requestKakaoSearch({
          endpoint:
            'https://dapi.kakao.com/v2/local/search/keyword.json',
          query,
          kakaoRestApiKey,
          size: 10,
        }),
      ]);

      if (!addressResult.ok && !keywordResult.ok) {
        return jsonResponse(
          {
            error: '카카오 장소 검색에 실패했어요.',
            kakaoStatus:
              keywordResult.status || addressResult.status,
            kakaoMessage:
              keywordResult.data?.msg ||
              keywordResult.data?.message ||
              addressResult.data?.msg ||
              addressResult.data?.message ||
              '카카오에서 자세한 오류 메시지를 보내지 않았어요.',
            places: [],
          },
          keywordResult.status || addressResult.status || 500
        );
      }

      const addressPlaces = addressResult.ok
        ? normalizeAddressPlaces(addressResult.data.documents, query)
        : [];

      const keywordPlaces = keywordResult.ok
        ? normalizeKeywordPlaces(keywordResult.data.documents)
        : [];

      const isAddressSearch =
        isRoadAddressQuery(query) ||
        isLotAddressQuery(query);

      const nearbyRepresentativePlaces = isAddressSearch
        ? await getNearbyRepresentativePlaces(
            addressPlaces,
            kakaoRestApiKey
          )
        : [];

      const candidatePlaces = [
        ...nearbyRepresentativePlaces,
        ...keywordPlaces,
      ];

      const places = mergePlaces(
        addressPlaces,
        candidatePlaces,
        query,
        15
      );

      return jsonResponse({
        places,
        searchSources: {
          address: addressResult.ok,
          keyword: keywordResult.ok,
        },
      });
    } catch (error) {
      console.error('Kakao place search error:', error);

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
  /* Vercel Node API와 Web Fetch 런타임을 모두 지원한다. */
  if (!response && typeof Request !== 'undefined' && request instanceof Request) {
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
    headers: request.headers || {}
  });

  const webResponse = await handleFetchRequest(webRequest);
  const body = await webResponse.text();

  webResponse.headers.forEach(function (value, key) {
    response.setHeader(key, value);
  });

  response.status(webResponse.status);
  response.send(body);
}
